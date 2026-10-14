import { Response, NextFunction } from 'express';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IEvidence } from '../types';
import { writeAuditEvent } from '../utils/auditLogger';
import { presignEvidenceGet } from '../utils/s3Presigner';

const PRESIGNED_UPLOAD_URL = process.env.PRESIGNED_UPLOAD_URL!;
const S3_BUCKET_NAME = process.env.EVIDENCE_BUCKET_NAME || 'hometrust-evidence-dev';

// ─── Helper: build public S3 URL from an object key ───────────────────────────
// ─── Helper: verify the caller is a participant of the inspection ──────────────
async function getInspectionOrThrow(
  inspectionId: string,
  roomItemId: string,
  userId: string,
  res: Response
): Promise<IInspection> {
  const [result, itemResult] = await Promise.all([
    docClient.send(new GetCommand({ TableName: TABLES.INSPECTIONS, Key: { inspectionId } })),
    docClient.send(new GetCommand({ TableName: TABLES.ROOM_ITEMS, Key: { inspectionId, roomItemId } })),
  ]);

  if (!result.Item) {
    res.status(404);
    throw new Error('Inspection not found');
  }

  const inspection = result.Item as IInspection;
  const isParticipant = inspection.landlordId === userId || inspection.tenantId === userId || inspection.participantIds?.includes(userId) === true;

  if (!isParticipant) {
    res.status(403);
    throw new Error('Not authorized to upload evidence for this inspection');
  }

  if (inspection.state === 'READ_ONLY' || inspection.state === 'UNDER_REVIEW') {
    res.status(400);
    throw new Error('Cannot upload evidence to an inspection that is submitted or read-only');
  }
  if (!itemResult.Item) {
    res.status(404);
    throw new Error('Room item not found in this inspection');
  }

  return inspection;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/evidence/presigned-url
// Body: { file_name: string, content_type: string, inspection_id: string, item_id: string }
//
// Calls the Lambda via API Gateway and returns the presigned S3 upload URL.
// The frontend uses this URL to PUT the file directly to S3.
// ─────────────────────────────────────────────────────────────────────────────
export const getPresignedUrl = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { file_name, content_type, inspection_id, item_id } = req.body;

    if (!file_name || !content_type || !inspection_id || !item_id) {
      res.status(400);
      throw new Error('file_name, content_type, inspection_id and item_id are required');
    }

    await getInspectionOrThrow(inspection_id, item_id, req.user!.userId, res);
    if (!/^image\/(jpeg|png|webp|heic)$|^video\/(mp4|quicktime)$/.test(content_type)) {
      res.status(400);
      throw new Error('Unsupported evidence content type');
    }

    if (!PRESIGNED_UPLOAD_URL) {
      res.status(500);
      throw new Error('PRESIGNED_UPLOAD_URL is not configured on the server');
    }

    const safeFileName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const scopedFileName = inspection_id + '/' + item_id + '/' + uuidv4() + '-' + safeFileName;
    const lambdaResponse = await fetch(PRESIGNED_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: scopedFileName, content_type }),
    });

    if (!lambdaResponse.ok) {
      res.status(502);
      throw new Error('Failed to get presigned URL from upload service');
    }

    const data = await lambdaResponse.json() as {
      upload_url: string;
      object_key: string;
      expires_in: number;
    };

    writeAuditEvent({ eventType: 'evidence.upload_url_issued', outcome: 'success', actorId: req.user!.userId, resourceType: 'evidence_upload', details: { inspectionId: inspection_id, roomItemId: item_id } });

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/evidence/:inspectionId/items/:itemId/confirm
// Body: { object_key: string, content_type: string }
//
// Called AFTER the frontend has uploaded the file directly to S3.
// Saves the S3 object key to DynamoDB and returns a short-lived signed URL.
// ─────────────────────────────────────────────────────────────────────────────
export const confirmUpload = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId, itemId } = req.params;
    const { object_key, content_type } = req.body;

    if (!object_key || !content_type) {
      res.status(400);
      throw new Error('object_key and content_type are required');
    }

    const inspection = await getInspectionOrThrow(
      inspectionId as string,
      itemId as string,
      req.user!.userId,
      res
    );
    const expectedKeyPrefix = 'evidence/' + inspectionId + '/' + itemId + '/';
    if (typeof object_key !== 'string' || !object_key.startsWith(expectedKeyPrefix)) {
      res.status(400);
      throw new Error('Invalid evidence object key');
    }
    if (!/^image\/(jpeg|png|webp|heic)$|^video\/(mp4|quicktime)$/.test(content_type)) {
      res.status(400);
      throw new Error('Unsupported evidence content type');
    }

    const now = new Date().toISOString();
    const evidenceEntry: IEvidence = {
      inspectionId: inspectionId as string,
      evidenceId: uuidv4(),
      roomItemId: itemId as string,
      objectKey: object_key,
      type: content_type.startsWith('video') ? 'video' : 'image',
      uploadedBy: req.user!.userId,
      clientMetadata: req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
      createdAt: now,
    };

    await docClient.send(new PutCommand({ TableName: TABLES.EVIDENCE, Item: evidenceEntry }));
    await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: { ':updatedAt': now },
    }));

    writeAuditEvent({ eventType: 'evidence.upload_confirmed', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection_item', resourceId: itemId as string, details: { inspectionId: inspectionId as string, evidenceId: evidenceEntry.evidenceId } });

    const downloadUrl = `/api/evidence/${encodeURIComponent(inspectionId as string)}/${encodeURIComponent(evidenceEntry.evidenceId)}/download-url`;
    const signedUrl = await presignEvidenceGet(S3_BUCKET_NAME, evidenceEntry.objectKey, 900);
    res.status(201).json({
      ...evidenceEntry,
      url: signedUrl,
      downloadUrl,
    });
  } catch (error) {
    next(error);
  }
};

/** A private, short-lived download URL for a participant to display an evidence file. */
export const getEvidenceDownloadUrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { inspectionId, evidenceId } = req.params;
    const [inspectionResult, evidenceResult] = await Promise.all([
      docClient.send(new GetCommand({ TableName: TABLES.INSPECTIONS, Key: { inspectionId } })),
      docClient.send(new GetCommand({ TableName: TABLES.EVIDENCE, Key: { inspectionId, evidenceId } })),
    ]);
    if (!inspectionResult.Item) return res.status(404).json({ message: 'Inspection not found' });
    const inspection = inspectionResult.Item as IInspection;
    const userId = req.user!.userId;
    if (inspection.landlordId !== userId && inspection.tenantId !== userId && !inspection.participantIds?.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to view this evidence' });
    }
    const evidence = evidenceResult.Item as IEvidence | undefined;
    if (!evidence) return res.status(404).json({ message: 'Evidence not found' });
    const url = await presignEvidenceGet(S3_BUCKET_NAME, evidence.objectKey, 900);
    return res.json({ url, expiresIn: 900 });
  } catch (error) { return next(error); }
};

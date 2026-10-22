
import { Response, NextFunction } from 'express';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IEvidence } from '../types';
import { writeAuditEvent } from '../utils/auditLogger';
import { presignEvidenceGet } from '../utils/s3Presigner';

const PRESIGNED_UPLOAD_URL = process.env.PRESIGNED_UPLOAD_URL!;
const S3_BUCKET_NAME =
  process.env.EVIDENCE_BUCKET_NAME || 'hometrust-evidence-dev';

// Verify that the caller participates in the inspection and that the
// requested room item belongs to that inspection.
async function getInspectionOrThrow(
  inspectionId: string,
  roomItemId: string,
  userId: string,
  res: Response
): Promise<IInspection> {
  const [result, itemResult] = await Promise.all([
    docClient.send(
      new GetCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
      })
    ),
    docClient.send(
      new GetCommand({
        TableName: TABLES.ROOM_ITEMS,
        Key: { inspectionId, roomItemId },
      })
    ),
  ]);

  if (!result.Item) {
    res.status(404);
    throw new Error('Inspection not found');
  }

  const inspection = result.Item as IInspection;

  const isParticipant =
    inspection.landlordId === userId ||
    inspection.tenantId === userId ||
    inspection.participantIds?.includes(userId) === true;

  if (!isParticipant) {
    res.status(403);
    throw new Error(
      'Not authorized to upload evidence for this inspection'
    );
  }

  if (inspection.state === 'READ_ONLY') {
    res.status(400);
    throw new Error('Cannot upload evidence to a read-only inspection');
  }

  if (!itemResult.Item) {
    res.status(404);
    throw new Error('Room item not found in this inspection');
  }

  return inspection;
}

// POST /api/evidence/presigned-url
// The backend validates the user and inspection, then requests a
// temporary S3 upload URL from the protected API Gateway endpoint.
export const getPresignedUrl = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { file_name, content_type, inspection_id, item_id } = req.body;

    if (!file_name || !content_type || !inspection_id || !item_id) {
      res.status(400);
      throw new Error(
        'file_name, content_type, inspection_id and item_id are required'
      );
    }

    await getInspectionOrThrow(
      inspection_id,
      item_id,
      req.user!.userId,
      res
    );

    if (
      !/^image\/(jpeg|png|webp|heic)$|^video\/(mp4|quicktime)$/.test(
        content_type
      )
    ) {
      res.status(400);
      throw new Error('Unsupported evidence content type');
    }

    if (!PRESIGNED_UPLOAD_URL) {
      res.status(500);
      throw new Error('PRESIGNED_UPLOAD_URL is not configured on the server');
    }

    // The protect middleware has already validated this bearer token.
    // Forward it so API Gateway can independently verify the JWT.
    const authorization = req.headers.authorization;

    if (!authorization) {
      res.status(401);
      throw new Error('Authorization token is required');
    }

    const safeFileName = String(file_name).replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

    const scopedFileName =
      inspection_id +
      '/' +
      item_id +
      '/' +
      uuidv4() +
      '-' +
      safeFileName;

    const lambdaResponse = await fetch(PRESIGNED_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        file_name: scopedFileName,
        content_type,
      }),
    });

    if (!lambdaResponse.ok) {
      const upstreamBody = await lambdaResponse.text().catch(() => '');
      console.error('Presigned upload service rejected request:', lambdaResponse.status, upstreamBody.slice(0, 300));
      res.status(502);
      throw new Error('Failed to get presigned URL from upload service');
    }

    const data = (await lambdaResponse.json()) as {
      upload_url: string;
      object_key: string;
      expires_in: number;
    };

    writeAuditEvent({
      eventType: 'evidence.upload_url_issued',
      outcome: 'success',
      actorId: req.user!.userId,
      resourceType: 'evidence_upload',
      details: {
        inspectionId: inspection_id,
        roomItemId: item_id,
      },
    });

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// POST /api/evidence/:inspectionId/items/:itemId/confirm
// Called after the frontend uploads the file directly to S3.
// Saves the private S3 object reference to DynamoDB.
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

    await getInspectionOrThrow(
      inspectionId as string,
      itemId as string,
      req.user!.userId,
      res
    );

    const expectedKeyPrefix =
      'evidence/' + inspectionId + '/' + itemId + '/';

    if (
      typeof object_key !== 'string' ||
      !object_key.startsWith(expectedKeyPrefix)
    ) {
      res.status(400);
      throw new Error('Invalid evidence object key');
    }

    if (
      !/^image\/(jpeg|png|webp|heic)$|^video\/(mp4|quicktime)$/.test(
        content_type
      )
    ) {
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
      clientMetadata:
        req.body.metadata && typeof req.body.metadata === 'object'
          ? req.body.metadata
          : {},
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.EVIDENCE,
        Item: evidenceEntry,
      })
    );

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
        UpdateExpression: 'SET updatedAt = :updatedAt',
        ExpressionAttributeValues: { ':updatedAt': now },
      })
    );

    writeAuditEvent({
      eventType: 'evidence.upload_confirmed',
      outcome: 'success',
      actorId: req.user!.userId,
      resourceType: 'inspection_item',
      resourceId: itemId as string,
      details: {
        inspectionId: inspectionId as string,
        evidenceId: evidenceEntry.evidenceId,
      },
    });

    const downloadUrl =
      `/api/evidence/${encodeURIComponent(inspectionId as string)}` +
      `/${encodeURIComponent(evidenceEntry.evidenceId)}/download-url`;

    const signedUrl = await presignEvidenceGet(
      S3_BUCKET_NAME,
      evidenceEntry.objectKey,
      900
    );

    res.status(201).json({
      ...evidenceEntry,
      url: signedUrl,
      downloadUrl,
    });
  } catch (error) {
    next(error);
  }
};

// Provides a short-lived download URL to an authorized inspection participant.
export const getEvidenceDownloadUrl = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId, evidenceId } = req.params;

    const [inspectionResult, evidenceResult] = await Promise.all([
      docClient.send(
        new GetCommand({
          TableName: TABLES.INSPECTIONS,
          Key: { inspectionId },
        })
      ),
      docClient.send(
        new GetCommand({
          TableName: TABLES.EVIDENCE,
          Key: { inspectionId, evidenceId },
        })
      ),
    ]);

    if (!inspectionResult.Item) {
      return res.status(404).json({ message: 'Inspection not found' });
    }

    const inspection = inspectionResult.Item as IInspection;
    const userId = req.user!.userId;

    const isParticipant =
      inspection.landlordId === userId ||
      inspection.tenantId === userId ||
      inspection.participantIds?.includes(userId) === true;

    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: 'Not authorized to view this evidence' });
    }

    const evidence = evidenceResult.Item as IEvidence | undefined;

    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    const url = await presignEvidenceGet(
      S3_BUCKET_NAME,
      evidence.objectKey,
      900
    );

    return res.json({ url, expiresIn: 900 });
  } catch (error) {
    return next(error);
  }
};

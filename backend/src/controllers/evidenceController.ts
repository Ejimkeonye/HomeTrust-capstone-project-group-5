import { Request, Response, NextFunction } from 'express';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IEvidence } from '../types';

const PRESIGNED_UPLOAD_URL = process.env.PRESIGNED_UPLOAD_URL!;
const S3_BUCKET_NAME = 'hometrust-evidence-dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// ─── Helper: build public S3 URL from an object key ───────────────────────────
function buildS3Url(objectKey: string): string {
  return `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${objectKey}`;
}

// ─── Helper: verify the caller is a participant of the inspection ──────────────
async function getInspectionOrThrow(
  inspectionId: string,
  userId: string,
  res: Response
): Promise<IInspection> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.INSPECTIONS, Key: { inspectionId } })
  );

  if (!result.Item) {
    res.status(404);
    throw new Error('Inspection not found');
  }

  const inspection = result.Item as IInspection;
  const isParticipant =
    inspection.landlordId === userId || inspection.tenantId === userId;

  if (!isParticipant) {
    res.status(403);
    throw new Error('Not authorized to upload evidence for this inspection');
  }

  if (inspection.state === 'READ_ONLY') {
    res.status(400);
    throw new Error('Cannot upload evidence to a read-only inspection');
  }

  return inspection;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/evidence/presigned-url
// Body: { file_name: string, content_type: string }
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
    const { file_name, content_type } = req.body;

    if (!file_name || !content_type) {
      res.status(400);
      throw new Error('file_name and content_type are required');
    }

    if (!PRESIGNED_UPLOAD_URL) {
      res.status(500);
      throw new Error('PRESIGNED_UPLOAD_URL is not configured on the server');
    }

    const lambdaResponse = await fetch(PRESIGNED_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name, content_type }),
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
// Builds the permanent S3 URL and saves the evidence entry to DynamoDB.
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
      req.user!.userId,
      res
    );

    const itemIndex = inspection.items.findIndex((i) => i.itemId === itemId);
    if (itemIndex === -1) {
      res.status(404);
      throw new Error('Item not found in this inspection');
    }

    const evidenceEntry: IEvidence = {
      evidenceId: uuidv4(),
      url: buildS3Url(object_key),
      type: content_type.startsWith('video') ? 'video' : 'image',
      uploadedBy: req.user!.userId,
      clientMetadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
      createdAt: new Date().toISOString(),
    };

    const updated = await docClient.send(
      new UpdateCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
        UpdateExpression: `SET #items[${itemIndex}].evidence = list_append(if_not_exists(#items[${itemIndex}].evidence, :empty), :evidence), updatedAt = :updatedAt`,
        ExpressionAttributeNames: {
          '#items': 'items'
        },
        ExpressionAttributeValues: {
          ':evidence': [evidenceEntry],
          ':empty': [],
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const updatedItem = (updated.Attributes as IInspection).items[itemIndex];
    res.status(201).json(updatedItem);
  } catch (error) {
    next(error);
  }
};

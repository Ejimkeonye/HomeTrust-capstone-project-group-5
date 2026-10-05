import { Response, NextFunction } from 'express';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IEvidence } from '../types';

export const uploadEvidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { inspectionId, itemId } = req.params;

    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    const result = await docClient.send(new GetCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
    }));

    if (!result.Item) {
      res.status(404);
      throw new Error('Inspection not found');
    }

    const inspection = result.Item as IInspection;
    const isLandlord = inspection.landlordId === req.user!.userId;
    const isTenant = inspection.tenantId === req.user!.userId;

    if (!isLandlord && !isTenant) {
      res.status(403);
      throw new Error('Not authorized to upload evidence for this inspection');
    }

    if (inspection.state === 'READ_ONLY') {
      res.status(400);
      throw new Error('Cannot upload evidence to a read-only inspection');
    }

    // Find the item index in the items array
    const itemIndex = inspection.items.findIndex(i => i.itemId === itemId);
    if (itemIndex === -1) {
      res.status(404);
      throw new Error('Item not found in this inspection');
    }

    // In production this would be an S3 URL from your cloud teammate's setup
    const fileUrl = `/uploads/${req.file.filename}`;

    const evidenceEntry: IEvidence = {
      evidenceId: uuidv4(),
      url: fileUrl,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
      uploadedBy: req.user!.userId,
      clientMetadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
      createdAt: new Date().toISOString(),
    };

    // Append evidence to the specific item using its index in the array
    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
      UpdateExpression: `SET items[${itemIndex}].evidence = list_append(if_not_exists(items[${itemIndex}].evidence, :empty), :evidence), updatedAt = :updatedAt`,
      ExpressionAttributeValues: {
        ':evidence': [evidenceEntry],
        ':empty': [],
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }));

    const updatedItem = (updated.Attributes as IInspection).items[itemIndex];
    res.status(201).json(updatedItem);
  } catch (error) {
    next(error);
  }
};

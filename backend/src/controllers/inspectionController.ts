import { Response, NextFunction } from 'express';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IItemCondition } from '../types';

export const createInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyId, mode } = req.body;

    // Verify property exists and requester is the owner
    const propResult = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
    }));

    if (!propResult.Item || propResult.Item.ownerId !== req.user!.userId) {
      res.status(403);
      throw new Error('Not authorized for this property');
    }

    const now = new Date().toISOString();
    const inspectionId = uuidv4();

    const newInspection: IInspection = {
      inspectionId,
      propertyId,
      landlordId: req.user!.userId,
      mode: mode || 'Full',
      state: 'DRAFT',
      items: [],
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.INSPECTIONS,
      Item: newInspection,
    }));

    res.status(201).json(newInspection);
  } catch (error) {
    next(error);
  }
};

export const getInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId: req.params.id },
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
      throw new Error('Not authorized to access this inspection');
    }

    res.json(inspection);
  } catch (error) {
    next(error);
  }
};

export const updateInspectionState = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { state } = req.body;
    const validStates = ['DRAFT', 'IN_PROGRESS', 'UNDER_REVIEW', 'READ_ONLY'];

    if (!validStates.includes(state)) {
      res.status(400);
      throw new Error(`Invalid state. Must be one of: ${validStates.join(', ')}`);
    }

    const result = await docClient.send(new GetCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId: req.params.id },
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
      throw new Error('Not authorized');
    }

    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId: req.params.id },
      UpdateExpression: 'SET #state = :state, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#state': 'state' }, // 'state' is a reserved word
      ExpressionAttributeValues: {
        ':state': state,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }));

    res.json(updated.Attributes);
  } catch (error) {
    next(error);
  }
};

export const addItemCondition = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, itemName, condition, notes } = req.body;
    const validConditions = ['Good', 'Fair', 'Damaged', 'N/A'];

    if (!validConditions.includes(condition)) {
      res.status(400);
      throw new Error(`Invalid condition. Must be one of: ${validConditions.join(', ')}`);
    }

    const result = await docClient.send(new GetCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId: req.params.id },
    }));

    if (!result.Item) {
      res.status(404);
      throw new Error('Inspection not found');
    }

    const inspection = result.Item as IInspection;

    if (inspection.state === 'READ_ONLY') {
      res.status(400);
      throw new Error('Cannot modify a read-only inspection');
    }

    const isLandlord = inspection.landlordId === req.user!.userId;
    const isTenant = inspection.tenantId === req.user!.userId;
    if (!isLandlord && !isTenant) {
      res.status(403);
      throw new Error('Not authorized to modify this inspection');
    }

    const newItem: IItemCondition = {
      itemId: uuidv4(),
      roomId,
      itemName,
      condition,
      notes,
      evidence: [],
    };

    // DynamoDB list_append adds new item to the items array
    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId: req.params.id },
      UpdateExpression: 'SET #items = list_append(if_not_exists(#items, :empty), :newItem), updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#items': 'items'
      },
      ExpressionAttributeValues: {
        ':newItem': [newItem],
        ':empty': [],
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }));

    res.status(201).json(updated.Attributes);
  } catch (error) {
    next(error);
  }
};

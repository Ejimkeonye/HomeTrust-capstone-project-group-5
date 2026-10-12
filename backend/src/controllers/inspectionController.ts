import { Response, NextFunction } from 'express';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IItemCondition, IProperty, IEvidence, InspectionCondition } from '../types';
import { writeAuditEvent } from '../utils/auditLogger';

const VALID_CONDITIONS: InspectionCondition[] = ['no_issue', 'stains', 'cracks', 'broken'];

async function loadInspection(inspectionId: string): Promise<IInspection | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: TABLES.INSPECTIONS, Key: { inspectionId } }));
  if (!result.Item) return undefined;
  const inspection = result.Item as IInspection;
  const [roomsResult, evidenceResult] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: TABLES.ROOM_ITEMS,
      KeyConditionExpression: 'inspectionId = :inspectionId',
      ExpressionAttributeValues: { ':inspectionId': inspectionId },
    })),
    docClient.send(new QueryCommand({
      TableName: TABLES.EVIDENCE,
      KeyConditionExpression: 'inspectionId = :inspectionId',
      ExpressionAttributeValues: { ':inspectionId': inspectionId },
    })),
  ]);
  const evidenceByRoomItem = new Map<string, IEvidence[]>();
  for (const evidence of (evidenceResult.Items || []) as IEvidence[]) {
    const list = evidenceByRoomItem.get(evidence.roomItemId) || [];
    list.push(evidence);
    evidenceByRoomItem.set(evidence.roomItemId, list);
  }
  const separateItems = ((roomsResult.Items || []) as IItemCondition[]).map(item => ({
    ...item,
    itemId: item.itemId || item.roomItemId,
    evidence: evidenceByRoomItem.get(item.roomItemId) || [],
  }));
  // Preserve visibility of older inspections whose items were stored inline.
  inspection.items = separateItems.length ? separateItems : (inspection.items || []);
  return inspection;
}

function canAccess(inspection: IInspection, userId: string): boolean {
  return inspection.landlordId === userId || inspection.tenantId === userId;
}

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

    writeAuditEvent({ eventType: 'inspection.created', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection', resourceId: inspectionId, details: { propertyId } });

    res.status(201).json(newInspection);
  } catch (error) {
    next(error);
  }
};

export const getInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadInspection(req.params.id as string);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to access this inspection' });
    res.json(inspection);
  } catch (error) {
    next(error);
  }
};

export const getPropertyInspections = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.params.propertyId as string;
    const propertyResult = await docClient.send(new GetCommand({ TableName: TABLES.PROPERTIES, Key: { propertyId } }));
    const property = propertyResult.Item as IProperty | undefined;
    if (!property) return res.status(404).json({ message: 'Property not found' });
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.INSPECTIONS,
      IndexName: 'byProperty',
      KeyConditionExpression: 'propertyId = :propertyId',
      ExpressionAttributeValues: { ':propertyId': propertyId },
    }));
    const visible = ((result.Items || []) as IInspection[]).filter(item => canAccess(item, req.user!.userId));
    if (property.ownerId !== req.user!.userId && visible.length === 0) return res.status(403).json({ message: 'Not authorized for this property' });
    const loaded = await Promise.all(visible.map(item => loadInspection(item.inspectionId)));
    const inspections = loaded.filter(Boolean) as IInspection[];
    res.json({ inspections, total: inspections.length });
  } catch (error) { next(error); }
};

export const updateInspectionState = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { state } = req.body;
    const validStates = ['DRAFT', 'IN_PROGRESS', 'UNDER_REVIEW', 'READ_ONLY'];

    if (!validStates.includes(state)) {
      res.status(400);
      throw new Error(`Invalid state. Must be one of: ${validStates.join(', ')}`);
    }

    const inspection = await loadInspection(req.params.id as string);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized' });
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is already read-only' });
    if (state === 'READ_ONLY' && inspection.landlordId !== req.user!.userId) return res.status(403).json({ message: 'Only the inspection owner can finalize it' });

    const previousState = inspection.state;
    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId: req.params.id as string },
      UpdateExpression: 'SET #state = :state, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#state': 'state' }, // 'state' is a reserved word
      ExpressionAttributeValues: {
        ':state': state,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }));

    writeAuditEvent({ eventType: 'inspection.state_changed', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection', resourceId: req.params.id as string, details: { previousState, newState: state } });

    res.json(updated.Attributes);
  } catch (error) {
    next(error);
  }
};

export const addItemCondition = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, itemName, condition, notes } = req.body;
    if (!roomId || !itemName || !VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({ message: 'roomId, itemName, and a valid condition are required', validConditions: VALID_CONDITIONS });
    }
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) return res.status(400).json({ message: 'notes must be text up to 2000 characters' });

    const inspectionId = req.params.id as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to modify this inspection' });
    if (inspection.state === 'READ_ONLY' || inspection.state === 'UNDER_REVIEW') return res.status(409).json({ message: 'Inspection cannot be changed in its current state' });

    const propertyResult = await docClient.send(new GetCommand({ TableName: TABLES.PROPERTIES, Key: { propertyId: inspection.propertyId } }));
    const property = propertyResult.Item as IProperty | undefined;
    const room = property?.rooms?.find(r => r.roomId === roomId || r.name.toLowerCase() === String(roomId).toLowerCase());
    if (!room) return res.status(400).json({ message: 'roomId does not belong to this property' });

    const now = new Date().toISOString();
    const roomItemId = uuidv4();
    const newItem: IItemCondition = {
      inspectionId, roomItemId, itemId: roomItemId, roomId: room.roomId,
      itemName: String(itemName).trim(), condition, notes: notes?.trim() || undefined,
      evidence: [], createdAt: now, updatedAt: now,
    };
    await docClient.send(new PutCommand({ TableName: TABLES.ROOM_ITEMS, Item: newItem }));
    await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
      UpdateExpression: 'SET #state = :state, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#state': 'state' },
      ExpressionAttributeValues: { ':state': 'IN_PROGRESS', ':updatedAt': now },
    }));
    writeAuditEvent({ eventType: 'inspection.item_added', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection', resourceId: inspectionId, details: { itemId: roomItemId } });
    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
};

export const updateItemCondition = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { condition, notes } = req.body;
    if (condition !== undefined && !VALID_CONDITIONS.includes(condition)) return res.status(400).json({ message: 'Invalid condition', validConditions: VALID_CONDITIONS });
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) return res.status(400).json({ message: 'notes must be text up to 2000 characters' });
    const inspectionId = req.params.id as string;
    const roomItemId = req.params.itemId as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to modify this inspection' });
    if (inspection.state === 'READ_ONLY' || inspection.state === 'UNDER_REVIEW') return res.status(409).json({ message: 'Inspection cannot be changed in its current state' });
    if (!inspection.items.some(item => item.roomItemId === roomItemId)) return res.status(404).json({ message: 'Room item not found' });

    const now = new Date().toISOString();
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, any> = { ':updatedAt': now };
    const fields = ['#updatedAt = :updatedAt'];
    if (condition !== undefined) { names['#condition'] = 'condition'; values[':condition'] = condition; fields.push('#condition = :condition'); }
    if (notes !== undefined) { names['#notes'] = 'notes'; values[':notes'] = notes.trim(); fields.push('#notes = :notes'); }
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLES.ROOM_ITEMS, Key: { inspectionId, roomItemId },
      UpdateExpression: 'SET ' + fields.join(', '), ExpressionAttributeNames: names,
      ExpressionAttributeValues: values, ConditionExpression: 'attribute_exists(roomItemId)', ReturnValues: 'ALL_NEW',
    }));
    await docClient.send(new UpdateCommand({ TableName: TABLES.INSPECTIONS, Key: { inspectionId }, UpdateExpression: 'SET updatedAt = :updatedAt', ExpressionAttributeValues: { ':updatedAt': now } }));
    writeAuditEvent({ eventType: 'inspection.item_updated', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection_item', resourceId: roomItemId, details: { inspectionId } });
    res.json({ ...result.Attributes, itemId: roomItemId, evidence: inspection.items.find(item => item.roomItemId === roomItemId)?.evidence || [] });
  } catch (error) { next(error); }
};

export const submitInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspectionId = req.params.id as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (inspection.landlordId !== req.user!.userId) return res.status(403).json({ message: 'Only the inspection owner can submit it' });
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is already finalized' });
    if (inspection.items.length === 0) return res.status(400).json({ message: 'Add at least one room item before submitting' });
    const now = new Date().toISOString();
    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS, Key: { inspectionId },
      UpdateExpression: 'SET #state = :state, submittedAt = :submittedAt, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#state': 'state' },
      ExpressionAttributeValues: { ':state': 'UNDER_REVIEW', ':submittedAt': now, ':updatedAt': now },
      ReturnValues: 'ALL_NEW',
    }));
    writeAuditEvent({ eventType: 'inspection.submitted', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection', resourceId: inspectionId });
    res.json({ ...updated.Attributes, items: inspection.items });
  } catch (error) { next(error); }
};

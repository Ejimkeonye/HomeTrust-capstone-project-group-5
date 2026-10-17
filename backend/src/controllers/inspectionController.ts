import { Response, NextFunction } from 'express';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IItemCondition, IProperty, IEvidence, InspectionCondition } from '../types';
import { writeAuditEvent } from '../utils/auditLogger';
import { createInspectionPdf } from '../utils/inspectionPdf';
import { presignEvidenceGet } from '../utils/s3Presigner';

const VALID_CONDITIONS: InspectionCondition[] = ['no_issue', 'stains', 'cracks', 'broken'];
const evidenceBucket = process.env.EVIDENCE_BUCKET_NAME || 'hometrust-evidence-dev';

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
  const evidenceRecords = await Promise.all(((evidenceResult.Items || []) as IEvidence[]).map(async evidence => ({
    ...evidence,
    ...(evidence.objectKey ? { url: await presignEvidenceGet(evidenceBucket, evidence.objectKey, 900) } : {}),
    downloadUrl: `/api/evidence/${encodeURIComponent(inspectionId)}/${encodeURIComponent(evidence.evidenceId)}/download-url`,
  })));
  for (const evidence of evidenceRecords) {
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
  if (separateItems.length) {
    inspection.items = separateItems;
  } else {
    inspection.items = await Promise.all((inspection.items || []).map(async item => ({
      ...item,
      evidence: await Promise.all((item.evidence || []).map(async evidence => ({
        ...evidence,
        ...(evidence.objectKey ? { url: await presignEvidenceGet(evidenceBucket, evidence.objectKey, 900) } : {}),
        downloadUrl: `/api/evidence/${encodeURIComponent(inspectionId)}/${encodeURIComponent(evidence.evidenceId)}/download-url`,
      }))),
    })));
  }
  return inspection;
}

function canAccess(inspection: IInspection, userId: string): boolean {
  return inspection.landlordId === userId || inspection.tenantId === userId || inspection.participantIds?.includes(userId) === true;
}

function approvalSummary(inspection: IInspection) {
  const totalParties = [...new Set([inspection.landlordId, inspection.tenantId, ...(inspection.participantIds || [])].filter(Boolean))].length;
  const approvedCount = inspection.approvalCount || inspection.approvals?.length || 0;
  return { approvedCount, totalParties, fullyAcknowledged: totalParties > 0 && approvedCount >= totalParties };
}

export const createInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyId, mode, participantIds } = req.body;
    if (participantIds !== undefined && (!Array.isArray(participantIds) || participantIds.some((id: unknown) => typeof id !== 'string' || !id.trim()))) {
      return res.status(400).json({ message: 'participantIds must be an array of user IDs' });
    }

    // Verify property exists and requester is the owner
    const propResult = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
    }));

    if (!propResult.Item || propResult.Item.ownerId !== req.user!.userId) {
      res.status(403);
      throw new Error('Not authorized for this property');
    }
    const selectedParticipantIds: string[] = [...new Set<string>((participantIds || []).filter((id: string) => id !== req.user!.userId))];
    if (selectedParticipantIds.length) {
      const participantResults = await Promise.all(selectedParticipantIds.map(userId =>
        docClient.send(new GetCommand({ TableName: TABLES.USERS, Key: { userId } })),
      ));
      if (participantResults.some(result => !result.Item)) return res.status(400).json({ message: 'Every participantIds entry must identify an existing user' });
    }

    const now = new Date().toISOString();
    const inspectionId = uuidv4();

    const newInspection: IInspection = {
      inspectionId,
      propertyId,
      ...(req.user!.role === 'Tenant' ? { tenantId: req.user!.userId } : { landlordId: req.user!.userId }),
      createdBy: req.user!.userId,
      participantIds: selectedParticipantIds,
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
    res.json({ ...inspection, approvalSummary: approvalSummary(inspection) });
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
    const inspections = (loaded.filter(Boolean) as IInspection[]).map(inspection => ({
      ...inspection,
      approvalSummary: approvalSummary(inspection),
    }));
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
    if (state === 'READ_ONLY' && (inspection.createdBy || inspection.landlordId) !== req.user!.userId) return res.status(403).json({ message: 'Only the inspection creator can finalize it' });

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
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is locked and cannot be changed' });

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
    const nextState = inspection.state === 'DRAFT' ? 'IN_PROGRESS' : inspection.state;
    await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
      UpdateExpression: 'SET #state = :state, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#state': 'state' },
      ExpressionAttributeValues: { ':state': nextState, ':updatedAt': now },
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
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is locked and cannot be changed' });
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
    if ((inspection.createdBy || inspection.landlordId) !== req.user!.userId) return res.status(403).json({ message: 'Only the inspection creator can submit it' });
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

/** Record an ACCEPTED or DISPUTED decision on one room item and its attached evidence. */
export const reviewInspectionItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { decision, note } = req.body;
    if (decision !== 'ACCEPTED' && decision !== 'DISPUTED') return res.status(400).json({ message: 'decision must be ACCEPTED or DISPUTED' });
    if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) return res.status(400).json({ message: 'note must be text up to 2000 characters' });
    const inspectionId = req.params.id as string;
    const roomItemId = req.params.itemId as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to review this inspection' });
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is finalized' });
    if (!inspection.items.some(item => item.roomItemId === roomItemId)) return res.status(404).json({ message: 'Room item not found' });
    const reviewedAt = new Date().toISOString();
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLES.ROOM_ITEMS,
      Key: { inspectionId, roomItemId },
      UpdateExpression: 'SET reviewStatus = :decision, reviewedBy = :reviewer, reviewedAt = :reviewedAt, reviewNote = :note, disputed = :disputed, updatedAt = :reviewedAt',
      ExpressionAttributeValues: { ':decision': decision, ':reviewer': req.user!.userId, ':reviewedAt': reviewedAt, ':note': typeof note === 'string' ? note.trim() : '', ':disputed': decision === 'DISPUTED' },
      ConditionExpression: 'attribute_exists(roomItemId)',
      ReturnValues: 'ALL_NEW',
    }));
    writeAuditEvent({ eventType: `inspection.evidence_${decision.toLowerCase()}`, outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection_item', resourceId: roomItemId, details: { inspectionId } });
    return res.json({ ...result.Attributes, itemId: roomItemId, evidence: inspection.items.find(item => item.roomItemId === roomItemId)?.evidence || [] });
  } catch (error) { return next(error); }
};

/** Apply the gallery Accept/Dispute decision to every evidence-bearing item in one room. */
export const reviewRoomEvidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { decision, note } = req.body;
    if (decision !== 'ACCEPTED' && decision !== 'DISPUTED') return res.status(400).json({ message: 'decision must be ACCEPTED or DISPUTED' });
    if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) return res.status(400).json({ message: 'note must be text up to 2000 characters' });
    const inspectionId = req.params.id as string;
    const roomId = req.params.roomId as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to review this inspection' });
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is finalized' });
    const roomItems = inspection.items.filter(item => item.roomId === roomId && item.evidence?.length);
    if (!roomItems.length) return res.status(404).json({ message: 'No evidence found for this room' });
    const reviewedAt = new Date().toISOString();
    await docClient.send(new TransactWriteCommand({
      TransactItems: roomItems.map(item => ({
        Update: {
          TableName: TABLES.ROOM_ITEMS,
          Key: { inspectionId, roomItemId: item.roomItemId },
          UpdateExpression: 'SET reviewStatus = :decision, reviewedBy = :reviewer, reviewedAt = :reviewedAt, reviewNote = :note, disputed = :disputed, updatedAt = :reviewedAt',
          ExpressionAttributeValues: { ':decision': decision, ':reviewer': req.user!.userId, ':reviewedAt': reviewedAt, ':note': typeof note === 'string' ? note.trim() : '', ':disputed': decision === 'DISPUTED' },
          ConditionExpression: 'attribute_exists(roomItemId)',
        },
      })),
    }));
    writeAuditEvent({ eventType: `inspection.room_evidence_${decision.toLowerCase()}`, outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection_room', resourceId: roomId, details: { inspectionId, itemCount: roomItems.length } });
    return res.json({ inspectionId, roomId, decision, reviewedBy: req.user!.userId, reviewedAt, reviewedItemCount: roomItems.length });
  } catch (error) { return next(error); }
};

/** A user can acknowledge a submitted inspection once. The update is atomic in DynamoDB. */
export const approveInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspectionId = req.params.id as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to acknowledge this inspection' });
    if (inspection.state !== 'UNDER_REVIEW') return res.status(409).json({ message: 'Only inspections under review can be acknowledged' });
    if (!inspection.landlordId || !inspection.tenantId) return res.status(409).json({ message: 'Both landlord and tenant must be linked before acknowledgement' });
    if (inspection.approvedBy?.includes(req.user!.userId)) return res.status(409).json({ message: 'You already acknowledged this inspection' });
    const approvedAt = new Date().toISOString();
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS, Key: { inspectionId },
      UpdateExpression: 'SET approvedBy = list_append(if_not_exists(approvedBy, :empty), :newUser), approvals = list_append(if_not_exists(approvals, :emptyApprovals), :newApproval), approvalCount = if_not_exists(approvalCount, :zero) + :one, updatedAt = :now',
      ExpressionAttributeValues: { ':empty': [], ':newUser': [req.user!.userId], ':emptyApprovals': [], ':newApproval': [{ userId: req.user!.userId, approvedAt }], ':zero': 0, ':one': 1, ':now': approvedAt, ':userId': req.user!.userId },
      ConditionExpression: 'attribute_exists(inspectionId) AND (attribute_not_exists(approvedBy) OR NOT contains(approvedBy, :userId))',
      ReturnValues: 'ALL_NEW',
    }));
    const saved = result.Attributes as IInspection;
    const totalParties = [...new Set([saved.landlordId, saved.tenantId, ...(saved.participantIds || [])].filter(Boolean))].length;
    const approvalCount = saved.approvalCount || 0;
    const fullyAcknowledged = totalParties > 0 && approvalCount >= totalParties;
    if (fullyAcknowledged) await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS, Key: { inspectionId },
      UpdateExpression: 'SET #state = :finalState, updatedAt = :now',
      ExpressionAttributeNames: { '#state': 'state' },
      ExpressionAttributeValues: { ':finalState': 'READ_ONLY', ':now': new Date().toISOString() },
    }));
    writeAuditEvent({ eventType: 'inspection.acknowledged', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection', resourceId: inspectionId, details: { approvalCount, totalParties } });
    return res.status(201).json({ inspectionId, approvals: saved.approvals || [], approvalCount, totalParties, fullyAcknowledged, state: fullyAcknowledged ? 'READ_ONLY' : saved.state });
  } catch (error) {
    if ((error as { name?: string }).name === 'ConditionalCheckFailedException') return res.status(409).json({ message: 'You already acknowledged this inspection' });
    return next(error);
  }
};

/** Download a PDF report containing conditions, reviews, and acknowledgement count. */
export const downloadInspectionReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadInspection(req.params.id as string);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to download this report' });
    const pdf = createInspectionPdf(inspection);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inspection-${inspection.inspectionId}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error) { return next(error); }
};

import { Response, NextFunction } from 'express';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IInspectionSignature, IItemCondition, IProperty, IEvidence, InspectionCondition, ItemStatus, IItemDispute, DisputeSeverity } from '../types';
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
  const [landlordSignature, tenantSignature] = await Promise.all([
    inspection.landlordSignature?.uploadedAt
      ? { ...inspection.landlordSignature, url: await presignEvidenceGet(evidenceBucket, inspection.landlordSignature.objectKey, 900) }
      : undefined,
    inspection.tenantSignature?.uploadedAt
      ? { ...inspection.tenantSignature, url: await presignEvidenceGet(evidenceBucket, inspection.tenantSignature.objectKey, 900) }
      : undefined,
  ]);
  inspection.landlordSignature = landlordSignature;
  inspection.tenantSignature = tenantSignature;
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

function parseSignatureImage(value: unknown): { contentType: 'image/png' | 'image/jpeg'; bytes: Buffer } | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return undefined;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > 1024 * 1024 || bytes.toString('base64') !== match[2]) return undefined;
  const isPng = match[1] === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = match[1] === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return isPng || isJpeg ? { contentType: match[1] as 'image/png' | 'image/jpeg', bytes } : undefined;
}

async function requestSignatureUpload(fileName: string, contentType: string, authorization: string): Promise<{ uploadUrl: string; objectKey: string }> {
  const uploadServiceUrl = process.env.PRESIGNED_UPLOAD_URL;
  if (!uploadServiceUrl) throw new Error('PRESIGNED_UPLOAD_URL is not configured');
  if (!authorization) throw new Error('Authorization token is required for signature upload');
  const response = await fetch(uploadServiceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify({ file_name: fileName, content_type: contentType }),
  });
  if (!response.ok) {
    const upstreamBody = await response.text().catch(() => '');
    console.error('Signature upload service rejected request:', response.status, upstreamBody.slice(0, 300));
    throw new Error('Signature upload service failed');
  }
  const result = await response.json() as { upload_url?: unknown; object_key?: unknown };
  if (typeof result.upload_url !== 'string' || typeof result.object_key !== 'string' ||
      !result.object_key.startsWith('evidence/signatures/')) {
    throw new Error('Signature upload service returned an invalid S3 location');
  }
  return { uploadUrl: result.upload_url, objectKey: result.object_key };
}

async function removeSignatureReservation(inspectionId: string, signatureField: 'landlordSignature' | 'tenantSignature', objectKey: string): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
      UpdateExpression: 'REMOVE #signature',
      ExpressionAttributeNames: { '#signature': signatureField },
      ExpressionAttributeValues: { ':objectKey': objectKey },
      ConditionExpression: '#signature.objectKey = :objectKey',
    }));
  } catch (cleanupError) {
    console.error('Failed to remove incomplete signature metadata:', cleanupError);
  }
}
export const saveInspectionSignature = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((field) => field !== 'signature')) {
      return res.status(400).json({ message: 'Send only the signature image in the signature field' });
    }
    const image = parseSignatureImage(body.signature);
    if (!image) {
      return res.status(400).json({ message: 'signature must be a PNG or JPEG data URL no larger than 1 MB' });
    }

    const inspectionId = req.params.id as string;
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
    }));
    const inspection = result.Item as IInspection | undefined;
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });

    let role: 'Landlord' | 'Tenant';
    let signatureField: 'landlordSignature' | 'tenantSignature';
    let linkedPartyField: 'landlordId' | 'tenantId';
    if (inspection.landlordId === req.user!.userId && inspection.tenantId !== req.user!.userId) {
      role = 'Landlord';
      signatureField = 'landlordSignature';
      linkedPartyField = 'landlordId';
    } else if (inspection.tenantId === req.user!.userId && inspection.landlordId !== req.user!.userId) {
      role = 'Tenant';
      signatureField = 'tenantSignature';
      linkedPartyField = 'tenantId';
    } else {
      return res.status(403).json({ message: 'Only the linked landlord or tenant can sign this inspection' });
    }
    if (inspection.state !== 'UNDER_REVIEW') {
      return res.status(409).json({ message: 'Signatures can be added only while the inspection is under review' });
    }
    if (inspection[signatureField]) {
      return res.status(409).json({ message: 'You have already signed this inspection' });
    }

    const safeInspectionId = inspectionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const extension = image.contentType === 'image/png' ? 'png' : 'jpg';
    const fileName = 'signatures/' + safeInspectionId + '/' + role.toLowerCase() + '/' + uuidv4() + '.' + extension;
    const target = await requestSignatureUpload(fileName, image.contentType, req.headers.authorization || '');
    const signedAt = new Date().toISOString();
    const signature: IInspectionSignature = {
      userId: req.user!.userId,
      role,
      name: req.user!.name || req.user!.email,
      signedAt,
      objectKey: target.objectKey,
      contentType: image.contentType,
    };

    let savedInspection: IInspection;
    try {
      const saved = await docClient.send(new UpdateCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
        UpdateExpression: 'SET #signature = :signature, updatedAt = :signedAt',
        ExpressionAttributeNames: { '#signature': signatureField, '#state': 'state', '#linkedParty': linkedPartyField },
        ExpressionAttributeValues: { ':signature': signature, ':signedAt': signedAt, ':underReview': 'UNDER_REVIEW', ':userId': req.user!.userId },
        ConditionExpression: 'attribute_not_exists(#signature) AND #state = :underReview AND #linkedParty = :userId',
        ReturnValues: 'ALL_NEW',
      }));
      savedInspection = saved.Attributes as IInspection;
    } catch (error) {
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
        return res.status(409).json({ message: 'Inspection state changed or this party has already signed' });
      }
      throw error;
    }

    let uploadSucceeded: boolean;
    try {
      const uploadResponse = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': image.contentType },
        body: image.bytes as unknown as BodyInit,
      });
      uploadSucceeded = uploadResponse.ok;
    } catch (uploadError) {
      await removeSignatureReservation(inspectionId, signatureField, target.objectKey);
      return next(uploadError);
    }
    if (!uploadSucceeded) {
      await removeSignatureReservation(inspectionId, signatureField, target.objectKey);
      return res.status(502).json({ message: 'Could not store signature image' });
    }
    let finalInspection = savedInspection;
    try {
      const completed = await docClient.send(new UpdateCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
        UpdateExpression: 'SET #signature.#uploadedAt = :uploadedAt, updatedAt = :uploadedAt',
        ExpressionAttributeNames: { '#signature': signatureField, '#uploadedAt': 'uploadedAt' },
        ExpressionAttributeValues: { ':uploadedAt': new Date().toISOString(), ':objectKey': target.objectKey },
        ConditionExpression: '#signature.objectKey = :objectKey',
        ReturnValues: 'ALL_NEW',
      }));
      finalInspection = completed.Attributes as IInspection;
    } catch (error) {
      await removeSignatureReservation(inspectionId, signatureField, target.objectKey);
      throw error;
    }
    if (finalInspection.landlordSignature?.uploadedAt && finalInspection.tenantSignature?.uploadedAt) {
      const finalized = await docClient.send(new UpdateCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
        UpdateExpression: 'SET #state = :readOnly, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':readOnly': 'READ_ONLY', ':underReview': 'UNDER_REVIEW', ':updatedAt': new Date().toISOString() },
        ConditionExpression: '#state = :underReview AND attribute_exists(landlordSignature.uploadedAt) AND attribute_exists(tenantSignature.uploadedAt)',
        ReturnValues: 'ALL_NEW',
      }));
      finalInspection = finalized.Attributes as IInspection;
    }

    const [landlordSignature, tenantSignature] = await Promise.all([
      finalInspection.landlordSignature?.uploadedAt
        ? { ...finalInspection.landlordSignature, url: await presignEvidenceGet(evidenceBucket, finalInspection.landlordSignature.objectKey, 900) }
        : undefined,
      finalInspection.tenantSignature?.uploadedAt
        ? { ...finalInspection.tenantSignature, url: await presignEvidenceGet(evidenceBucket, finalInspection.tenantSignature.objectKey, 900) }
        : undefined,
    ]);
    writeAuditEvent({
      eventType: 'inspection.signature_saved',
      outcome: 'success',
      actorId: req.user!.userId,
      resourceType: 'inspection',
      resourceId: inspectionId,
      details: { role },
    });

    return res.status(201).json({
      message: 'Signature saved successfully',
      inspectionId,
      signatures: { landlord: landlordSignature?.uploadedAt ? landlordSignature : null, tenant: tenantSignature?.uploadedAt ? tenantSignature : null },
      signingStatus: {
        landlordSigned: Boolean(landlordSignature?.uploadedAt),
        tenantSigned: Boolean(tenantSignature?.uploadedAt),
        fullySigned: Boolean(landlordSignature?.uploadedAt && tenantSignature?.uploadedAt),
      },
      approvalSummary: approvalSummary(finalInspection),
      state: finalInspection.state,
    });
  } catch (error) {
    return next(error);
  }
};
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
      ...(req.user!.role === 'Tenant'
        ? { tenantId: req.user!.userId, tenantRole: req.user!.role }
        : { landlordId: req.user!.userId, landlordRole: req.user!.role }),
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
    if (state === 'READ_ONLY' && (!inspection.landlordSignature?.uploadedAt || !inspection.tenantSignature?.uploadedAt)) return res.status(409).json({ message: 'Both landlord and tenant must sign before finalization' });

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
      ...(state === 'READ_ONLY' ? { ConditionExpression: 'attribute_exists(landlordSignature.uploadedAt) AND attribute_exists(tenantSignature.uploadedAt)' } : {}),
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
      status: condition === 'no_issue' ? 'Normal' : 'Under Review',
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
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ message: 'Request body must be an object' });
    const allowedFields = new Set(['condition', 'notes', 'dispute', 'status']);
    const unsupportedFields = Object.keys(body).filter(field => !allowedFields.has(field));
    if (unsupportedFields.length) return res.status(400).json({ message: 'Only condition, notes, dispute, and status can be updated here', fields: unsupportedFields });
    if (Object.keys(body).length === 0) return res.status(400).json({ message: 'Provide at least one item field to update' });

    const { condition, notes, status } = body;
    if (condition !== undefined && !VALID_CONDITIONS.includes(condition)) return res.status(400).json({ message: 'Invalid condition', validConditions: VALID_CONDITIONS });
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) return res.status(400).json({ message: 'notes must be text up to 2000 characters' });
    const validStatuses: ItemStatus[] = ['Normal', 'Under Review'];
    if (status !== undefined && !validStatuses.includes(status)) return res.status(400).json({ message: 'status must be Normal or Under Review', validStatuses });

    const hasDispute = Object.prototype.hasOwnProperty.call(body, 'dispute');
    let dispute: IItemDispute | undefined;
    if (hasDispute && body.dispute !== null) {
      const input = body.dispute;
      const validSeverities: DisputeSeverity[] = ['Minor', 'Moderate', 'Major', 'Critical'];
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          typeof input.description !== 'string' || !input.description.trim() || input.description.length > 2000 ||
          !validSeverities.includes(input.severity)) {
        return res.status(400).json({ message: 'dispute must include a description and valid severity', validSeverities });
      }
      // Use authenticated identity and server time; do not trust client-supplied attribution.
      dispute = {
        description: input.description.trim(),
        severity: input.severity,
        raisedBy: req.user!.role,
        timestamp: new Date().toISOString(),
      };
    }

    const inspectionId = req.params.id as string;
    const roomItemId = req.params.itemId as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to modify this inspection' });
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is locked and cannot be changed' });
    const existingItem = inspection.items.find(item => item.roomItemId === roomItemId);
    if (!existingItem) return res.status(404).json({ message: 'Room item not found' });

    const now = new Date().toISOString();
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, any> = { ':updatedAt': now };
    const updates = ['#updatedAt = :updatedAt'];
    const removals: string[] = [];
    if (condition !== undefined) { names['#condition'] = 'condition'; values[':condition'] = condition; updates.push('#condition = :condition'); }
    if (notes !== undefined) { names['#notes'] = 'notes'; values[':notes'] = notes.trim(); updates.push('#notes = :notes'); }
    if (status !== undefined) { names['#status'] = 'status'; values[':status'] = status; updates.push('#status = :status'); }
    if (hasDispute) {
      names['#dispute'] = 'dispute';
      if (body.dispute === null) removals.push('#dispute');
      else { values[':dispute'] = dispute; updates.push('#dispute = :dispute'); }
    }
    const updateExpression = 'SET ' + updates.join(', ') + (removals.length ? ' REMOVE ' + removals.join(', ') : '');
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLES.ROOM_ITEMS, Key: { inspectionId, roomItemId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(roomItemId)',
      ReturnValues: 'ALL_NEW',
    }));
    await docClient.send(new UpdateCommand({ TableName: TABLES.INSPECTIONS, Key: { inspectionId }, UpdateExpression: 'SET updatedAt = :updatedAt', ExpressionAttributeValues: { ':updatedAt': now } }));
    writeAuditEvent({ eventType: 'inspection.item_updated', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection_item', resourceId: roomItemId, details: { inspectionId } });
    return res.json({ ...result.Attributes, itemId: roomItemId, evidence: existingItem.evidence || [] });
  } catch (error) { return next(error); }
};

export const deleteItemCondition = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspectionId = req.params.id as string;
    const roomItemId = req.params.itemId as string;
    const inspection = await loadInspection(inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (!canAccess(inspection, req.user!.userId)) return res.status(403).json({ message: 'Not authorized to modify this inspection' });
    if (inspection.state === 'READ_ONLY') return res.status(409).json({ message: 'Inspection is locked and cannot be changed' });
    if (!inspection.items.some(item => item.roomItemId === roomItemId)) return res.status(404).json({ message: 'Room item not found' });

    await docClient.send(new DeleteCommand({
      TableName: TABLES.ROOM_ITEMS,
      Key: { inspectionId, roomItemId },
      ConditionExpression: 'attribute_exists(roomItemId)',
    }));
    const now = new Date().toISOString();
    await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: { ':updatedAt': now },
    }));
    writeAuditEvent({ eventType: 'inspection.item_deleted', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection_item', resourceId: roomItemId, details: { inspectionId } });
    return res.json({ success: true, roomItemId });
  } catch (error) {
    if ((error as { name?: string }).name === 'ConditionalCheckFailedException') return res.status(404).json({ message: 'Room item not found' });
    return next(error);
  }
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
    writeAuditEvent({ eventType: 'inspection.acknowledged', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection', resourceId: inspectionId, details: { approvalCount, totalParties } });
    return res.status(201).json({ inspectionId, approvals: saved.approvals || [], approvalCount, totalParties, fullyAcknowledged, state: saved.state });
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
    const signatureImages = await Promise.all(
      ([inspection.landlordSignature, inspection.tenantSignature]
        .filter((signature): signature is IInspectionSignature & { url: string } => Boolean(signature?.uploadedAt && signature.url)))
        .map(async (signature) => {
          const response = await fetch(signature.url);
          if (!response.ok) throw new Error('Could not load a saved signature image for the report');
          return {
            role: signature.role,
            name: signature.name,
            signedAt: signature.signedAt,
            contentType: signature.contentType,
            bytes: Buffer.from(await response.arrayBuffer()),
          };
        }),
    );
    const pdf = createInspectionPdf(inspection, signatureImages);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inspection-${inspection.inspectionId}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error) { return next(error); }
};

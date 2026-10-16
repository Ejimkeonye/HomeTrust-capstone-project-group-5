import { Response, NextFunction } from 'express';
import { PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IProperty, IRoom } from '../types';

/** Remove room items from editable inspections when their property room is removed. */
async function purgeItemsForRemovedRooms(propertyId: string, removedRoomIds: Set<string>): Promise<void> {
  let inspectionCursor: Record<string, any> | undefined;
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.INSPECTIONS,
      IndexName: 'byProperty',
      KeyConditionExpression: 'propertyId = :propertyId',
      ExpressionAttributeValues: { ':propertyId': propertyId },
      ...(inspectionCursor ? { ExclusiveStartKey: inspectionCursor } : {}),
    }));
    const inspections = (result.Items || []) as IInspection[];

    for (const inspection of inspections) {
      // Submitted/finalized inspections are historical records and retain their snapshot.
      if (inspection.state !== 'DRAFT' && inspection.state !== 'IN_PROGRESS') continue;

      const staleItems: Array<{ inspectionId: string; roomItemId: string }> = [];
      let itemCursor: Record<string, any> | undefined;
      do {
        const itemsResult = await docClient.send(new QueryCommand({
          TableName: TABLES.ROOM_ITEMS,
          KeyConditionExpression: 'inspectionId = :inspectionId',
          ExpressionAttributeValues: { ':inspectionId': inspection.inspectionId },
          ...(itemCursor ? { ExclusiveStartKey: itemCursor } : {}),
        }));
        for (const item of (itemsResult.Items || []) as Array<{ roomId?: string; roomItemId: string }>) {
          if (item.roomId && removedRoomIds.has(item.roomId)) {
            staleItems.push({ inspectionId: inspection.inspectionId, roomItemId: item.roomItemId });
          }
        }
        itemCursor = itemsResult.LastEvaluatedKey;
      } while (itemCursor);

      for (const item of staleItems) {
        await docClient.send(new DeleteCommand({ TableName: TABLES.ROOM_ITEMS, Key: item }));
      }

      // Older inspections may have stored their items inline instead of in ROOM_ITEMS.
      const remainingInlineItems = (inspection.items || []).filter(item => !removedRoomIds.has(item.roomId));
      if (remainingInlineItems.length !== (inspection.items || []).length) {
        await docClient.send(new UpdateCommand({
          TableName: TABLES.INSPECTIONS,
          Key: { inspectionId: inspection.inspectionId },
          UpdateExpression: 'SET items = :items, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':items': remainingInlineItems, ':updatedAt': new Date().toISOString() },
        }));
      }
    }

    inspectionCursor = result.LastEvaluatedKey;
  } while (inspectionCursor);
}

export const createProperty = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, address, type, flatNo, image, rooms } = req.body;
    const now = new Date().toISOString();
    const propertyId = uuidv4();

    if (rooms !== undefined && !Array.isArray(rooms)) {
      return res.status(400).json({ message: 'rooms must be an array' });
    }
    const mappedRooms: IRoom[] = [];
    const roomIds = new Set<string>();
    const roomNames = new Set<string>();
    for (const roomInput of (rooms || [])) {
      const room = typeof roomInput === 'string' ? { name: roomInput } : roomInput;
      if (!room || typeof room !== 'object' || typeof room.name !== 'string' || !room.name.trim()) {
        return res.status(400).json({ message: 'Each room must be a name string or an object with a non-empty name' });
      }
      const name = room.name.trim();
      const normalizedName = name.toLowerCase();
      const roomId = typeof room.roomId === 'string' ? room.roomId : typeof room.id === 'string' ? room.id : uuidv4();
      if (roomIds.has(roomId)) return res.status(400).json({ message: `Duplicate room ID: ${roomId}` });
      if (roomNames.has(normalizedName)) return res.status(400).json({ message: `Duplicate room name: ${name}` });
      roomIds.add(roomId);
      roomNames.add(normalizedName);
      const category = typeof room.category === 'string' ? room.category.trim() : undefined;
      mappedRooms.push({ roomId, name, ...(category ? { category } : {}) });
    }

    if (flatNo !== undefined && typeof flatNo !== 'string' && typeof flatNo !== 'number') {
      return res.status(400).json({ message: 'flatNo must be a string or number' });
    }
    if (image !== undefined && (typeof image !== 'string' || !image.trim())) {
      return res.status(400).json({ message: 'image must be a non-empty string' });
    }

    const newProperty: IProperty = {
      propertyId,
      name,
      address,
      type,
      ...(flatNo !== undefined ? { flatNo: String(flatNo).trim() } : {}),
      ...(image !== undefined ? { image: image.trim() } : {}),
      ownerId: req.user!.userId,
      rooms: mappedRooms,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.PROPERTIES,
      Item: newProperty,
    }));

    res.status(201).json(newProperty);
  } catch (error) {
    next(error);
  }
};

export const getProperties = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Keep properties the user owns.
    const ownerResult = await docClient.send(new QueryCommand({
      TableName: TABLES.PROPERTIES,
      IndexName: 'ownerIndex',
      KeyConditionExpression: 'ownerId = :ownerId',
      ExpressionAttributeValues: { ':ownerId': userId },
    }));

    // Accepted invitations link users to inspections through tenantId or
    // participantIds. The current inspections table has no user lookup GSI,
    // so scan it and follow those links to their properties.
    const linkedInspections: IInspection[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;
    do {
      const inspectionResult = await docClient.send(new ScanCommand({
        TableName: TABLES.INSPECTIONS,
        ConsistentRead: true,
        FilterExpression: 'landlordId = :userId OR tenantId = :userId OR contains(participantIds, :userId)',
        ExpressionAttributeValues: { ':userId': userId },
        ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
      }));
      linkedInspections.push(...((inspectionResult.Items || []) as IInspection[]));
      lastEvaluatedKey = inspectionResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const propertyIds = [...new Set(linkedInspections
      .map((inspection) => inspection.propertyId)
      .filter((propertyId): propertyId is string => typeof propertyId === 'string' && propertyId.length > 0))];
    const linkedProperties = await Promise.all(propertyIds.map(async (propertyId) => {
      const result = await docClient.send(new GetCommand({
        TableName: TABLES.PROPERTIES,
        Key: { propertyId },
      }));
      return result.Item as IProperty | undefined;
    }));

    const propertiesById = new Map<string, IProperty>();
    for (const property of [
      ...((ownerResult.Items || []) as IProperty[]),
      ...linkedProperties.filter((property): property is IProperty => Boolean(property)),
    ]) {
      propertiesById.set(property.propertyId, property);
    }
    const properties = [...propertiesById.values()];

    res.json({
      properties,
      total: properties.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId: req.params.id },
    }));

    if (!result.Item) {
      res.status(404);
      throw new Error('Property not found');
    }

    res.json(result.Item);
  } catch (error) {
    next(error);
  }
};

export const updateProperty = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.params.id as string;
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
    }));

    if (!result.Item) return res.status(404).json({ message: 'Property not found' });
    const property = result.Item as IProperty;
    if (property.ownerId !== req.user!.userId) {
      return res.status(403).json({ message: 'Not authorized to update this property' });
    }

    const { name, address, type, flatNo, image, rooms } = req.body;
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ message: 'name must be a non-empty string' });
    }
    if (address !== undefined && typeof address !== 'string') {
      return res.status(400).json({ message: 'address must be a string' });
    }
    if (type !== undefined && (typeof type !== 'string' || !type.trim())) {
      return res.status(400).json({ message: 'type must be a non-empty string' });
    }
    if (flatNo !== undefined && typeof flatNo !== 'string' && typeof flatNo !== 'number') {
      return res.status(400).json({ message: 'flatNo must be a string or number' });
    }
    if (image !== undefined && (typeof image !== 'string' || !image.trim())) {
      return res.status(400).json({ message: 'image must be a non-empty string' });
    }

    let updatedRooms: IRoom[] | undefined;
    let removedRoomIds = new Set<string>();
    if (rooms !== undefined) {
      if (!Array.isArray(rooms)) return res.status(400).json({ message: 'rooms must be an array' });
      const existingRooms = (property.rooms || []).filter((room): room is IRoom => Boolean(room) && typeof room === 'object' && typeof room.roomId === 'string' && typeof room.name === 'string');
      const existingById = new Map(existingRooms.map(room => [room.roomId, room]));
      const existingByName = new Map(existingRooms.map(room => [room.name.trim().toLowerCase(), room]));
      const usedIds = new Set<string>();
      const usedNames = new Set<string>();
      updatedRooms = [];

      for (const roomInput of rooms) {
        const room = typeof roomInput === 'string' ? { name: roomInput } : roomInput;
        if (!room || typeof room !== 'object' || typeof room.name !== 'string' || !room.name.trim()) {
          return res.status(400).json({ message: 'Each room must be a name string or an object with a non-empty name' });
        }
        const roomName = room.name.trim();
        const normalizedName = roomName.toLowerCase();
        if (usedNames.has(normalizedName)) {
          return res.status(400).json({ message: `Duplicate room name: ${roomName}` });
        }
        const suppliedId = typeof room.roomId === 'string' ? room.roomId : typeof room.id === 'string' ? room.id : undefined;
        const previousRoom = (suppliedId ? existingById.get(suppliedId) : undefined) || existingByName.get(normalizedName);
        const roomId = previousRoom?.roomId || suppliedId || uuidv4();
        if (usedIds.has(roomId)) return res.status(400).json({ message: `Duplicate room ID: ${roomId}` });
        usedIds.add(roomId);
        usedNames.add(normalizedName);
        const category = typeof room.category === 'string' ? room.category.trim() : previousRoom?.category;
        updatedRooms.push({ roomId, name: roomName, ...(category ? { category } : {}) });
      }
      const retainedRoomIds = new Set(updatedRooms.map(room => room.roomId));
      removedRoomIds = new Set(existingRooms
        .map(room => room.roomId)
        .filter(roomId => !retainedRoomIds.has(roomId)));
    }

    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString(), ':ownerId': req.user!.userId };
    const updates = ['#updatedAt = :updatedAt'];
    if (name !== undefined) { names['#name'] = 'name'; values[':name'] = name.trim(); updates.push('#name = :name'); }
    if (address !== undefined) { values[':address'] = address.trim(); updates.push('address = :address'); }
    if (type !== undefined) { names['#type'] = 'type'; values[':type'] = type.trim(); updates.push('#type = :type'); }
    if (flatNo !== undefined) { names['#flatNo'] = 'flatNo'; values[':flatNo'] = String(flatNo).trim(); updates.push('#flatNo = :flatNo'); }
    if (image !== undefined) { names['#image'] = 'image'; values[':image'] = image.trim(); updates.push('#image = :image'); }
    if (updatedRooms !== undefined) { values[':rooms'] = updatedRooms; updates.push('rooms = :rooms'); }
    if (updates.length === 1) return res.status(400).json({ message: 'Provide at least one property field to update' });

    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'ownerId = :ownerId',
      ReturnValues: 'ALL_NEW',
    }));

    if (removedRoomIds.size > 0) {
      await purgeItemsForRemovedRooms(propertyId, removedRoomIds);
    }

    res.json(updated.Attributes);
  } catch (error) {
    next(error);
  }
};
export const deleteProperty = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.params.id as string;
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
    }));

    if (!result.Item) return res.status(404).json({ message: 'Property not found' });
    const property = result.Item as IProperty;
    if (property.ownerId !== req.user!.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this property' });
    }

    await docClient.send(new DeleteCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
      ConditionExpression: 'ownerId = :ownerId',
      ExpressionAttributeValues: { ':ownerId': req.user!.userId },
    }));

    return res.status(200).json({ message: 'Property deleted', propertyId });
  } catch (error) {
    return next(error);
  }
};

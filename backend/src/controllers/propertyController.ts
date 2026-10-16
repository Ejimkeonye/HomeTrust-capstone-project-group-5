import { Response, NextFunction } from 'express';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IProperty, IRoom } from '../types';

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
    // Query using ownerIndex GSI to get all properties for this user
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.PROPERTIES,
      IndexName: 'ownerIndex',
      KeyConditionExpression: 'ownerId = :ownerId',
      ExpressionAttributeValues: { ':ownerId': req.user!.userId },
    }));

    const properties = (result.Items || []) as IProperty[];

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

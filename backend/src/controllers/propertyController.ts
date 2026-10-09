import { Response, NextFunction } from 'express';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IProperty, IRoom } from '../types';

export const createProperty = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, address, type, rooms } = req.body;
    const now = new Date().toISOString();
    const propertyId = uuidv4();

    // Give each room a unique ID
    const mappedRooms: IRoom[] = (rooms || []).map((r: { name: string }) => ({
      roomId: uuidv4(),
      name: r.name,
    }));

    const newProperty: IProperty = {
      propertyId,
      name,
      address,
      type,
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
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId: req.params.id },
    }));

    if (!result.Item) {
      res.status(404);
      throw new Error('Property not found');
    }

    const property = result.Item as IProperty;
    if (property.ownerId !== req.user!.userId) {
      res.status(403);
      throw new Error('Not authorized to update this property');
    }

    const { name, address, type } = req.body;

    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId: req.params.id },
      UpdateExpression: 'SET #n = :name, address = :address, #t = :type, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#n': 'name', '#t': 'type' }, // 'name' and 'type' are reserved words in DynamoDB
      ExpressionAttributeValues: {
        ':name': name,
        ':address': address,
        ':type': type,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }));

    res.json(updated.Attributes);
  } catch (error) {
    next(error);
  }
};

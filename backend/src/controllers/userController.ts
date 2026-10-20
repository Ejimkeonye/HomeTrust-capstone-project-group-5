import { Response, NextFunction } from 'express';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IUser } from '../types';
import { writeAuditEvent } from '../utils/auditLogger';

function publicProfile(user: IUser) {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    houseAddress: user.houseAddress,
    flatRoomNumber: user.flatRoomNumber,
    role: user.role,
  };
}

function isConditionalCheckFailure(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' &&
    (error as { name?: string }).name === 'ConditionalCheckFailedException');
}

export const getMyProfile = (req: AuthRequest, res: Response) => {
  return res.json({ user: publicProfile(req.user!) });
};

export const updateMyProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ message: 'Request body must be an object' });
    }

    const allowedFields = new Set(['name', 'phoneNumber']);
    const unsupportedFields = Object.keys(body).filter((field) => !allowedFields.has(field));
    if (unsupportedFields.length > 0) {
      return res.status(400).json({
        message: 'Only name and phoneNumber can be updated',
        fields: unsupportedFields,
      });
    }

    const { name, phoneNumber } = body as { name?: unknown; phoneNumber?: unknown };
    const updates: string[] = [];
    const values: Record<string, string> = {
      ':updatedAt': new Date().toISOString(),
    };
    const names: Record<string, string> = {
      '#updatedAt': 'updatedAt',
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
        return res.status(400).json({ message: 'name must be a non-empty string of at most 120 characters' });
      }
      names['#name'] = 'name';
      values[':name'] = name.trim();
      updates.push('#name = :name');
    }

    if (phoneNumber !== undefined) {
      if (typeof phoneNumber !== 'string') {
        return res.status(400).json({ message: 'phoneNumber must be a string' });
      }
      const normalizedPhone = phoneNumber.trim();
      const digitCount = normalizedPhone.replace(/\D/g, '').length;
      if (!normalizedPhone || !/^\+?[0-9().\s-]+$/.test(normalizedPhone) || digitCount < 7 || digitCount > 15) {
        return res.status(400).json({ message: 'phoneNumber must contain 7 to 15 digits and use a valid phone number format' });
      }
      values[':phoneNumber'] = normalizedPhone;
      updates.push('phoneNumber = :phoneNumber');
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Provide name or phoneNumber to update' });
    }

    updates.push('#updatedAt = :updatedAt');
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId: req.user!.userId },
      UpdateExpression: 'SET ' + updates.join(', '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(userId)',
      ReturnValues: 'ALL_NEW',
    }));

    const user = publicProfile(result.Attributes as IUser);
    writeAuditEvent({
      eventType: 'user.profile_updated',
      outcome: 'success',
      actorId: req.user!.userId,
      resourceType: 'user',
      resourceId: req.user!.userId,
      details: { updatedFields: updates.filter((field) => field !== '#updatedAt = :updatedAt').join(',') },
    });

    return res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    if (isConditionalCheckFailure(error)) {
      return res.status(404).json({ message: 'User not found' });
    }
    return next(error);
  }
};
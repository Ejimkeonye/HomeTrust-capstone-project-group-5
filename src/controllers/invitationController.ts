import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IUser, IInvitation } from '../types';

export const createInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyId, inspectionId, email } = req.body;

    // Verify property ownership
    const propResult = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
    }));

    if (!propResult.Item || propResult.Item.ownerId !== req.user!.userId) {
      res.status(403);
      throw new Error('Not authorized to invite for this property');
    }

    // Verify inspection belongs to the property
    const inspResult = await docClient.send(new GetCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
    }));

    if (!inspResult.Item || inspResult.Item.propertyId !== propertyId) {
      res.status(400);
      throw new Error('Inspection does not belong to this property');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation: IInvitation = {
      token,
      propertyId,
      inspectionId,
      inviterId: req.user!.userId,
      email,
      expiresAt,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.INVITATIONS,
      Item: invitation,
    }));

    // In production, send this link via email (integrate SES or SendGrid)
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite?token=${token}`;

    res.status(201).json({ invitation, inviteLink });
  } catch (error) {
    next(error);
  }
};

export const resolveInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    // Fetch invitation by token
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.INVITATIONS,
      Key: { token },
    }));

    if (!result.Item) {
      res.status(400);
      throw new Error('Invalid or expired invitation token');
    }

    const invitation = result.Item as IInvitation;

    if (invitation.status !== 'PENDING' || new Date(invitation.expiresAt) < new Date()) {
      res.status(400);
      throw new Error('Invalid or expired invitation token');
    }

    // Check if a user with this email already exists
    const existingResult = await docClient.send(new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'emailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': invitation.email },
    }));

    let user: IUser;

    if (existingResult.Items && existingResult.Items.length > 0) {
      user = existingResult.Items[0] as IUser;
    } else {
      // Create a new tenant account
      const salt = await bcrypt.genSalt(10);
      const passwordHash = password ? await bcrypt.hash(password, salt) : undefined;
      const userId = uuidv4();
      const now = new Date().toISOString();

      user = {
        userId,
        name,
        email: invitation.email,
        passwordHash,
        role: 'Tenant',
        createdAt: now,
        updatedAt: now,
      };

      await docClient.send(new PutCommand({
        TableName: TABLES.USERS,
        Item: user,
      }));
    }

    // Link tenant to the inspection
    await docClient.send(new UpdateCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId: invitation.inspectionId },
      UpdateExpression: 'SET tenantId = :tenantId, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':tenantId': user.userId,
        ':updatedAt': new Date().toISOString(),
      },
    }));

    // Mark invitation as accepted
    await docClient.send(new UpdateCommand({
      TableName: TABLES.INVITATIONS,
      Key: { token },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' }, // 'status' is a reserved word
      ExpressionAttributeValues: {
        ':status': 'ACCEPTED',
        ':updatedAt': new Date().toISOString(),
      },
    }));

    const jwtToken = jwt.sign(
      { id: user.userId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' } as jwt.SignOptions
    );

    res.json({
      message: 'Invitation accepted',
      user: { userId: user.userId, email: user.email, role: user.role, name: user.name },
      token: jwtToken,
      propertyId: invitation.propertyId,
      inspectionId: invitation.inspectionId,
    });
  } catch (error) {
    next(error);
  }
};

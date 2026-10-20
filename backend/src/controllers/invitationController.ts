import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PutCommand, GetCommand, QueryCommand, TransactWriteCommand, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IUser, IInvitation, IInspection, IProperty, UserRole } from '../types';
import { getJwtSecret } from '../config/jwt';
import { writeAuditEvent } from '../utils/auditLogger';
import { sendInviteEmail } from '../utils/mailer';

export const createInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyId, inspectionId, email } = req.body;
    if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ message: 'A valid invitee email is required' });
    if (email.trim().toLowerCase() === req.user!.email.toLowerCase()) return res.status(400).json({ message: 'You cannot invite yourself' });

    // Verify property ownership
    const propResult = await docClient.send(new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { propertyId },
    }));

    if (!propResult.Item || propResult.Item.ownerId !== req.user!.userId) {
      res.status(403);
      throw new Error('Not authorized to invite for this property');
    }

    const property = propResult.Item as IProperty;

    // Verify inspection belongs to the property
    const inspResult = await docClient.send(new GetCommand({
      TableName: TABLES.INSPECTIONS,
      Key: { inspectionId },
    }));

    const inspection = inspResult.Item as IInspection | undefined;
    if (!inspection || inspection.propertyId !== propertyId) {
      res.status(400);
      throw new Error('Inspection does not belong to this property');
    }
    const isTenantInviter = req.user!.role === 'Tenant';
    const inspectionCreator = inspection.createdBy || (isTenantInviter ? inspection.tenantId : inspection.landlordId);
    if (inspectionCreator !== req.user!.userId) return res.status(403).json({ message: 'Only the inspection creator can invite the other party' });

    const inviteeRole: UserRole = isTenantInviter ? 'Landlord' : 'Tenant';
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation: IInvitation = {
      token,
      propertyId,
      inspectionId,
      inviterId: req.user!.userId,
      inviterRole: req.user!.role,
      inviteeRole,
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

    writeAuditEvent({ eventType: 'invitation.created', outcome: 'success', actorId: req.user!.userId, resourceType: 'inspection', resourceId: inspectionId, details: { propertyId } });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite?token=${token}`;

    // Send invitation email
    try {
      await sendInviteEmail({
        to: email.trim(),
        inviterName: req.user!.name || req.user!.email,
        propertyAddress: property.address || property.name,
        inviteLink,
        role: inviteeRole,
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the whole request if email fails — the invite link is still returned
    }

    res.status(201).json({ invitation, inviteLink });
  } catch (error) {
    next(error);
  }
};

export const resolveInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const jwtSecret = getJwtSecret();
    const { token } = req.params;
    const { name, password } = req.body;

    // Fetch invitation by token
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.INVITATIONS,
      Key: { token },
    }));

    if (!result.Item) {
      writeAuditEvent({ eventType: 'invitation.resolve', outcome: 'failure', reason: 'invalid_or_expired' });
      res.status(400);
      throw new Error('Invalid or expired invitation token');
    }

    const invitation = result.Item as IInvitation;

    if (invitation.status !== 'PENDING' || new Date(invitation.expiresAt) < new Date()) {
      writeAuditEvent({ eventType: 'invitation.resolve', outcome: 'failure', reason: invitation.status !== 'PENDING' ? 'already_resolved' : 'expired' });
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

    const existingUser = existingResult.Items?.[0] as IUser | undefined;
    const inviteeRole: UserRole = invitation.inviteeRole || 'Tenant';
    if (existingUser && existingUser.role !== inviteeRole) {
      return res.status(409).json({ message: `This invitation is for a ${inviteeRole} account, but this email already has a ${existingUser.role} account` });
    }
    if (!existingUser && (typeof name !== 'string' || !name.trim() || typeof password !== 'string' || password.length < 8)) {
      return res.status(400).json({ message: 'For a new account, provide a name and a password of at least 8 characters' });
    }

    const now = new Date().toISOString();
    const user: IUser = existingUser || {
      userId: uuidv4(),
      name: name.trim(),
      email: invitation.email,
      passwordHash: await bcrypt.hash(password, await bcrypt.genSalt(10)),
      role: inviteeRole,
      createdAt: now,
      updatedAt: now,
    };

    const transactionItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [];
    if (!existingUser) {
      transactionItems.push({
        Put: {
          TableName: TABLES.USERS,
          Item: user,
          ConditionExpression: 'attribute_not_exists(userId)',
        },
      });
    }
    const inviterRole: UserRole = invitation.inviterRole || (inviteeRole === 'Landlord' ? 'Tenant' : 'Landlord');
    const partyLinks = inviterRole === 'Tenant'
      ? {
          landlordId: user.userId,
          tenantId: invitation.inviterId,
          landlordRole: user.role,
          tenantRole: inviterRole,
        }
      : {
          landlordId: invitation.inviterId,
          tenantId: user.userId,
          landlordRole: inviterRole,
          tenantRole: user.role,
        };
    const acceptedAt = new Date().toISOString();
    transactionItems.push(
      {
        Update: {
          TableName: TABLES.INSPECTIONS,
          Key: { inspectionId: invitation.inspectionId },
          UpdateExpression: 'SET landlordId = :landlordId, tenantId = :tenantId, landlordRole = :landlordRole, tenantRole = :tenantRole, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':landlordId': partyLinks.landlordId,
            ':tenantId': partyLinks.tenantId,
            ':landlordRole': partyLinks.landlordRole,
            ':tenantRole': partyLinks.tenantRole,
            ':updatedAt': acceptedAt,
          },
          ConditionExpression: 'attribute_exists(inspectionId) AND (attribute_not_exists(landlordId) OR landlordId = :landlordId) AND (attribute_not_exists(tenantId) OR tenantId = :tenantId)',
        },
      },
      {
        Update: {
          TableName: TABLES.INVITATIONS,
          Key: { token },
          UpdateExpression: 'SET #status = :accepted, acceptedBy = :acceptedBy, acceptedAt = :acceptedAt, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':accepted': 'ACCEPTED', ':acceptedBy': user.userId, ':acceptedAt': acceptedAt, ':updatedAt': acceptedAt, ':pending': 'PENDING', ':now': acceptedAt },
          ConditionExpression: '#status = :pending AND expiresAt >= :now',
        },
      },
    );
    await docClient.send(new TransactWriteCommand({ TransactItems: transactionItems }));

    writeAuditEvent({ eventType: 'invitation.accepted', outcome: 'success', actorId: user.userId, resourceType: 'inspection', resourceId: invitation.inspectionId, details: { propertyId: invitation.propertyId } });

    const jwtToken = jwt.sign(
      { id: user.userId },
      jwtSecret,
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

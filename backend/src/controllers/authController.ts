import { Request, Response, NextFunction } from 'express';
import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { docClient, TABLES } from '../config/dynamodb';
import { IUser } from '../types';
import { getJwtSecret } from '../config/jwt';
import { writeAuditEvent } from '../utils/auditLogger';
import { sendPasswordResetEmail } from '../utils/mailer';

const generateToken = (userId: string, secret: string) => {
  return jwt.sign({ id: userId }, secret, {
    expiresIn: '30d',
  } as jwt.SignOptions);
};

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;
const GENERIC_RESET_MESSAGE = 'If an account with that email exists, a verification code has been sent.';

type ResettableUser = IUser & {
  passwordResetCodeHash?: string;
  passwordResetExpiresAt?: string;
  passwordResetRequestedAt?: string;
  passwordResetAttempts?: number;
};

function isConditionalCheckFailure(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' &&
    (error as { name?: string }).name === 'ConditionalCheckFailedException');
}

async function findUserByEmail(email: string): Promise<ResettableUser | undefined> {
  const candidates = [...new Set([email.trim(), email.trim().toLowerCase()])];
  for (const candidate of candidates) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'emailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': candidate },
    }));
    if (result.Items?.[0]) return result.Items[0] as ResettableUser;
  }
  return undefined;
}

function hashResetCode(userId: string, code: string): string {
  return createHmac('sha256', getJwtSecret()).update(userId + ':' + code).digest('hex');
}

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jwtSecret = getJwtSecret();
    const { name, email, password, role, phoneNumber, houseAddress, flatRoomNumber } = req.body;

    // Check if email already exists via emailIndex GSI
    const existing = await docClient.send(new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'emailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
    }));

    if (existing.Items && existing.Items.length > 0) {
      writeAuditEvent({ eventType: 'auth.register', outcome: 'failure', reason: 'duplicate_email' });
      res.status(400);
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const userId = uuidv4();

    const newUser: IUser = {
      userId,
      name,
      email,
      phoneNumber: typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined,
      houseAddress: typeof houseAddress === 'string' ? houseAddress.trim() : undefined,
      flatRoomNumber: typeof flatRoomNumber === 'string' ? flatRoomNumber.trim() : undefined,
      passwordHash,
      role: role || 'Landlord',
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.USERS,
      Item: newUser,
    }));

    writeAuditEvent({ eventType: 'auth.register', outcome: 'success', actorId: userId, resourceType: 'user', resourceId: userId });

    res.status(201).json({
      userId,
      name,
      email,
      phoneNumber: newUser.phoneNumber,
      houseAddress: newUser.houseAddress,
      flatRoomNumber: newUser.flatRoomNumber,
      role: newUser.role,
      token: generateToken(userId, jwtSecret),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jwtSecret = getJwtSecret();
    const { email, password } = req.body;

    // Find user by email using emailIndex GSI
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'emailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
    }));

    const user = result.Items?.[0] as IUser | undefined;

    if (!user || !user.passwordHash) {
      writeAuditEvent({ eventType: 'auth.login', outcome: 'failure', reason: 'invalid_credentials' });
      res.status(401);
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      writeAuditEvent({ eventType: 'auth.login', outcome: 'failure', reason: 'invalid_credentials' });
      res.status(401);
      throw new Error('Invalid email or password');
    }

    writeAuditEvent({ eventType: 'auth.login', outcome: 'success', actorId: user.userId, resourceType: 'user', resourceId: user.userId });

    res.json({
      userId: user.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      houseAddress: user.houseAddress,
      flatRoomNumber: user.flatRoomNumber,
      role: user.role,
      token: generateToken(user.userId, jwtSecret),
    });
  } catch (error) {
    next(error);
  }
};

/** Sends a short-lived six-digit password reset code without revealing account existence. */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: 'A valid email address is required' });
    }

    const user = await findUserByEmail(email);
    if (!user) return res.status(200).json({ message: GENERIC_RESET_MESSAGE });

    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const now = new Date();
    const nowIso = now.toISOString();
    const codeHash = hashResetCode(user.userId, code);
    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId: user.userId },
        UpdateExpression: 'SET passwordResetCodeHash = :codeHash, passwordResetExpiresAt = :expiresAt, passwordResetRequestedAt = :requestedAt, passwordResetAttempts = :zero',
        ConditionExpression: 'attribute_not_exists(passwordResetRequestedAt) OR passwordResetRequestedAt <= :cooldownBefore',
        ExpressionAttributeValues: {
          ':codeHash': codeHash,
          ':expiresAt': new Date(now.getTime() + RESET_CODE_TTL_MS).toISOString(),
          ':requestedAt': nowIso,
          ':cooldownBefore': new Date(now.getTime() - RESET_REQUEST_COOLDOWN_MS).toISOString(),
          ':zero': 0,
        },
      }));
    } catch (error) {
      if (isConditionalCheckFailure(error)) return res.status(200).json({ message: GENERIC_RESET_MESSAGE });
      throw error;
    }

    try {
      await sendPasswordResetEmail(user.email, code);
    } catch (mailError) {
      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLES.USERS,
          Key: { userId: user.userId },
          UpdateExpression: 'REMOVE passwordResetCodeHash, passwordResetExpiresAt, passwordResetRequestedAt, passwordResetAttempts',
          ConditionExpression: 'passwordResetCodeHash = :codeHash',
          ExpressionAttributeValues: { ':codeHash': codeHash },
        }));
      } catch (cleanupError) {
        console.error('[PasswordReset] Could not clear an unsent code.', cleanupError);
      }
      console.error('[PasswordReset] Email delivery failed.', mailError);
    }

    return res.status(200).json({ message: GENERIC_RESET_MESSAGE });
  } catch (error) {
    return next(error);
  }
};

/** Verifies the emailed code and replaces the account password. */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code, newPassword } = req.body;
    if (typeof email !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code) ||
        typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'Provide a valid email, six-digit code, and a password of at least 8 characters' });
    }

    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid or expired verification code' });

    const now = new Date().toISOString();
    const storedHash = user.passwordResetCodeHash;
    const expectedHash = hashResetCode(user.userId, code);
    const hashIsWellFormed = typeof storedHash === 'string' && /^[a-f0-9]{64}$/i.test(storedHash);
    const matches = hashIsWellFormed &&
      timingSafeEqual(Buffer.from(storedHash!, 'hex'), Buffer.from(expectedHash, 'hex'));
    const notExpired = typeof user.passwordResetExpiresAt === 'string' && user.passwordResetExpiresAt > now;
    const belowAttemptLimit = (user.passwordResetAttempts || 0) < MAX_RESET_ATTEMPTS;

    if (!matches || !notExpired || !belowAttemptLimit) {
      if (storedHash && notExpired && belowAttemptLimit) {
        try {
          await docClient.send(new UpdateCommand({
            TableName: TABLES.USERS,
            Key: { userId: user.userId },
            UpdateExpression: 'SET passwordResetAttempts = if_not_exists(passwordResetAttempts, :zero) + :one',
            ConditionExpression: 'attribute_exists(passwordResetCodeHash) AND passwordResetExpiresAt > :now AND (attribute_not_exists(passwordResetAttempts) OR passwordResetAttempts < :maxAttempts)',
            ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now, ':maxAttempts': MAX_RESET_ATTEMPTS },
          }));
        } catch (error) {
          if (!isConditionalCheckFailure(error)) throw error;
        }
      }
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await docClient.send(new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId: user.userId },
      UpdateExpression: 'SET passwordHash = :passwordHash, updatedAt = :updatedAt REMOVE passwordResetCodeHash, passwordResetExpiresAt, passwordResetRequestedAt, passwordResetAttempts',
      ConditionExpression: 'passwordResetCodeHash = :codeHash AND passwordResetExpiresAt > :now AND (attribute_not_exists(passwordResetAttempts) OR passwordResetAttempts < :maxAttempts)',
      ExpressionAttributeValues: {
        ':passwordHash': passwordHash,
        ':updatedAt': now,
        ':codeHash': storedHash,
        ':now': now,
        ':maxAttempts': MAX_RESET_ATTEMPTS,
      },
    }));

    writeAuditEvent({ eventType: 'auth.password_reset', outcome: 'success', actorId: user.userId, resourceType: 'user', resourceId: user.userId });
    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    if (isConditionalCheckFailure(error)) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    return next(error);
  }
};

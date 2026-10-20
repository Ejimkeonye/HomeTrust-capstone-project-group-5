import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../config/dynamodb';

export const requireAdminKey = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(503).json({ message: 'Admin stats not configured' });
  }
  const provided = req.header('x-admin-key') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

const countItems = async (tableName: string): Promise<number> => {
  let total = 0;
  let startKey: Record<string, any> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: tableName, Select: 'COUNT', ExclusiveStartKey: startKey }),
    );
    total += result.Count ?? 0;
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return total;
};

const countUsersByRole = async () => {
  let tenants = 0;
  let landlords = 0;
  let total = 0;
  let startKey: Record<string, any> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.USERS,
        ProjectionExpression: '#r',
        ExpressionAttributeNames: { '#r': 'role' },
        ExclusiveStartKey: startKey,
      }),
    );
    for (const item of result.Items ?? []) {
      total += 1;
      if (item.role === 'Tenant') tenants += 1;
      if (item.role === 'Landlord') landlords += 1;
    }
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return { total, tenants, landlords };
};

export const getAdminStats = async (_req: Request, res: Response) => {
  try {
    const [users, properties, inspections, roomItems, evidence, invitations] = await Promise.all([
      countUsersByRole(),
      countItems(TABLES.PROPERTIES),
      countItems(TABLES.INSPECTIONS),
      countItems(TABLES.ROOM_ITEMS),
      countItems(TABLES.EVIDENCE),
      countItems(TABLES.INVITATIONS),
    ]);
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      users,
      properties,
      inspections,
      roomItems,
      evidence,
      invitations,
    });
  } catch (err) {
    console.error('Admin stats failed:', err);
    res.status(500).json({ message: 'Could not load stats' });
  }
};

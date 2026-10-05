import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../config/dynamodb';
import { IUser } from '../types';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }

  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    // Fetch user from DynamoDB by userId
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId: decoded.id },
    }));

    if (!result.Item) {
      res.status(401);
      return next(new Error('Not authorized, user not found'));
    }

    // Strip passwordHash before attaching to request
    const { passwordHash, ...userWithoutPassword } = result.Item as IUser;
    req.user = userWithoutPassword as IUser;
    next();
  } catch (error) {
    res.status(401);
    next(new Error('Not authorized, token failed'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      return next(
        new Error(`User role '${req.user?.role}' is not authorized to access this route`)
      );
    }
    next();
  };
};

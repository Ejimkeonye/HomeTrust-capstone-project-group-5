import { Request, Response, NextFunction } from 'express';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLES } from '../config/dynamodb';
import { IUser } from '../types';

const generateToken = (userId: string) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  } as jwt.SignOptions);
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role, phoneNumber, houseAddress, flatRoomNumber } = req.body;

    // Check if email already exists via emailIndex GSI
    const existing = await docClient.send(new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'emailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
    }));

    if (existing.Items && existing.Items.length > 0) {
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

    res.status(201).json({
      userId,
      name,
      email,
      phoneNumber: newUser.phoneNumber,
      houseAddress: newUser.houseAddress,
      flatRoomNumber: newUser.flatRoomNumber,
      role: newUser.role,
      token: generateToken(userId),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      res.status(401);
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    res.json({
      userId: user.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      houseAddress: user.houseAddress,
      flatRoomNumber: user.flatRoomNumber,
      role: user.role,
      token: generateToken(user.userId),
    });
  } catch (error) {
    next(error);
  }
};

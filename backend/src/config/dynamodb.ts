import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.DYNAMODB_ENDPOINT;

export const dynamoClient = new DynamoDBClient({
  region,
  ...(endpoint ? { endpoint } : {}),
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLES = {
  USERS:       process.env.DYNAMODB_USERS_TABLE       || 'MoveInUsers',
  PROPERTIES:  process.env.DYNAMODB_PROPERTIES_TABLE  || 'MoveInProperties',
  INSPECTIONS: process.env.DYNAMODB_INSPECTIONS_TABLE || 'MoveInInspections',
  INVITATIONS: process.env.DYNAMODB_INVITATIONS_TABLE || 'MoveInInvitations',
  ROOM_ITEMS:  process.env.DYNAMODB_ROOM_ITEMS_TABLE  || 'MoveInRoomItems',
} as const;

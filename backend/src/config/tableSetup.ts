import {
  CreateTableCommand,
  DescribeTableCommand,
  GlobalSecondaryIndex,
  KeySchemaElement,
  Projection,
  ResourceInUseException,
  ScalarAttributeType,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { dynamoClient, TABLES } from './dynamodb';

type TableDefinition = {
  name: string;
  partitionKey: string;
  indexes?: Array<{ name: string; partitionKey: string }>;
};

const tables: TableDefinition[] = [
  { name: TABLES.USERS, partitionKey: 'userId', indexes: [{ name: 'emailIndex', partitionKey: 'email' }] },
  { name: TABLES.PROPERTIES, partitionKey: 'propertyId', indexes: [{ name: 'ownerIndex', partitionKey: 'ownerId' }] },
  { name: TABLES.INSPECTIONS, partitionKey: 'inspectionId' },
  { name: TABLES.INVITATIONS, partitionKey: 'token' },
];

export async function setupTables(): Promise<void> {
  if (process.env.DYNAMODB_AUTO_CREATE_TABLES === 'false') return;

  for (const table of tables) {
    const attributes = new Map<string, ScalarAttributeType>([[table.partitionKey, 'S']]);
    for (const index of table.indexes || []) attributes.set(index.partitionKey, 'S');

    const keySchema: KeySchemaElement[] = [{ AttributeName: table.partitionKey, KeyType: 'HASH' }];
    const globalSecondaryIndexes: GlobalSecondaryIndex[] | undefined = table.indexes?.map(index => ({
      IndexName: index.name,
      KeySchema: [{ AttributeName: index.partitionKey, KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' } as Projection,
    }));

    try {
      await dynamoClient.send(new CreateTableCommand({
        TableName: table.name,
        AttributeDefinitions: [...attributes].map(([AttributeName, AttributeType]) => ({ AttributeName, AttributeType })),
        KeySchema: keySchema,
        ...(globalSecondaryIndexes ? { GlobalSecondaryIndexes: globalSecondaryIndexes } : {}),
        BillingMode: 'PAY_PER_REQUEST',
      }));
      await waitUntilTableExists({ client: dynamoClient, maxWaitTime: 90 }, { TableName: table.name });

      if (globalSecondaryIndexes?.length) {
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
          const description = await dynamoClient.send(new DescribeTableCommand({ TableName: table.name }));
          const indexesReady = globalSecondaryIndexes.every(index =>
            description.Table?.GlobalSecondaryIndexes?.some(existing =>
              existing.IndexName === index.IndexName && existing.IndexStatus === 'ACTIVE',
            ),
          );
          if (indexesReady) break;
          await new Promise(resolve => setTimeout(resolve, 1_000));
        }
      }
      console.log(`Created DynamoDB table: ${table.name}`);
    } catch (error) {
      if (!(error instanceof ResourceInUseException)) throw error;
      await dynamoClient.send(new DescribeTableCommand({ TableName: table.name }));
    }
  }
}

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Initialize the DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Create the DynamoDB Document client
export const docClient = DynamoDBDocumentClient.from(client,{
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
  },
});

// Constants
export const DOCUMENTS_TABLE_NAME = process.env.DOCUMENTS_TABLE;

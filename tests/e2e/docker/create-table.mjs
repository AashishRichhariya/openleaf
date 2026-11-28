// Creates a documents table in DynamoDB Local, as the app expects it. Usage: node create-table.mjs <name>
// Run from the app's folder, so that its @aws-sdk/client-dynamodb is found.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { CreateTableCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const name = process.argv[2];
if (!name?.startsWith('openleaf-local')) throw new Error(`refusing to create table ${name}`);
if (!/^http:\/\/127\.0\.0\.1:/.test(process.env.AWS_ENDPOINT_URL_DYNAMODB ?? '')) {
  throw new Error('AWS_ENDPOINT_URL_DYNAMODB must point at 127.0.0.1');
}

const db = new DynamoDBClient({});
const command = new CreateTableCommand({
  TableName: name,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'slug', AttributeType: 'S' },
    { AttributeName: 'version', AttributeType: 'N' },
  ],
  KeySchema: [
    { AttributeName: 'slug', KeyType: 'HASH' },
    { AttributeName: 'version', KeyType: 'RANGE' },
  ],
});

// DynamoDB Local takes a few seconds to start.
for (let attempt = 1; ; attempt += 1) {
  try {
    await db.send(command);
    break;
  } catch (error) {
    if (error.name === 'ResourceInUseException') break;
    if (attempt === 60) throw error;
    await new Promise((done) => setTimeout(done, 1000));
  }
}
console.log(`table ${name} ready`);

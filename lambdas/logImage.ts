import { SNSEvent } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoDb = new DynamoDBClient({});
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

export const handler = async (event: SNSEvent) => {
  console.log("Event received:", JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    const snsMessage = JSON.parse(record.Sns.Message); // Parse SNS message
    const { srcKey } = snsMessage; // Extract the file name from the message
    
    try {
      const logParams = {
        TableName: DYNAMODB_TABLE_NAME,
        Item: {
          fileName: { S: srcKey },
        },
      };
      await dynamoDb.send(new PutItemCommand(logParams));
      console.log(`Logged file ${srcKey} to DynamoDB`);
    } catch (error) {
      console.error("Failed to log image to DynamoDB:", error);
      throw error;
    }
  }
};
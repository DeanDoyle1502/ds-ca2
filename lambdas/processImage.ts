/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"


const sns = new SNSClient({});
const VALID_IMAGE_TOPIC_ARN = process.env.VALID_IMAGE_TOPIC_ARN!;
const dynamoDbClient = new DynamoDBClient({});
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;


async function handleObjectCreated(srcKey: string) {
  console.log('handleObjectCreated')
  if (srcKey.endsWith("jpeg") || srcKey.endsWith("png")) {
    try {
      // Publish valid image details to SNS
      const params = {
        TopicArn: VALID_IMAGE_TOPIC_ARN,
        Message: JSON.stringify({ srcKey }),
      };
      await sns.send(new PublishCommand(params));
      console.log(`Published valid image ${srcKey} to SNS topic`);
    } catch (error) {
      console.error("Failed to publish to SNS:", error);
      throw error;
    }
  } else {
    console.error(`Unsupported file type: ${srcKey}`);
    throw new Error(`Invalid file type: ${srcKey}`);
  }
}

async function handleObjectRemoved (srcKey: string) {
  // Handle image deletion
  try {
    console.log(`Processing deletion for file: ${srcKey}`);
    const params = {
      TableName: DYNAMODB_TABLE_NAME,
      Key: {
        fileName: { S: srcKey },
      },
    };
    await dynamoDbClient.send(new DeleteItemCommand(params));
    console.log(`Deleted metadata for file: ${srcKey}`);
  } catch (error) {
    console.error(`Failed to delete metadata for file ${srcKey}:`, error);
    throw error;
  }
}

export const handler: SQSHandler = async (event) => {
  console.log("Event recieved ", JSON.stringify(event, null, 2));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);        // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        const eventName = messageRecord.eventName;

        if (eventName.startsWith("ObjectCreated")) {
          await handleObjectCreated(srcKey)
        } else if (eventName.startsWith("ObjectRemoved")) {
          await handleObjectRemoved(srcKey)
        }
        
    
       }
    }
  }
};
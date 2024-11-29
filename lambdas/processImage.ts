/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  GetObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"

// const s3 = new S3Client();
// const dynamoDb = new DynamoDBClient({});
// const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

const sns = new SNSClient({});
const VALID_IMAGE_TOPIC_ARN = process.env.VALID_IMAGE_TOPIC_ARN!;

export const handler: SQSHandler = async (event) => {
  console.log("Event recieved ", JSON.stringify(event, null, 2));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);        // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        let origimage = null;
        
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
    }
  }
};
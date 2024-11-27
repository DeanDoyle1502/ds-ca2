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

const s3 = new S3Client();
const dynamoDb = new DynamoDBClient({});
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

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
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        let origimage = null;
         // Validate file type
    if (!srcKey.endsWith("jpeg") && !srcKey.endsWith("png")) {
      console.error(`Unsupported file type: ${srcKey}`);
      throw new Error(`Invalid file type: ${srcKey}`);
    }

       // Log valid file to DynamoDB
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
        try {
          // Download the image from the S3 source bucket.
          const params: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };
          origimage = await s3.send(new GetObjectCommand(params));
          // Process the image ......
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
};
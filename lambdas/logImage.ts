import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoDb = new DynamoDBClient({});
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const snsMessage = JSON.parse(record.body); // Parse SNS message
    const s3Object = snsMessage.Records[0].s3;
    const fileName = decodeURIComponent(
      s3Object.object.key.replace(/\+/g, " ")
    );
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    // Validate file type
    if (fileExtension !== "jpeg" && fileExtension !== "png") {
      console.error(`Unsupported file type: ${fileExtension}`);
      throw new Error(`Invalid file type: ${fileExtension}`);
    }

    // Log valid file to DynamoDB
    try {
      const logParams = {
        TableName: DYNAMODB_TABLE_NAME,
        Item: {
          fileName: { S: fileName },
        },
      };
      await dynamoDb.send(new PutItemCommand(logParams));
      console.log(`Logged file ${fileName} to DynamoDB`);
    } catch (error) {
      console.error("Failed to log image to DynamoDB:", error);
      throw error;
    }
  }
};

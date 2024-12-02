import { DynamoDBClient, ReturnValue, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
import { Values } from "aws-cdk-lib/aws-cloudwatch";


const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

export const handler = async (event: any) => {
  const dynamoDbDocClient = createDDbDocClient();
  console.log("Event received:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    
    console.log("Received record body:", record.body);

    try {
      const sns = record.Sns;
      const message = JSON.parse(sns.Message)  
      
      const imageId = message.id; 
      const value = message.value;


    
    const updateParams: UpdateCommandInput = {
      TableName: DYNAMODB_TABLE_NAME,
      Key: {
        fileName: imageId ,
      },
      UpdateExpression: "SET #caption = :value",  
      ExpressionAttributeNames: {
        "#caption": "caption", 
      },
      ExpressionAttributeValues: {
        ":value": value, 
      },
      ReturnValues: ReturnValue.ALL_NEW,  
    };
    
      const result = await dynamoDbDocClient.send(new UpdateCommand(updateParams));
      console.log("Updated Item:", result.Attributes);
    } catch (error) {
      console.error("Error updating DynamoDB:", error);
    }
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
      wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}


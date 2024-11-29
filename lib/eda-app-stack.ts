import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';


export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,

      
    });
    // Table

    const imageTable = new dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "fileName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
      // Integration infrastructure
      const badImageQueue = new sqs.Queue(this, "dead-image", {
        retentionPeriod: cdk.Duration.seconds(60)
      });

      const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
        receiveMessageWaitTime: cdk.Duration.seconds(10),
        deadLetterQueue: {queue:badImageQueue, maxReceiveCount:1}
      });
      

      const newImageTopic = new sns.Topic(this, "NewImageTopic", {
        displayName: "New Image topic",
      });
      
      const validImageTopic = new sns.Topic(this, "ValidImageTopic", {
        displayName: "Valid Image Topic",
      });

      

  // Lambda functions

  const processImageFn = new lambdanode.NodejsFunction(
    this,
    "ProcessImageFn",
    {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/processImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      environment: {
        DYNAMODB_TABLE_NAME: imageTable.tableName
      }
    }
  );

  const mailerFn = new lambdanode.NodejsFunction(this, "mailer-function", {
    runtime: lambda.Runtime.NODEJS_16_X,
    memorySize: 1024,
    timeout: cdk.Duration.seconds(3),
    entry: `${__dirname}/../lambdas/mailer.ts`,
  });

  const rejectionMailerFn = new lambdanode.NodejsFunction(this, "rejection-mailer-function", {
  runtime: lambda.Runtime.NODEJS_16_X,
    memorySize: 1024,
    timeout: cdk.Duration.seconds(3),
    entry: `${__dirname}/../lambdas/rejectionMailer.ts`,
  });

  const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: `${__dirname}/../lambdas/logImage.ts`,
    timeout: cdk.Duration.seconds(10),
    memorySize: 128,
    environment: {
      DYNAMODB_TABLE_NAME: imageTable.tableName,
    },
  });




  imagesBucket.addEventNotification(
    s3.EventType.OBJECT_CREATED,
    new s3n.SnsDestination(newImageTopic)  
);

newImageTopic.addSubscription(
  new subs.SqsSubscription(imageProcessQueue)
);

newImageTopic.addSubscription(
  new subs.LambdaSubscription(mailerFn)
)

newImageTopic.addSubscription(
  new subs.LambdaSubscription(rejectionMailerFn)
)

validImageTopic.addSubscription(new subs.LambdaSubscription(logImageFn))







const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
  batchSize: 5,
  maxBatchingWindow: cdk.Duration.seconds(5),
});

const badImageEventSource = new events.SqsEventSource(badImageQueue, {
  batchSize: 5,
  maxBatchingWindow: cdk.Duration.seconds(5),
});



processImageFn.addEventSource(newImageEventSource);

rejectionMailerFn.addEventSource(badImageEventSource);

processImageFn.addEnvironment("VALID_IMAGE_TOPIC_ARN", validImageTopic.topicArn)
validImageTopic.grantPublish(processImageFn)



  // Permissions

  imagesBucket.grantRead(processImageFn);
  badImageQueue.grantConsumeMessages(rejectionMailerFn)
  imageTable.grantReadWriteData(processImageFn)
  imageTable.grantReadWriteData(logImageFn)

  mailerFn.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
      ],
      resources: ["*"],
    })
  );

  rejectionMailerFn.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
      ],
      resources: ["*"],
    })
  );
  
    

    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
  }
}

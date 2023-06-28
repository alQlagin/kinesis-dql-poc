import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {StartingPosition} from 'aws-cdk-lib/aws-lambda';
import * as lambdaSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambdaDestinations from 'aws-cdk-lib/aws-lambda-destinations';
import * as dynamoDb from 'aws-cdk-lib/aws-dynamodb';

export class KinesisPocStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // kinesis and dql
        const kinesisStream = new kinesis.Stream(this, 'PocStream', {
            streamName: 'poc-stream',
        });
        const dlq = new sqs.Queue(this, 'PocStreamDQL');


        // kinesis handler
        const kinesisLambdaHandler = new lambda.Function(this, 'PocStreamHandler', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset(path.join(__dirname, 'kinesis-handler')),
            handler: 'index.handler',
        });

        kinesisLambdaHandler.addEventSource(new eventSources.KinesisEventSource(kinesisStream, {
            startingPosition: StartingPosition.LATEST,
            onFailure: new lambdaDestinations.SqsDestination(dlq),
            retryAttempts: 1,
            maxRecordAge: cdk.Duration.minutes(10),
            maxBatchingWindow: cdk.Duration.minutes(1),
            batchSize: 3,
            bisectBatchOnError: true,
            reportBatchItemFailures: true
        }));

        // dql handler
        const dlqStreamLambdaHandler = new lambda.Function(this, 'PocDQLHandler', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset(path.join(__dirname, 'kinesis-handler')),
            handler: 'dlq.handler',
        });
        dlqStreamLambdaHandler.addEventSource(new lambdaSources.SqsEventSource(dlq));


        // DynamoDB
        new dynamoDb.Table(this, 'PocDataSource', {
            partitionKey: {name: 'id', type: dynamoDb.AttributeType.STRING},
            kinesisStream,
        });

    }
}

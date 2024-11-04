const cdk = require('aws-cdk-lib');
const apiGateway = require('aws-cdk-lib/aws-apigatewayv2');
const integrations = require('aws-cdk-lib/aws-apigatewayv2-integrations');
const lambda = require('aws-cdk-lib/aws-lambda');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const path = require("path");

class WebSocketCounterStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const STAGE = props.env.STAGE;
    const PROJECT_NAME = props.env.PROJECT_NAME;

    const counterTable = new dynamodb.Table(this, `${PROJECT_NAME}--WebSocketCounterTable--${STAGE}`, {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      readCapacity: 5,
      writeCapacity: 5,
      tableName: `${PROJECT_NAME}--WebSocketCounterTable--${STAGE}`,
    });

    // Lambda function for connection handling
    const connectHandler = new lambda.Function(this, `${PROJECT_NAME}--WSConnectHandler--${STAGE}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      functionName: `${PROJECT_NAME}--WSConnectHandler--${STAGE}`,
      handler: 'connect.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'functions-ws')),
      environment: {
        COUNTER_TABLE_NAME: counterTable.tableName,
      }
    });

    // Lambda function for disconnect handling
    const disconnectHandler = new lambda.Function(this, `${PROJECT_NAME}--WSDisconnectHandler--${STAGE}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      functionName: `${PROJECT_NAME}--WSDisconnectHandler--${STAGE}`,
      handler: 'disconnect.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'functions-ws')),
      environment: {
        COUNTER_TABLE_NAME: counterTable.tableName,
      }
    });

    // Lambda function for managing the counter (increment)
    const counterHandler = new lambda.Function(this, `${PROJECT_NAME}--WSCounterHandler--${STAGE}`, {
        runtime: lambda.Runtime.NODEJS_20_X,
        functionName: `${PROJECT_NAME}--WSCounterHandler--${STAGE}`,
        handler: 'counter.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, 'functions-ws')),
        environment: {
          COUNTER_TABLE_NAME: counterTable.tableName,
        }
    });

    // Grant the permissions to read and write to the DynamoDB table
    counterTable.grantReadWriteData(connectHandler);
    counterTable.grantReadWriteData(disconnectHandler);
    counterTable.grantReadWriteData(counterHandler);

    // WebSocket API definition
    const webSocketApi = new apiGateway.WebSocketApi(this, `${PROJECT_NAME}--WebSocketCounterAPI--${STAGE}`, {
      apiName: `${PROJECT_NAME}--WebSocketCounterAPI--${STAGE}`,
      connectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', connectHandler) },
      disconnectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', disconnectHandler) },
    });

    // Route for counting events
    webSocketApi.addRoute('count', {
      integration: new integrations.WebSocketLambdaIntegration(`${PROJECT_NAME}--WSCounterIntegration--${STAGE}`, counterHandler),
    });

    // WebSocket API Stage
    new apiGateway.WebSocketStage(this, `${PROJECT_NAME}--WebSocketCounterStage--${STAGE}`, {
      webSocketApi,
      stageName: STAGE,
      autoDeploy: true,
    });


    // Grant WebSocket API permissions to manage connections if needed
    webSocketApi.grantManageConnections(connectHandler);
    webSocketApi.grantManageConnections(disconnectHandler);
    webSocketApi.grantManageConnections(counterHandler);
  }
}

module.exports = { WebSocketCounterStack };

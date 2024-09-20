const cdk = require('aws-cdk-lib');
const iam = require("aws-cdk-lib/aws-iam");
const dynamoDb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const apiGateway = require("aws-cdk-lib/aws-apigateway");
const path = require("path");

class BackendStack extends cdk.Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const STAGE = props.env.STAGE;
    const PROJECT_NAME = props.env.PROJECT_NAME;
    const CLOUDFRONT_URL = props.env.CLOUDFRONT_URL;

    const myDB = new dynamoDb.TableV2(
      this,
      `${PROJECT_NAME}--myDB--${STAGE}`,
      {
        tableName: `${PROJECT_NAME}--myDB--${STAGE}`,
        partitionKey: {
          name: "item",
          type: dynamoDb.AttributeType.STRING,
        },
        sortKey: {
          name: "time",
          type: dynamoDb.AttributeType.STRING,
        },
      }
    );


    const lambdaLayer = new lambda.LayerVersion(this, `${PROJECT_NAME}--fn-layer--${STAGE}`, {
      layerVersionName: `${PROJECT_NAME}--fn-layer--${STAGE}`,
      code: lambda.Code.fromAsset(path.join(__dirname, 'functions'), {
        bundling: {
            image: lambda.Runtime.NODEJS_20_X.bundlingImage,
            command: [
                'bash', '-c',
                'mkdir -p /asset-output/nodejs && cp -r ./node_modules /asset-output/nodejs/'
            ],
        },
      }),
      compatibleArchitectures: [lambda.Architecture.X86_64, lambda.Architecture.ARM_64],
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X, lambda.Runtime.NODEJS_20_X]
    });

    const lambdaFnDynamoDb = new lambda.Function(
      this,
      `${PROJECT_NAME}--lambda-fn-${STAGE}`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handle/index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, 'functions'), { exclude: ['node_modules'] }),
        functionName: `${PROJECT_NAME}--lambda-fn-${STAGE}`,
        environment: {
          STAGE: STAGE,
          PROJECT_NAME: PROJECT_NAME,
          CLOUDFRONT_URL: CLOUDFRONT_URL,
        },
        layers: [lambdaLayer]
      }
    );

    myDB.grantReadWriteData(lambdaFnDynamoDb);
    // the below grants the Lambda fn basic things (like logs)
    lambdaFnDynamoDb.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );

    const api = new apiGateway.LambdaRestApi(
      this,
      `${PROJECT_NAME}--api--${STAGE}`,
      {
        handler: lambdaFnDynamoDb,
        deployOptions: {
          stageName: STAGE,
        },
        proxy: false,
        restApiName: `${PROJECT_NAME}--api--${STAGE}`,
        description: "API to get/update/post/delete items",
        defaultCorsPreflightOptions: {
          allowOrigins: ['http://localhost:3000', CLOUDFRONT_URL],
          allowMethods: apiGateway.Cors.ALL_METHODS,
        },
      }
    );
    const route = api.root.addResource("api");
    const v1_route = route.addResource("v1")
    v1_route.addMethod("GET");
    v1_route.addMethod("POST");
    v1_route.addMethod("PUT");
    v1_route.addMethod("DELETE");
  }
}

module.exports = { BackendStack };

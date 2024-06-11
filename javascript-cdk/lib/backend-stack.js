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

    const myDB = new dynamoDb.TableV2(
      this,
      `${props.env.projectName}--myDB--${props.env.stage}`,
      {
        tableName: `${props.env.projectName}--myDB--${props.env.stage}`,
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

    const lambdaFnDynamoDb = new lambda.Function(
      this,
      `${props.env.projectName}--lambda-fn-${props.env.stage}`,
      {
        runtime: lambda.Runtime.NODEJS_18_X, // NODEJS_20_X currently not working.
        handler: "index.handle",
        code: lambda.Code.fromAsset(path.join(__dirname, "functions")),
        functionName: `${props.env.projectName}--lambda-fn-${props.env.stage}`,
        environment: {
          env: props.env.stage,
          projectName: props.env.projectName,
          site_url_test: props.env.site_url_test,
          site_url_live: props.env.site_url_live,
        },
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
      `${props.env.projectName}--api--${props.env.stage}`,
      {
        handler: lambdaFnDynamoDb,
        deployOptions: {
          stageName: props.env.stage,
        },
        proxy: false,
        restApiName: `${props.env.projectName}--api--${props.env.stage}`,
        description: "API to get/update/post/delete items",
        defaultCorsPreflightOptions: {
          allowOrigins:
            props.env.stage === "prod"
              ? [props.env.site_url_live]
              : ["http://localhost:3000", props.env.site_url_test],
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

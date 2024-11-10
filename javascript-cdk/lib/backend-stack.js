const cdk = require('aws-cdk-lib');
const iam = require("aws-cdk-lib/aws-iam");
const dynamoDb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const apiGateway = require("aws-cdk-lib/aws-apigateway");
const acm = require('aws-cdk-lib/aws-certificatemanager');
const s3 = require('aws-cdk-lib/aws-s3');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
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
    const CLOUDFRONT_USERNAME = props.env.CLOUDFRONT_USERNAME;
    const CLOUDFRONT_PASSWORD = props.env.CLOUDFRONT_PASSWORD;
    const CERTIFICATE_ARN = props.env.CERTIFICATE_ARN;
  
    const account = cdk.Stack.of(this).account;

    const ssl_cert = acm.Certificate.fromCertificateArn(this, `${PROJECT_NAME}--certificate--${STAGE}`, CERTIFICATE_ARN); // uploaded manually

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


    const cfFunction = new cloudfront.Function(this, `${PROJECT_NAME}--cf-fn--${STAGE}`, {
        code: cloudfront.FunctionCode.fromInline(`function handler(event) {
              const expectedUsername = "${CLOUDFRONT_USERNAME}";
              const expectedPassword = "${CLOUDFRONT_PASSWORD}";

              let request = event.request;
              const headers = request.headers;
              const isProd = headers.host.value === 'prod_domain_goes_here';

              // Redirect if the request is from the CloudFront domain
              if (['d3e8kfpm2wxov0.cloudfront.net'].includes(headers.host.value)) {
                  const customDomain = headers.host.value === "d3e8kfpm2wxov0.cloudfront.net" ? "test-project-javascript.illusha.net" : "test-project-javascript.illusha.net"

                  return {
                      statusCode: 301,
                      statusDescription: 'Moved Permanently',
                      headers: {
                          'location': { value: 'https://' + customDomain + request.uri }
                      }
                  };
              }

              const objReject = {
                  statusCode: 401,
                  statusDescription: 'Unauthorized',
                  headers: {
                      'www-authenticate': { value: 'Basic' },
                  },
              };

              if (!isProd) {
                  if (!headers.authorization) {
                      return objReject;
                  }
              
                  const authHeader = headers.authorization.value;
                  const authString = authHeader.split(' ')[1];
                  const authDecoded = Buffer.from(authString, 'base64').toString('utf-8');
                  const split = authDecoded.split(':');
              
                  if (split[0] !== expectedUsername || split[1] !== expectedPassword) {
                      return objReject;
                  }
              }

              request.uri = request.uri.replace(/^(.*?)(\\/[^.\\/]*\\.[^.\\/]*)?\\/?$/, function($0, $1, $2) {
                  return $1 + ($2 ? $2 : "/index.html");
              });

              return request;
        }`),
        runtime: cloudfront.FunctionRuntime.JS_2_0,
        functionName: `${PROJECT_NAME}--cf-fn--${STAGE}`,
        comment: 'CF function to handle redirects, basic auth, redirects from cf domain to a custom one etc.',
    });

    const websiteBucket = new s3.Bucket(this, `${PROJECT_NAME}--s3-site--${STAGE}`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      bucketName: `${PROJECT_NAME}--s3-site--${STAGE}`,
    });

     // Add CORS configuration
     websiteBucket.addCorsRule({
      allowedHeaders: ['*'],
      allowedMethods: [
        s3.HttpMethods.POST,
      ],
      allowedOrigins: ['http://localhost:3000', CLOUDFRONT_URL],
      maxAge: 3000,
    });

    const oac = new cloudfront.S3OriginAccessControl(this, `${PROJECT_NAME}--oac--${STAGE}`, {
        originAccessControlName: `${PROJECT_NAME}--oac--${STAGE}`,
        signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // CloudFront
    const cf = new cloudfront.Distribution(this, `${PROJECT_NAME}--cf--${STAGE}`, {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket, {
            originAccessControl: oac,
            originPath: '/site',
        }),
        functionAssociations: [{
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: cfFunction,
        }],
      },
      // additionalBehaviors: {
      //   '/api/*': {
      //     origin: new origins.HttpOrigin(`${PROJECT_NAME}-${STAGE}.illusha.net`, {
      //       originPath: '/api',
      //     }),
      //     cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      //     originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      //   },
      // },
      certificate: ssl_cert,
      domainNames: [`${PROJECT_NAME}-${STAGE}.illusha.net`],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      sslSupportMethod: cloudfront.SSLMethod.SNI,
      defaultRootObject: 'index.html',
    });

    // Add the below so that it handles the files (if file is not avaialbe, it returns 404, not 403)
    websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:ListBucket'],
        resources: [websiteBucket.bucketArn],
        conditions: {
            StringEquals: {
              "aws:SourceArn": `arn:aws:cloudfront::${account}:distribution/${cf.distributionId}`,
            },
        }
      })
    );
    // add for PresignUrl
    websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
        sid: "Deny a presigned URL request if the signature is more than 10 min old",
        effect: iam.Effect.DENY,
        principals: [new iam.ArnPrincipal("*")],
        actions: ['s3:PutObject'],
        resources: [`${websiteBucket.bucketArn}/files/*`],
        conditions: {
            NumericGreaterThan: {
              "s3:signatureAge": 60000 // give 1 min to upload a file to S3
            },
        }
      })
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

    // Allow Lambda fn to sent SES emails
    lambdaFnDynamoDb.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
            "ses:SendRawEmail",
        ],
        resources: "*",
        effect: iam.Effect.ALLOW,
        conditions: {
          StringEquals: {
            "ses:FromAddress": `${PROJECT_NAME}-${STAGE}@devemail.illusha.net`,
          }
        }
      }),
    );
    lambdaFnDynamoDb.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: [`${websiteBucket.bucketArn}/files/*`],
        effect: iam.Effect.ALLOW,
      }),
    )

    const api = new apiGateway.LambdaRestApi(
      this,
      `${PROJECT_NAME}--api--${STAGE}`,
      {
        handler: lambdaFnDynamoDb,
        deployOptions: {
          stageName: STAGE,
          description: `API template using AWS CDK ${STAGE}`,
        },
        domainName: {
          domainName: `api-${PROJECT_NAME}-${STAGE}.illusha.net`, // test-project-javascript.illusha.net OR is multiple projects use the same API can be api.*
          certificate: ssl_cert,
          // basePath: 'api'
        },
        proxy: false,
        restApiName: `${PROJECT_NAME}--api--${STAGE}`,
        description: "API to get/update/post/delete items",
        defaultCorsPreflightOptions: {
          allowOrigins: ['http://localhost:3000', CLOUDFRONT_URL],
          allowMethods: apiGateway.Cors.ALL_METHODS,
        },
        disableExecuteApiEndpoint: true,
        binaryMediaTypes: ['multipart/form-data'],
      }
    );
    const route = api.root.addResource("v1");
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => {
      route.addMethod(method, new apiGateway.LambdaIntegration(lambdaFnDynamoDb), {
        apiKeyRequired: true,
        requestParameters: {
          'method.request.header.x-api-key': true,
        }
      });
    });

    // const subRoute = route.addResource('{subpath}');
    // subRoute.addMethod('GET');
    // subRoute.addMethod('POST');
    // subRoute.addMethod('PUT');
    // subRoute.addMethod('DELETE');

    const apiUsagePlan = api.addUsagePlan(`${PROJECT_NAME}--api-usage-plan--${STAGE}`, {
      name: `${PROJECT_NAME}--api-usage-plan--${STAGE}`,
      description: `API usage plan to handle number of requests.`,
      quota: {
        limit: 1000,
        period: apiGateway.Period.DAY,
      },
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
    });

    const apiKeykey = api.addApiKey(`${PROJECT_NAME}--api-key--${STAGE}`, {
      apiKeyName: `${PROJECT_NAME}--api-key--${STAGE}`,
      description: `API Key for ${PROJECT_NAME}--api-key--${STAGE} project.`
    });
    apiUsagePlan.addApiKey(apiKeykey);
    apiUsagePlan.addApiStage({
      stage: api.deploymentStage,
    });
  }
}

module.exports = { BackendStack };

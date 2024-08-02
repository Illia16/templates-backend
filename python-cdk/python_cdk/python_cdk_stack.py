# import os
from aws_cdk import (
    # Duration,
    Stack,
    aws_dynamodb as dynamodb,
    aws_lambda,
    aws_iam,
    aws_apigateway
    # aws_sqs as sqs,
)
from constructs import Construct

class PythonCdkStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, otherProps: dict, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)
        self.otherProps = otherProps

        # The code that defines your stack goes here
        account = kwargs.get('env').account
        region = kwargs.get('env').region

        stage = otherProps['stage']
        projectName = otherProps['projectName']
        site_url_test = otherProps['site_url_test']
        site_url_live = otherProps['site_url_live']

        myDB = dynamodb.TableV2(self, f"{projectName}--myDB--{stage}",
            table_name=f"{projectName}--myDB--{stage}",
            partition_key=dynamodb.Attribute(name="item", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="time", type=dynamodb.AttributeType.STRING)
        )

        lambdaFbDynamoDb = aws_lambda.Function(self, f"{projectName}--lambda-fn-{stage}",
            runtime=aws_lambda.Runtime.PYTHON_3_11,
            handler="handleDb.lambda_db_handler",
            code=aws_lambda.Code.from_asset(
                'lambda_fn',
                # bundling=aws_lambda.BundlingOptions(
                #     image=aws_lambda.Runtime.PYTHON_3_11.bundling_image,
                #     command=[
                #         "bash", "-c",
                #         "pip install --no-cache -r requirements.txt -t /asset-output && cp -au . /asset-output"
                #     ],
                # ),
            ),
            # code=aws_lambda.Code.from_asset('python_cdk/functions/handle'),
            # code=aws_lambda.Code.from_asset(os.path.join(os.path.dirname(__file__), "functions/handle")),
            function_name=f"{projectName}--lambda-fn-{stage}",
            environment={
                'env': stage,
                'projectName': projectName,
                'site_url_test': site_url_test,
                'site_url_live': site_url_live,
            }
        )

        myDB.grant_read_write_data(lambdaFbDynamoDb)

        lambdaFbDynamoDb.role.add_managed_policy(
            aws_iam.ManagedPolicy.from_aws_managed_policy_name(
                "service-role/AWSLambdaBasicExecutionRole"
            )
        )

        api = aws_apigateway.LambdaRestApi(self, f"{projectName}--api--{stage}",
            handler=lambdaFbDynamoDb,
            deploy_options={
                "stage_name": stage,
            },
            proxy=False,
            rest_api_name=f"{projectName}--api--{stage}",
            description="API to get/update/post/delete items",
            default_cors_preflight_options=aws_apigateway.CorsOptions(
                allow_origins=site_url_live if stage == "prod" else ["http://localhost:3000", site_url_test],
                allow_methods=aws_apigateway.Cors.ALL_METHODS
            )
        )

        route = api.root.add_resource('api')
        v1_route = route.add_resource("v1")
        v1_route.add_method("GET")
        v1_route.add_method("POST")
        v1_route.add_method("PUT")
        v1_route.add_method("DELETE")
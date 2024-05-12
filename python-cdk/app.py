#!/usr/bin/env python3
# import os

import aws_cdk as cdk

from python_cdk.python_cdk_stack import PythonCdkStack

app = cdk.App()
environment = app.node.try_get_context('env')
account = app.node.try_get_context('account')
project_name = app.node.try_get_context('projectName')
site_url_test = app.node.try_get_context('site_url_test')
site_url_live = app.node.try_get_context('site_url_live')

PythonCdkStack(app, f"{project_name}-stack-{environment}",
    # If you don't specify 'env', this stack will be environment-agnostic.
    # Account/Region-dependent features and context lookups will not work,
    # but a single synthesized template can be deployed anywhere.

    # Uncomment the next line to specialize this stack for the AWS Account
    # and Region that are implied by the current CLI configuration.

    # env=cdk.Environment(account=os.getenv('account'), region=os.getenv('us-east-1')),
    env=cdk.Environment(account=account, region='us-east-1'),
    otherProps={'stage': environment, 'projectName': project_name, 'site_url_test': site_url_test, 'site_url_live': site_url_live},
                        

    # Uncomment the next line if you know exactly what Account and Region you
    # want to deploy the stack to. */

    # env=cdk.Environment(account='123456789012', region='us-east-1'),

    # For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html
    )

app.synth()
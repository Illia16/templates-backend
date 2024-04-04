#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { BackendStack } = require('../lib/backend-stack');

const app = new cdk.App();
const environment = app.node.tryGetContext('env');
const account = app.node.tryGetContext('account');
const projectName = app.node.tryGetContext('projectName');
const site_url_test = app.node.tryGetContext('site_url_test');
const site_url_live = app.node.tryGetContext('site_url_live');

new BackendStack(app, `${projectName}-stack-${environment}`, {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  env: { account, region: 'us-east-1', stage: environment, projectName, site_url_test, site_url_live },
});

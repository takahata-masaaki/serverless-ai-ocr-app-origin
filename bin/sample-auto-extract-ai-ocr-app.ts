#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OcrStarterStack } from '../lib/ocr_starter_stack';

const app = new cdk.App();
new OcrStarterStack(app, 'OcrStarterStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

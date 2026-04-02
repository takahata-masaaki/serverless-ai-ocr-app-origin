#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OcrStarterStack } from '../lib/ocr_starter_stack';
import { SampleAutoExtractAiOcrAppStack } from '../lib/sample-auto-extract-ai-ocr-app-stack';

const app = new cdk.App();
new OcrStarterStack(app, 'OcrStarterStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
new SampleAutoExtractAiOcrAppStack(app, 'OcrAppStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

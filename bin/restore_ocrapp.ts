#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SampleAutoExtractAiOcrAppStack } from '../lib/sample-auto-extract-ai-ocr-app-stack';

const app = new cdk.App();

new SampleAutoExtractAiOcrAppStack(app, 'OcrAppStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  stackName: 'OcrAppStack',
});

app.synth();

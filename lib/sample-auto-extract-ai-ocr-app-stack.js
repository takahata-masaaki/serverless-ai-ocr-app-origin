"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SampleAutoExtractAiOcrAppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3n = __importStar(require("aws-cdk-lib/aws-s3-notifications"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class SampleAutoExtractAiOcrAppStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ---- parameters (use existing resources by name) ----
        const bucketName = new cdk.CfnParameter(this, 'BucketName', {
            type: 'String',
            default: 'ocrappstack-apidocumentbucket1e0f08d4-olnl5bocx2v3',
        });
        const jobsTableName = new cdk.CfnParameter(this, 'JobsTableName', {
            type: 'String',
            default: 'OcrAppStack-DatabaseJobsTable7C20F61C-25WQGT70DRID',
        });
        const imagesTableName = new cdk.CfnParameter(this, 'ImagesTableName', {
            type: 'String',
            default: 'OcrStarterStack-DatabaseImagesTable50A0FC36-DUJU7RD1D23Z',
        });
        const modelId = new cdk.CfnParameter(this, 'ModelId', {
            type: 'String',
            default: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        });
        const modelRegion = new cdk.CfnParameter(this, 'ModelRegion', {
            type: 'String',
            default: 'us-east-1',
        });
        // ---- imports ----
        const bucket = s3.Bucket.fromBucketName(this, 'DocBucket', bucketName.valueAsString);
        const jobsTable = dynamodb.Table.fromTableName(this, 'JobsTable', jobsTableName.valueAsString);
        const imagesTable = dynamodb.Table.fromTableName(this, 'ImagesTable', imagesTableName.valueAsString);
        // ---- Lambdas ----
        const apiStart = new lambda.Function(this, 'ApiStartFunction', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/ocrapp/api_start'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                BUCKET_NAME: bucketName.valueAsString,
                JOBS_TABLE_NAME: jobsTableName.valueAsString,
                IMAGES_TABLE_NAME: imagesTableName.valueAsString,
            },
        });
        const apiResult = new lambda.Function(this, 'ApiResultFunction', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/ocrapp/api_result'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                BUCKET_NAME: bucketName.valueAsString,
                JOBS_TABLE_NAME: jobsTableName.valueAsString,
            },
        });
        const ocrWorker = new lambda.Function(this, 'ApiWorkerFunctionRebuild', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/ocrapp/ocr_worker'),
            timeout: cdk.Duration.seconds(120),
            memorySize: 512,
            reservedConcurrentExecutions: 1,
            environment: {
                BUCKET_NAME: bucketName.valueAsString,
                JOBS_TABLE_NAME: jobsTableName.valueAsString,
                MODEL_ID: modelId.valueAsString,
                MODEL_REGION: modelRegion.valueAsString,
                LLM_MAX_CHARS: '12000',
                LLM_MAX_TOKENS: '1200',
            },
        });
        const uploadWorker = new lambda.Function(this, 'UploadWorkerFunctionRebuild', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/ocrapp/upload_worker'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            reservedConcurrentExecutions: 1,
            environment: {
                JOBS_TABLE_NAME: jobsTableName.valueAsString,
                OCR_WORKER_FN: ocrWorker.functionName,
            },
        });
        apiStart.addEnvironment('OCR_WORKER_FN', ocrWorker.functionName);
        // ---- permissions ----
        jobsTable.grantReadWriteData(apiStart);
        imagesTable.grantReadWriteData(apiStart);
        jobsTable.grantReadData(apiResult);
        ocrWorker.grantInvoke(apiStart);
        jobsTable.grantReadWriteData(uploadWorker);
        jobsTable.grantReadWriteData(ocrWorker);
        bucket.grantPut(apiStart, 'uploads/*');
        bucket.grantReadWrite(apiStart, 'schemas/*');
        bucket.grantPut(apiStart, 'schema-inputs/*');
        bucket.grantRead(uploadWorker, 'uploads/*');
        bucket.grantRead(ocrWorker, 'uploads/*');
        bucket.grantWrite(ocrWorker, 'outputs/*');
        ocrWorker.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: ['*'],
        }));
        ocrWorker.grantInvoke(uploadWorker);
        // ---- S3 trigger (uploads/) ----
        bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(uploadWorker), { prefix: 'uploads/' });
        // ---- API Gateway ----
        const api = new apigw.RestApi(this, 'OcrApi', {
            restApiName: 'OcrAppStack API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        api.root.addResource('images').addMethod('GET', new apigw.LambdaIntegration(apiStart));
        api.root.addResource('generate-presigned-url').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        api.root.addResource('upload-complete').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        const ocr = api.root.addResource('ocr');
        ocr.addResource('start').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        ocr.addResource('result').addResource('{job_id}').addMethod('GET', new apigw.LambdaIntegration(apiResult));
        const apps = ocr.addResource('apps');
        apps.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        apps.addMethod('POST', new apigw.LambdaIntegration(apiStart));
        apps.addResource('schema')
            .addResource('generate-presigned-url')
            .addMethod('POST', new apigw.LambdaIntegration(apiStart));
        const appItem = apps.addResource('{app_name}');
        appItem.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        appItem.addMethod('PUT', new apigw.LambdaIntegration(apiStart));
        const appSchema = appItem.addResource('schema');
        appSchema.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        appSchema.addMethod('PUT', new apigw.LambdaIntegration(apiStart));
        appSchema.addMethod('POST', new apigw.LambdaIntegration(apiStart));
        appSchema.addResource('generate')
            .addMethod('POST', new apigw.LambdaIntegration(apiStart));
        const customPrompt = appItem.addResource('custom-prompt');
        customPrompt.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        customPrompt.addMethod('PUT', new apigw.LambdaIntegration(apiStart));
        customPrompt.addMethod('POST', new apigw.LambdaIntegration(apiStart));
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    }
}
exports.SampleAutoExtractAiOcrAppStack = SampleAutoExtractAiOcrAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtcGxlLWF1dG8tZXh0cmFjdC1haS1vY3ItYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2FtcGxlLWF1dG8tZXh0cmFjdC1haS1vY3ItYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQywrREFBaUQ7QUFDakQsa0VBQW9EO0FBQ3BELG1FQUFxRDtBQUNyRCx1REFBeUM7QUFDekMsc0VBQXdEO0FBQ3hELHlEQUEyQztBQUUzQyxNQUFhLDhCQUErQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsd0RBQXdEO1FBQ3hELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzFELElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLG9EQUFvRDtTQUM5RCxDQUFDLENBQUM7UUFFSCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNoRSxJQUFJLEVBQUUsUUFBUTtZQUNkLE9BQU8sRUFBRSxvREFBb0Q7U0FDOUQsQ0FBQyxDQUFDO1FBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUNwRSxJQUFJLEVBQUUsUUFBUTtZQUNkLE9BQU8sRUFBRSwwREFBMEQ7U0FDcEUsQ0FBQyxDQUFDO1FBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7WUFDcEQsSUFBSSxFQUFFLFFBQVE7WUFDZCxPQUFPLEVBQUUsNENB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O0FBdktELHdFQXVLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWd3IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgczNuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1ub3RpZmljYXRpb25zJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcblxuZXhwb3J0IGNsYXNzIFNhbXBsZUF1dG9FeHRyYWN0QWlPY3JBcHBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIC0tLS0gcGFyYW1ldGVycyAodXNlIGV4aXN0aW5nIHJlc291cmNlcyBieSBuYW1lKSAtLS0tXG4gICAgY29uc3QgYnVja2V0TmFtZSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdCdWNrZXROYW1lJywge1xuICAgICAgdHlwZTogJ1N0cmluZycsXG4gICAgICBkZWZhdWx0OiAnb2NyYXBwc3RhY2stYXBpZG9jdW1lbnRidWNrZXQxZTBmMDhkNC1vbG5sNWJvY3gydjMnLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgam9ic1RhYmxlTmFtZSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdKb2JzVGFibGVOYW1lJywge1xuICAgICAgdHlwZTogJ1N0cmluZycsXG4gICAgICBkZWZhdWx0OiAnT2NyQXBwU3RhY2stRGF0YWJhc2VKb2JzVGFibGU3QzIwRjYxQy0yNVdRR1Q3MERSSUQnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaW1hZ2VzVGFibGVOYW1lID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ0ltYWdlc1RhYmxlTmFtZScsIHtcbiAgICAgIHR5cGU6ICdTdHJpbmcnLFxuICAgICAgZGVmYXVsdDogJ09jclN0YXJ0ZXJTdGFjay1EYXRhYmFzZUltYWdlc1RhYmxlNTBBMEZDMzYtRFVKVTdSRDFEMjNaJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IG1vZGVsSWQgPSBuZXcgY2RrLkNmblBhcmFtZXRlcih0aGlzLCAnTW9kZWxJZCcsIHtcbiAgICAgIHR5cGU6ICdTdHJpbmcnLFxuICAgICAgZGVmYXVsdDogJ3VzLmFudGhyb3BpYy5jbGF1ZGUtc29ubmV0LTQtMjAyNTA1MTQtdjE6MCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBtb2RlbFJlZ2lvbiA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdNb2RlbFJlZ2lvbicsIHtcbiAgICAgIHR5cGU6ICdTdHJpbmcnLFxuICAgICAgZGVmYXVsdDogJ3VzLWVhc3QtMScsXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tIGltcG9ydHMgLS0tLVxuICAgIGNvbnN0IGJ1Y2tldCA9IHMzLkJ1Y2tldC5mcm9tQnVja2V0TmFtZSh0aGlzLCAnRG9jQnVja2V0JywgYnVja2V0TmFtZS52YWx1ZUFzU3RyaW5nKTtcbiAgICBjb25zdCBqb2JzVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdKb2JzVGFibGUnLCBqb2JzVGFibGVOYW1lLnZhbHVlQXNTdHJpbmcpO1xuICAgIGNvbnN0IGltYWdlc1RhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnSW1hZ2VzVGFibGUnLCBpbWFnZXNUYWJsZU5hbWUudmFsdWVBc1N0cmluZyk7XG5cbiAgICAvLyAtLS0tIExhbWJkYXMgLS0tLVxuICAgIGNvbnN0IGFwaVN0YXJ0ID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXBpU3RhcnRGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvb2NyYXBwL2FwaV9zdGFydCcpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQlVDS0VUX05BTUU6IGJ1Y2tldE5hbWUudmFsdWVBc1N0cmluZyxcbiAgICAgICAgSk9CU19UQUJMRV9OQU1FOiBqb2JzVGFibGVOYW1lLnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIElNQUdFU19UQUJMRV9OQU1FOiBpbWFnZXNUYWJsZU5hbWUudmFsdWVBc1N0cmluZyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlSZXN1bHQgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlSZXN1bHRGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvb2NyYXBwL2FwaV9yZXN1bHQnKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBidWNrZXROYW1lLnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIEpPQlNfVEFCTEVfTkFNRTogam9ic1RhYmxlTmFtZS52YWx1ZUFzU3RyaW5nLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG9jcldvcmtlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaVdvcmtlckZ1bmN0aW9uUmVidWlsZCcsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvb2NyYXBwL29jcl93b3JrZXInKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEyMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQlVDS0VUX05BTUU6IGJ1Y2tldE5hbWUudmFsdWVBc1N0cmluZyxcbiAgICAgICAgSk9CU19UQUJMRV9OQU1FOiBqb2JzVGFibGVOYW1lLnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIE1PREVMX0lEOiBtb2RlbElkLnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIE1PREVMX1JFR0lPTjogbW9kZWxSZWdpb24udmFsdWVBc1N0cmluZyxcbiAgICAgICAgTExNX01BWF9DSEFSUzogJzEyMDAwJyxcbiAgICAgICAgTExNX01BWF9UT0tFTlM6ICcxMjAwJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGxvYWRXb3JrZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGxvYWRXb3JrZXJGdW5jdGlvblJlYnVpbGQnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL29jcmFwcC91cGxvYWRfd29ya2VyJyksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgSk9CU19UQUJMRV9OQU1FOiBqb2JzVGFibGVOYW1lLnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIE9DUl9XT1JLRVJfRk46IG9jcldvcmtlci5mdW5jdGlvbk5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYXBpU3RhcnQuYWRkRW52aXJvbm1lbnQoJ09DUl9XT1JLRVJfRk4nLCBvY3JXb3JrZXIuZnVuY3Rpb25OYW1lKTtcblxuICAgIC8vIC0tLS0gcGVybWlzc2lvbnMgLS0tLVxuICAgIGpvYnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpU3RhcnQpO1xuICAgIGltYWdlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlTdGFydCk7XG4gICAgam9ic1RhYmxlLmdyYW50UmVhZERhdGEoYXBpUmVzdWx0KTtcbiAgICBvY3JXb3JrZXIuZ3JhbnRJbnZva2UoYXBpU3RhcnQpO1xuICAgIGpvYnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodXBsb2FkV29ya2VyKTtcbiAgICBqb2JzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG9jcldvcmtlcik7XG5cbiAgICBidWNrZXQuZ3JhbnRQdXQoYXBpU3RhcnQsICd1cGxvYWRzLyonKTtcbiAgICBidWNrZXQuZ3JhbnRSZWFkV3JpdGUoYXBpU3RhcnQsICdzY2hlbWFzLyonKTtcbiAgICBidWNrZXQuZ3JhbnRQdXQoYXBpU3RhcnQsICdzY2hlbWEtaW5wdXRzLyonKTtcblxuICAgIGJ1Y2tldC5ncmFudFJlYWQodXBsb2FkV29ya2VyLCAndXBsb2Fkcy8qJyk7XG4gICAgYnVja2V0LmdyYW50UmVhZChvY3JXb3JrZXIsICd1cGxvYWRzLyonKTtcbiAgICBidWNrZXQuZ3JhbnRXcml0ZShvY3JXb3JrZXIsICdvdXRwdXRzLyonKTtcblxuICAgIG9jcldvcmtlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIG9jcldvcmtlci5ncmFudEludm9rZSh1cGxvYWRXb3JrZXIpO1xuXG4gICAgLy8gLS0tLSBTMyB0cmlnZ2VyICh1cGxvYWRzLykgLS0tLVxuICAgIGJ1Y2tldC5hZGRFdmVudE5vdGlmaWNhdGlvbihcbiAgICAgIHMzLkV2ZW50VHlwZS5PQkpFQ1RfQ1JFQVRFRCxcbiAgICAgIG5ldyBzM24uTGFtYmRhRGVzdGluYXRpb24odXBsb2FkV29ya2VyKSxcbiAgICAgIHsgcHJlZml4OiAndXBsb2Fkcy8nIH0sXG4gICAgKTtcblxuICAgIC8vIC0tLS0gQVBJIEdhdGV3YXkgLS0tLVxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlndy5SZXN0QXBpKHRoaXMsICdPY3JBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ09jckFwcFN0YWNrIEFQSScsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlndy5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWd3LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCdpbWFnZXMnKS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCdnZW5lcmF0ZS1wcmVzaWduZWQtdXJsJykuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG4gICAgYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VwbG9hZC1jb21wbGV0ZScpLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuXG4gICAgY29uc3Qgb2NyID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ29jcicpO1xuICAgIG9jci5hZGRSZXNvdXJjZSgnc3RhcnQnKS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBvY3IuYWRkUmVzb3VyY2UoJ3Jlc3VsdCcpLmFkZFJlc291cmNlKCd7am9iX2lkfScpLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVJlc3VsdCkpO1xuXG4gICAgY29uc3QgYXBwcyA9IG9jci5hZGRSZXNvdXJjZSgnYXBwcycpO1xuICAgIGFwcHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBzLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuXG4gICAgYXBwcy5hZGRSZXNvdXJjZSgnc2NoZW1hJylcbiAgICAgIC5hZGRSZXNvdXJjZSgnZ2VuZXJhdGUtcHJlc2lnbmVkLXVybCcpXG4gICAgICAuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG5cbiAgICBjb25zdCBhcHBJdGVtID0gYXBwcy5hZGRSZXNvdXJjZSgne2FwcF9uYW1lfScpO1xuICAgIGFwcEl0ZW0uYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBJdGVtLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG5cbiAgICBjb25zdCBhcHBTY2hlbWEgPSBhcHBJdGVtLmFkZFJlc291cmNlKCdzY2hlbWEnKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG4gICAgYXBwU2NoZW1hLmFkZFJlc291cmNlKCdnZW5lcmF0ZScpXG4gICAgICAuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG5cbiAgICBjb25zdCBjdXN0b21Qcm9tcHQgPSBhcHBJdGVtLmFkZFJlc291cmNlKCdjdXN0b20tcHJvbXB0Jyk7XG4gICAgY3VzdG9tUHJvbXB0LmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG4gICAgY3VzdG9tUHJvbXB0LmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG4gICAgY3VzdG9tUHJvbXB0LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVybCcsIHsgdmFsdWU6IGFwaS51cmwgfSk7XG4gIH1cbn1cbiJdfQ==
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
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class SampleAutoExtractAiOcrAppStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ---- parameters ----
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
        const usageMetricsTable = new dynamodb.Table(this, 'UsageMetricsTable', {
            partitionKey: { name: 'metric_date', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // ---- Lambdas ----
        const apiStart = new lambda.Function(this, 'ApiStartFunction', {
            description: 'OCR処理開始入口 (API Gateway経由)',
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/ocrapp/api_start'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            reservedConcurrentExecutions: 3,
            environment: {
                BUCKET_NAME: bucketName.valueAsString,
                JOBS_TABLE_NAME: jobsTableName.valueAsString,
                IMAGES_TABLE_NAME: imagesTableName.valueAsString,
            },
        });
        const ocrWorker = new lambda.Function(this, 'ApiWorkerFunctionRebuild', {
            description: 'OCR実処理ワーカー (Azure/LLM解析実行中)',
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/ocrapp/ocr_worker'),
            timeout: cdk.Duration.seconds(120),
            memorySize: 512,
            reservedConcurrentExecutions: 1,
            environment: {
                BUCKET_NAME: bucketName.valueAsString,
                JOBS_TABLE_NAME: jobsTableName.valueAsString,
                IMAGES_TABLE_NAME: imagesTableName.valueAsString,
                MODEL_ID: modelId.valueAsString,
                MODEL_REGION: modelRegion.valueAsString,
                AZURE_VISION_API_VERSION: 'v3.2',
                AZURE_VISION_ENDPOINT: 'https://japaneast.api.cognitive.microsoft.com',
                AZURE_VISION_KEY: 'KEY',
                OCR_ENGINE: 'yomitoku_ec2',
                YOMITOKU_EC2_URL: 'http://44.193.178.103:8000/ocr',
                ENABLE_OCR: 'true',
                AWS_LWA_PORT: '8080',
                LLM_MAX_CHARS: '2000',
                LLM_MAX_TOKENS: '200',
                USAGE_METRICS_TABLE_NAME: usageMetricsTable.tableName,
            },
        });
        apiStart.addEnvironment('OCR_WORKER_FN', ocrWorker.functionName);
        // ---- permissions ----
        jobsTable.grantReadWriteData(apiStart);
        imagesTable.grantReadWriteData(apiStart);
        ocrWorker.grantInvoke(apiStart);
        jobsTable.grantReadWriteData(ocrWorker);
        usageMetricsTable.grantReadWriteData(ocrWorker);
        bucket.grantPut(apiStart, 'uploads/*');
        bucket.grantRead(apiStart, 'uploads/*');
        bucket.grantRead(apiStart, 'outputs/*');
        bucket.grantReadWrite(apiStart, 'schemas/*');
        bucket.grantPut(apiStart, 'schema-inputs/*');
        bucket.grantRead(ocrWorker, 'uploads/*');
        bucket.grantWrite(ocrWorker, 'outputs/*');
        ocrWorker.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: ['*'],
        }));
        // ---- API Gateway ----
        const api = new apigw.RestApi(this, 'OcrApi', {
            restApiName: 'OcrAppStack API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        api.root.addResource('generate-presigned-url').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        api.root.addResource('upload-complete').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        api.root.addResource('images').addMethod('GET', new apigw.LambdaIntegration(apiStart));
        const ocr = api.root.addResource('ocr');
        ocr.addResource('start').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        ocr.addResource('result').addResource('{job_id}').addMethod('GET', new apigw.LambdaIntegration(apiStart));
        const ocrImages = ocr.addResource('images');
        ocrImages.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        const ocrImageItem = ocrImages.addResource('{image_id}');
        ocrImageItem.addMethod('DELETE', new apigw.LambdaIntegration(apiStart));
        const apps = ocr.addResource('apps');
        apps.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        apps.addMethod('POST', new apigw.LambdaIntegration(apiStart));
        apps.addResource('schema').addResource('generate-presigned-url').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        const appItem = apps.addResource('{app_name}');
        appItem.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        appItem.addMethod('PUT', new apigw.LambdaIntegration(apiStart));
        const appSchema = appItem.addResource('schema');
        appSchema.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        appSchema.addMethod('PUT', new apigw.LambdaIntegration(apiStart));
        appSchema.addMethod('POST', new apigw.LambdaIntegration(apiStart));
        appSchema.addResource('generate').addMethod('POST', new apigw.LambdaIntegration(apiStart));
        const customPrompt = appItem.addResource('custom-prompt');
        customPrompt.addMethod('GET', new apigw.LambdaIntegration(apiStart));
        customPrompt.addMethod('PUT', new apigw.LambdaIntegration(apiStart));
        customPrompt.addMethod('POST', new apigw.LambdaIntegration(apiStart));
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    }
}
exports.SampleAutoExtractAiOcrAppStack = SampleAutoExtractAiOcrAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtcGxlLWF1dG8tZXh0cmFjdC1haS1vY3ItYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2FtcGxlLWF1dG8tZXh0cmFjdC1haS1vY3ItYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQywrREFBaUQ7QUFDakQsa0VBQW9EO0FBQ3BELG1FQUFxRDtBQUNyRCx1REFBeUM7QUFDekMseURBQTJDO0FBRTNDLE1BQWEsOEJBQStCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0QsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix1QkFBdUI7UUFDdkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDMUQsSUFBSSxFQUFFLFFBQVE7WUFDZCxPQUFPLEVBQUUsb0RBQW9EO1NBQzlELENBQUMsQ0FBQztRQUVILE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ2hFLElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLG9EQUFvRDtTQUM5RCxDQUFDLENBQUM7UUFFSCxNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3BFLElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLDBEQUEwRDtTQUNwRSxDQUFDLENBQUM7UUFFSCxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNwRCxJQUFJLEVBQUUsUUFBUTtZQUNkLE9BQU8sRUFBRSw0Q0FBNEM7U0FDdEQsQ0FB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QVEsQ0FBQyxDQUFDO1FBQ2hELFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDbEUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNsRSxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ25FLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBRTNGLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDMUQsWUFBWSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNyRSxZQUFZLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLFlBQVksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFFdEUsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDeEQsQ0FBQztDQUNGO0FBN0pELHdFQTZKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWd3IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuXG5leHBvcnQgY2xhc3MgU2FtcGxlQXV0b0V4dHJhY3RBaU9jckFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gLS0tLSBwYXJhbWV0ZXJzIC0tLS1cbiAgICBjb25zdCBidWNrZXROYW1lID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ0J1Y2tldE5hbWUnLCB7XG4gICAgICB0eXBlOiAnU3RyaW5nJyxcbiAgICAgIGRlZmF1bHQ6ICdvY3JhcHBzdGFjay1hcGlkb2N1bWVudGJ1Y2tldDFlMGYwOGQ0LW9sbmw1Ym9jeDJ2MycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBqb2JzVGFibGVOYW1lID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ0pvYnNUYWJsZU5hbWUnLCB7XG4gICAgICB0eXBlOiAnU3RyaW5nJyxcbiAgICAgIGRlZmF1bHQ6ICdPY3JBcHBTdGFjay1EYXRhYmFzZUpvYnNUYWJsZTdDMjBGNjFDLTI1V1FHVDcwRFJJRCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBpbWFnZXNUYWJsZU5hbWUgPSBuZXcgY2RrLkNmblBhcmFtZXRlcih0aGlzLCAnSW1hZ2VzVGFibGVOYW1lJywge1xuICAgICAgdHlwZTogJ1N0cmluZycsXG4gICAgICBkZWZhdWx0OiAnT2NyU3RhcnRlclN0YWNrLURhdGFiYXNlSW1hZ2VzVGFibGU1MEEwRkMzNi1EVUpVN1JEMUQyM1onLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbW9kZWxJZCA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdNb2RlbElkJywge1xuICAgICAgdHlwZTogJ1N0cmluZycsXG4gICAgICBkZWZhdWx0OiAndXMuYW50aHJvcGljLmNsYXVkZS1zb25uZXQtNC0yMDI1MDUxNC12MTowJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IG1vZGVsUmVnaW9uID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ01vZGVsUmVnaW9uJywge1xuICAgICAgdHlwZTogJ1N0cmluZycsXG4gICAgICBkZWZhdWx0OiAndXMtZWFzdC0xJyxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0gaW1wb3J0cyAtLS0tXG4gICAgY29uc3QgYnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXROYW1lKHRoaXMsICdEb2NCdWNrZXQnLCBidWNrZXROYW1lLnZhbHVlQXNTdHJpbmcpO1xuICAgIGNvbnN0IGpvYnNUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ0pvYnNUYWJsZScsIGpvYnNUYWJsZU5hbWUudmFsdWVBc1N0cmluZyk7XG4gICAgY29uc3QgaW1hZ2VzVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdJbWFnZXNUYWJsZScsIGltYWdlc1RhYmxlTmFtZS52YWx1ZUFzU3RyaW5nKTtcblxuICAgIGNvbnN0IHVzYWdlTWV0cmljc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVc2FnZU1ldHJpY3NUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnbWV0cmljX2RhdGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIC0tLS0gTGFtYmRhcyAtLS0tXG4gICAgY29uc3QgYXBpU3RhcnQgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlTdGFydEZ1bmN0aW9uJywge1xuICAgICAgZGVzY3JpcHRpb246ICdPQ1Llh6bnkIbplovlp4vlhaXlj6MgKEFQSSBHYXRld2F557WM55SxKScsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL29jcmFwcC9hcGlfc3RhcnQnKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDMsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0TmFtZS52YWx1ZUFzU3RyaW5nLFxuICAgICAgICBKT0JTX1RBQkxFX05BTUU6IGpvYnNUYWJsZU5hbWUudmFsdWVBc1N0cmluZyxcbiAgICAgICAgSU1BR0VTX1RBQkxFX05BTUU6IGltYWdlc1RhYmxlTmFtZS52YWx1ZUFzU3RyaW5nLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG9jcldvcmtlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaVdvcmtlckZ1bmN0aW9uUmVidWlsZCcsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnT0NS5a6f5Yem55CG44Ov44O844Kr44O8IChBenVyZS9MTE3op6PmnpDlrp/ooYzkuK0pJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvb2NyYXBwL29jcl93b3JrZXInKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEyMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQlVDS0VUX05BTUU6IGJ1Y2tldE5hbWUudmFsdWVBc1N0cmluZyxcbiAgICAgICAgSk9CU19UQUJMRV9OQU1FOiBqb2JzVGFibGVOYW1lLnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIElNQUdFU19UQUJMRV9OQU1FOiBpbWFnZXNUYWJsZU5hbWUudmFsdWVBc1N0cmluZyxcbiAgICAgICAgTU9ERUxfSUQ6IG1vZGVsSWQudmFsdWVBc1N0cmluZyxcbiAgICAgICAgTU9ERUxfUkVHSU9OOiBtb2RlbFJlZ2lvbi52YWx1ZUFzU3RyaW5nLFxuXG4gICAgICAgIEFaVVJFX1ZJU0lPTl9BUElfVkVSU0lPTjogJ3YzLjInLFxuICAgICAgICBBWlVSRV9WSVNJT05fRU5EUE9JTlQ6ICdodHRwczovL2phcGFuZWFzdC5hcGkuY29nbml0aXZlLm1pY3Jvc29mdC5jb20nLFxuICAgICAgICBBWlVSRV9WSVNJT05fS0VZOiAnS0VZJyxcblxuICAgICAgICBPQ1JfRU5HSU5FOiAneW9taXRva3VfZWMyJyxcbiAgICAgICAgWU9NSVRPS1VfRUMyX1VSTDogJ2h0dHA6Ly80NC4xOTMuMTc4LjEwMzo4MDAwL29jcicsXG4gICAgICAgIEVOQUJMRV9PQ1I6ICd0cnVlJyxcblxuICAgICAgICBBV1NfTFdBX1BPUlQ6ICc4MDgwJyxcblxuICAgICAgICBMTE1fTUFYX0NIQVJTOiAnMjAwMCcsXG4gICAgICAgIExMTV9NQVhfVE9LRU5TOiAnMjAwJyxcblxuICAgICAgICBVU0FHRV9NRVRSSUNTX1RBQkxFX05BTUU6IHVzYWdlTWV0cmljc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhcGlTdGFydC5hZGRFbnZpcm9ubWVudCgnT0NSX1dPUktFUl9GTicsIG9jcldvcmtlci5mdW5jdGlvbk5hbWUpO1xuXG4gICAgLy8gLS0tLSBwZXJtaXNzaW9ucyAtLS0tXG4gICAgam9ic1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlTdGFydCk7XG4gICAgaW1hZ2VzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaVN0YXJ0KTtcbiAgICBcbiAgICBvY3JXb3JrZXIuZ3JhbnRJbnZva2UoYXBpU3RhcnQpO1xuICAgIGpvYnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEob2NyV29ya2VyKTtcbiAgICB1c2FnZU1ldHJpY3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEob2NyV29ya2VyKTtcblxuICAgIGJ1Y2tldC5ncmFudFB1dChhcGlTdGFydCwgJ3VwbG9hZHMvKicpO1xuICAgIGJ1Y2tldC5ncmFudFJlYWQoYXBpU3RhcnQsICd1cGxvYWRzLyonKTtcbiAgICBidWNrZXQuZ3JhbnRSZWFkKGFwaVN0YXJ0LCAnb3V0cHV0cy8qJyk7XG4gICAgYnVja2V0LmdyYW50UmVhZFdyaXRlKGFwaVN0YXJ0LCAnc2NoZW1hcy8qJyk7XG4gICAgYnVja2V0LmdyYW50UHV0KGFwaVN0YXJ0LCAnc2NoZW1hLWlucHV0cy8qJyk7XG4gICAgYnVja2V0LmdyYW50UmVhZChvY3JXb3JrZXIsICd1cGxvYWRzLyonKTtcbiAgICBidWNrZXQuZ3JhbnRXcml0ZShvY3JXb3JrZXIsICdvdXRwdXRzLyonKTtcblxuICAgIG9jcldvcmtlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIC0tLS0gQVBJIEdhdGV3YXkgLS0tLVxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlndy5SZXN0QXBpKHRoaXMsICdPY3JBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ09jckFwcFN0YWNrIEFQSScsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlndy5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWd3LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCdnZW5lcmF0ZS1wcmVzaWduZWQtdXJsJykuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG4gICAgYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VwbG9hZC1jb21wbGV0ZScpLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCdpbWFnZXMnKS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuXG4gICAgY29uc3Qgb2NyID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ29jcicpO1xuICAgIG9jci5hZGRSZXNvdXJjZSgnc3RhcnQnKS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBvY3IuYWRkUmVzb3VyY2UoJ3Jlc3VsdCcpLmFkZFJlc291cmNlKCd7am9iX2lkfScpLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG5cbiAgICBjb25zdCBvY3JJbWFnZXMgPSBvY3IuYWRkUmVzb3VyY2UoJ2ltYWdlcycpO1xuICAgIG9jckltYWdlcy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuICAgIGNvbnN0IG9jckltYWdlSXRlbSA9IG9jckltYWdlcy5hZGRSZXNvdXJjZSgne2ltYWdlX2lkfScpO1xuICAgIG9jckltYWdlSXRlbS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuXG4gICAgY29uc3QgYXBwcyA9IG9jci5hZGRSZXNvdXJjZSgnYXBwcycpO1xuICAgIGFwcHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBzLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuICAgIGFwcHMuYWRkUmVzb3VyY2UoJ3NjaGVtYScpLmFkZFJlc291cmNlKCdnZW5lcmF0ZS1wcmVzaWduZWQtdXJsJykuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG5cbiAgICBjb25zdCBhcHBJdGVtID0gYXBwcy5hZGRSZXNvdXJjZSgne2FwcF9uYW1lfScpO1xuICAgIGFwcEl0ZW0uYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBJdGVtLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG5cbiAgICBjb25zdCBhcHBTY2hlbWEgPSBhcHBJdGVtLmFkZFJlc291cmNlKCdzY2hlbWEnKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGFwaVN0YXJ0KSk7XG4gICAgYXBwU2NoZW1hLmFkZFJlc291cmNlKCdnZW5lcmF0ZScpLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuXG4gICAgY29uc3QgY3VzdG9tUHJvbXB0ID0gYXBwSXRlbS5hZGRSZXNvdXJjZSgnY3VzdG9tLXByb21wdCcpO1xuICAgIGN1c3RvbVByb21wdC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuICAgIGN1c3RvbVByb21wdC5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuICAgIGN1c3RvbVByb21wdC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXBpU3RhcnQpKTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7IHZhbHVlOiBhcGkudXJsIH0pO1xuICB9XG59XG4iXX0=
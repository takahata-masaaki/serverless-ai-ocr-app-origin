import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';

export class SampleAutoExtractAiOcrAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
    imagesTable.grantReadWriteData(apiStart); // APIが画像を削除できるように許可
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
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(uploadWorker),
      { prefix: 'uploads/' },
    );

    // ---- API Gateway ----
    const api = new apigw.RestApi(this, 'OcrApi', {
      restApiName: 'OcrAppStack API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // 元々のルート
    api.root.addResource('generate-presigned-url').addMethod('POST', new apigw.LambdaIntegration(apiStart));
    api.root.addResource('upload-complete').addMethod('POST', new apigw.LambdaIntegration(apiStart));
    api.root.addResource('images').addMethod('GET', new apigw.LambdaIntegration(apiStart));

    // OCR 関連ルート
    const ocr = api.root.addResource('ocr');
    ocr.addResource('start').addMethod('POST', new apigw.LambdaIntegration(apiStart));
    ocr.addResource('result').addResource('{job_id}').addMethod('GET', new apigw.LambdaIntegration(apiResult));

    // ★追加: UIが呼び出している /ocr/images/{image_id} に対する DELETE メソッドの許可
    const ocrImages = ocr.addResource('images');
    ocrImages.addMethod('GET', new apigw.LambdaIntegration(apiStart)); // 念のためGETも追加
    const ocrImageItem = ocrImages.addResource('{image_id}');
    ocrImageItem.addMethod('DELETE', new apigw.LambdaIntegration(apiStart));

    // Apps 関連ルート
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

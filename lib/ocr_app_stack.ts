import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class OcrAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const jobsTable = dynamodb.Table.fromTableName(this, 'JobsTable', 'OcrAppStack-DatabaseJobsTable7C20F61C-25WQGT70DRID');
    const docBucket = s3.Bucket.fromBucketName(this, 'DocBucket', 'ocrappstack-apidocumentbucket1e0f08d4-olnl5bocx2v3');
    
    // 💡【修正箇所】新規作成ではなく、既存のテーブル名を直接指定して参照する
    const usageTable = dynamodb.Table.fromTableName(this, 'UsageMetricsTable', 'UsageMetricsTable');

    const imagesTable = new dynamodb.Table(this, 'DatabaseImagesTable', {
      partitionKey: { name: 'app_name', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'image_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, 
    });

    const commonEnv = {
      BUCKET_NAME: docBucket.bucketName,
      JOBS_TABLE_NAME: jobsTable.tableName,
      IMAGES_TABLE_NAME: imagesTable.tableName,
      USAGE_METRICS_TABLE_NAME: usageTable.tableName,
      ENABLE_OCR: 'true',
      OCR_ENGINE: 'azure'
    };

    const ocrWorker = new lambda.Function(this, 'ApiWorkerFunctionRebuild', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/ocrapp/ocr_worker'),
      environment: commonEnv,
      timeout: cdk.Duration.minutes(5),
      reservedConcurrentExecutions: 5
    });

    const apiResult = new lambda.Function(this, 'ApiResultFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/ocrapp/api_result'),
      environment: commonEnv
    });

    // ここで既存の UsageMetricsTable に対するアクセス権限が正しく付与されます
    jobsTable.grantReadWriteData(ocrWorker);
    jobsTable.grantReadWriteData(apiResult);
    imagesTable.grantReadWriteData(ocrWorker);
    imagesTable.grantReadWriteData(apiResult);
    usageTable.grantReadWriteData(ocrWorker);
    usageTable.grantReadWriteData(apiResult);
    docBucket.grantReadWrite(ocrWorker);
    docBucket.grantReadWrite(apiResult);

    const api = new apigateway.RestApi(this, 'OcrApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });
    
    const ocrRes = api.root.addResource('ocr');
    const resultRes = ocrRes.addResource('result');
    const imageIdRes = resultRes.addResource('{image_id}');
    
    imageIdRes.addMethod('GET', new apigateway.LambdaIntegration(apiResult));
    imageIdRes.addMethod('DELETE', new apigateway.LambdaIntegration(apiResult));
  }
}

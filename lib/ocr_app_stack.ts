import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class OcrAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. 現存するリソース (あなたが確認した値を固定)
    const jobsTable = dynamodb.Table.fromTableName(this, 'JobsTable', 'OcrAppStack-DatabaseJobsTable7C20F61C-25WQGT70DRID');
    const docBucket = s3.Bucket.fromBucketName(this, 'DocBucket', 'ocrappstack-apidocumentbucket1e0f08d4-olnl5bocx2v3');

    // 2. 消失したテーブルをこのスタック内で再作成 
    const imagesTable = new dynamodb.Table(this, 'DatabaseImagesTable', {
      partitionKey: { name: 'app_name', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'image_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const schemasTable = new dynamodb.Table(this, 'DatabaseSchemasTable', {
      partitionKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // 3. Lambda 用の共通環境変数
    const commonEnv = {
      BUCKET_NAME: docBucket.bucketName,
      JOBS_TABLE_NAME: jobsTable.tableName,
      IMAGES_TABLE_NAME: imagesTable.tableName,
      SCHEMAS_TABLE_NAME: schemasTable.tableName,
      ENABLE_OCR: 'true'
    };

    // 4. 既存の Lambda 関数を定義 (または新規作成として定義)
    const apiStart = new lambda.Function(this, 'ApiStartFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/api/start'),
      environment: commonEnv
    });

    // 権限付与
    jobsTable.grantReadWriteData(apiStart);
    imagesTable.grantReadWriteData(apiStart);
    docBucket.grantReadWrite(apiStart);

    // 5. API Gateway
    const api = new apigateway.RestApi(this, 'OcrApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });
    api.root.addResource('ocr').addResource('start').addMethod('POST', new apigateway.LambdaIntegration(apiStart));
  }
}

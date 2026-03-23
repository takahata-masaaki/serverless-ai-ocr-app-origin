import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class OcrStarterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // リソースの参照
    const jobsTable = dynamodb.Table.fromTableName(this, 'JobsTable', 'OcrAppStack-DatabaseJobsTable7C20F61C-25WQGT70DRID');
    const docBucket = s3.Bucket.fromBucketName(this, 'DocBucket', 'ocrappstack-apidocumentbucket1e0f08d4-olnl5bocx2v3');
    const imagesTable = dynamodb.Table.fromTableName(this, 'ImagesTable', 'OcrStarterStack-DatabaseImagesTable50A0FC36-DUJU7RD1D23Z');
    const schemasTable = dynamodb.Table.fromTableName(this, 'SchemasTable', 'OcrStarterStack-DatabaseSchemasTableBFF5A513-1O9ELJON6XISM');
    
    // 実働部隊（Worker）の参照
    const workerLambda = lambda.Function.fromFunctionName(this, 'WorkerLambda', 'OcrAppStack-ApiWorkerFunctionRebuildDDC688FF-Q8iUloBfPyAw');

    const starterLambda = new lambda.Function(this, 'StarterLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/starter'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: docBucket.bucketName,
        JOBS_TABLE_NAME: jobsTable.tableName,
        IMAGES_TABLE_NAME: imagesTable.tableName,
        SCHEMAS_TABLE_NAME: schemasTable.tableName,
        ENABLE_OCR: 'true',
        OCR_WORKER_FN: workerLambda.functionName // ★Workerの名前を追加
      }
    });

    // 権限の付与
    docBucket.grantReadWrite(starterLambda);
    jobsTable.grantReadWriteData(starterLambda);
    imagesTable.grantReadWriteData(starterLambda);
    schemasTable.grantReadData(starterLambda);
    
    // ★受付係に、実働部隊を呼び出す(Invoke)権限を付与
    workerLambda.grantInvoke(starterLambda);

    const api = new apigateway.RestApi(this, 'OcrStarterApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      }
    });

    api.root.addResource('generate-presigned-url').addMethod('POST', new apigateway.LambdaIntegration(starterLambda));
    api.root.addResource('upload-complete').addMethod('POST', new apigateway.LambdaIntegration(starterLambda));
    api.root.addResource('images').addMethod('GET', new apigateway.LambdaIntegration(starterLambda));
    const ocr = api.root.addResource('ocr');
    ocr.addResource('start').addMethod('POST', new apigateway.LambdaIntegration(starterLambda));

    // ===== apps API（今回追加）=====
    const apps = ocr.addResource('apps');

    apps.addMethod('GET', new apigateway.LambdaIntegration(starterLambda));
    apps.addMethod('POST', new apigateway.LambdaIntegration(starterLambda));

    apps.addResource('schema')
      .addResource('generate-presigned-url')
      .addMethod('POST', new apigateway.LambdaIntegration(starterLambda));

    const appItem = apps.addResource('{app_name}');
    appItem.addMethod('GET', new apigateway.LambdaIntegration(starterLambda));
    appItem.addMethod('PUT', new apigateway.LambdaIntegration(starterLambda));

    const appSchema = appItem.addResource('schema');
    appSchema.addMethod('GET', new apigateway.LambdaIntegration(starterLambda));
    appSchema.addMethod('POST', new apigateway.LambdaIntegration(starterLambda));
    appSchema.addResource('generate')
      .addMethod('POST', new apigateway.LambdaIntegration(starterLambda));

    const customPrompt = appItem.addResource('custom-prompt');
    customPrompt.addMethod('GET', new apigateway.LambdaIntegration(starterLambda));
    customPrompt.addMethod('POST', new apigateway.LambdaIntegration(starterLambda));
  }
}

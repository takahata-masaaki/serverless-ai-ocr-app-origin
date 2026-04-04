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
exports.OcrStarterStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
class OcrStarterStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.OcrStarterStack = OcrStarterStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2NyX3N0YXJ0ZXJfc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvY3Jfc3RhcnRlcl9zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELG1FQUFxRDtBQUNyRCx1REFBeUM7QUFDekMsdUVBQXlEO0FBR3pELE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLFVBQVU7UUFDVixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLG9EQUFvRCxDQUFDLENBQUM7UUFDeEgsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxvREFBb0QsQ0FBQyxDQUFDO1FBQ3BILE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsMERBQTBELENBQUMsQ0FBQztRQUNsSSxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLDREQUE0RCxDQUFDLENBQUM7UUFFdEksa0JBQWtCO1FBQ2xCLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSwyREFBMkQsQ0FBQyxDQUFDO1FBRXpJLE1BQU0sYUFBYSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQy9ELE9BQU8sRUFBRSxNQUFNLENBQUMs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Q0FBQztRQUMvQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQzFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFFMUUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNoRCxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQzVFLFNBQVMsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDN0UsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUM7YUFDOUIsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBRXRFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDMUQsWUFBWSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUMvRSxZQUFZLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7Q0FDRjtBQTNFRCwwQ0EyRUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgT2NyU3RhcnRlclN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8g44Oq44K944O844K544Gu5Y+C54WnXG4gICAgY29uc3Qgam9ic1RhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnSm9ic1RhYmxlJywgJ09jckFwcFN0YWNrLURhdGFiYXNlSm9ic1RhYmxlN0MyMEY2MUMtMjVXUUdUNzBEUklEJyk7XG4gICAgY29uc3QgZG9jQnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXROYW1lKHRoaXMsICdEb2NCdWNrZXQnLCAnb2NyYXBwc3RhY2stYXBpZG9jdW1lbnRidWNrZXQxZTBmMDhkNC1vbG5sNWJvY3gydjMnKTtcbiAgICBjb25zdCBpbWFnZXNUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ0ltYWdlc1RhYmxlJywgJ09jclN0YXJ0ZXJTdGFjay1EYXRhYmFzZUltYWdlc1RhYmxlNTBBMEZDMzYtRFVKVTdSRDFEMjNaJyk7XG4gICAgY29uc3Qgc2NoZW1hc1RhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnU2NoZW1hc1RhYmxlJywgJ09jclN0YXJ0ZXJTdGFjay1EYXRhYmFzZVNjaGVtYXNUYWJsZUJGRjVBNTEzLTFPOUVMSk9ONlhJU00nKTtcbiAgICBcbiAgICAvLyDlrp/lg43pg6jpmorvvIhXb3JrZXLvvInjga7lj4LnhadcbiAgICBjb25zdCB3b3JrZXJMYW1iZGEgPSBsYW1iZGEuRnVuY3Rpb24uZnJvbUZ1bmN0aW9uTmFtZSh0aGlzLCAnV29ya2VyTGFtYmRhJywgJ09jckFwcFN0YWNrLUFwaVdvcmtlckZ1bmN0aW9uUmVidWlsZEREQzY4OEZGLVE4aVVsb0JmUHlBdycpO1xuXG4gICAgY29uc3Qgc3RhcnRlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0YXJ0ZXJMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3N0YXJ0ZXInKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBkb2NCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgSk9CU19UQUJMRV9OQU1FOiBqb2JzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBJTUFHRVNfVEFCTEVfTkFNRTogaW1hZ2VzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTQ0hFTUFTX1RBQkxFX05BTUU6IHNjaGVtYXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOQUJMRV9PQ1I6ICd0cnVlJyxcbiAgICAgICAgT0NSX1dPUktFUl9GTjogd29ya2VyTGFtYmRhLmZ1bmN0aW9uTmFtZSAvLyDimIVXb3JrZXLjga7lkI3liY3jgpLov73liqBcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIOaoqemZkOOBruS7mOS4jlxuICAgIGRvY0J1Y2tldC5ncmFudFJlYWRXcml0ZShzdGFydGVyTGFtYmRhKTtcbiAgICBqb2JzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHN0YXJ0ZXJMYW1iZGEpO1xuICAgIGltYWdlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzdGFydGVyTGFtYmRhKTtcbiAgICBzY2hlbWFzVGFibGUuZ3JhbnRSZWFkRGF0YShzdGFydGVyTGFtYmRhKTtcbiAgICBcbiAgICAvLyDimIXlj5fku5jkv4LjgavjgIHlrp/lg43pg6jpmorjgpLlkbzjgbPlh7rjgZkoSW52b2tlKeaoqemZkOOCkuS7mOS4jlxuICAgIHdvcmtlckxhbWJkYS5ncmFudEludm9rZShzdGFydGVyTGFtYmRhKTtcblxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ09jclN0YXJ0ZXJBcGknLCB7XG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCdnZW5lcmF0ZS1wcmVzaWduZWQtdXJsJykuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCd1cGxvYWQtY29tcGxldGUnKS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG4gICAgYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2ltYWdlcycpLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuICAgIGNvbnN0IG9jciA9IGFwaS5yb290LmFkZFJlc291cmNlKCdvY3InKTtcbiAgICBvY3IuYWRkUmVzb3VyY2UoJ3N0YXJ0JykuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuXG4gICAgLy8gPT09PT0gYXBwcyBBUEnvvIjku4rlm57ov73liqDvvIk9PT09PVxuICAgIGNvbnN0IGFwcHMgPSBvY3IuYWRkUmVzb3VyY2UoJ2FwcHMnKTtcblxuICAgIGFwcHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG4gICAgYXBwcy5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG5cbiAgICBhcHBzLmFkZFJlc291cmNlKCdzY2hlbWEnKVxuICAgICAgLmFkZFJlc291cmNlKCdnZW5lcmF0ZS1wcmVzaWduZWQtdXJsJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG5cbiAgICBjb25zdCBhcHBJdGVtID0gYXBwcy5hZGRSZXNvdXJjZSgne2FwcF9uYW1lfScpO1xuICAgIGFwcEl0ZW0uYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG4gICAgYXBwSXRlbS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcblxuICAgIGNvbnN0IGFwcFNjaGVtYSA9IGFwcEl0ZW0uYWRkUmVzb3VyY2UoJ3NjaGVtYScpO1xuICAgIGFwcFNjaGVtYS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuICAgIGFwcFNjaGVtYS5hZGRSZXNvdXJjZSgnZ2VuZXJhdGUnKVxuICAgICAgLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcblxuICAgIGNvbnN0IGN1c3RvbVByb21wdCA9IGFwcEl0ZW0uYWRkUmVzb3VyY2UoJ2N1c3RvbS1wcm9tcHQnKTtcbiAgICBjdXN0b21Qcm9tcHQuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG4gICAgY3VzdG9tUHJvbXB0LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcbiAgfVxufVxuIl19
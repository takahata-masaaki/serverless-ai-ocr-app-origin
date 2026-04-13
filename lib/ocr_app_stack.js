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
exports.OcrAppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
class OcrAppStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.OcrAppStack = OcrAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2NyX2FwcF9zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9jcl9hcHBfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCxtRUFBcUQ7QUFDckQsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUd6RCxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQUN4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsb0RBQW9ELENBQUMsQ0FBQztRQUN4SCxNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLG9EQUFvRCxDQUFDLENBQUM7UUFFcEgsdUNBQXVDO1FBQ3ZDLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBRWhHLE1BQU0sV0FBVyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbEUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDdkUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDbEUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILE1BQU0sU0FBUyxHQUFHO1lBQ2hCLFdBQVcsRUFBRSxTQUFTLENBQUMsVUFBVTtZQUNqQyxlQUFlLEVBQUUsU0FBUyxDQUFDLFNBQVM7WUFDcEMsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLFNBQVM7WUFDeEMsd0JBQXdCLEVBQUUsVUFBVSxDQUFDLFNBQVM7WUFDOUMsVUFBVSxFQUFFLE1BQU07WUFDbEIsVUFBVSxFQUFFLE9BQU87U0FDcEIsQ0FBQztRQUVGLE1BQU0sU0FBUyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDdEUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsMEJBQTBCLENBQUM7WUFDdkQsV0FBVyxFQUFFLFNBQVM7WUFDdEIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNoQyw0QkFBNEIsRUFBRSxDQUFDO1NBQ2hDLENBQUMsQ0FBQztRQUVILE1BQU0sU0FBUyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDL0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsMEJBQTBCLENBQUM7WUFDdkQsV0FBVyxFQUFFLFNBQVM7U0FDdkIsQ0FBQyxDQUFDO1FBRUgsZ0RBQWdEO1FBQ2hELFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN4QyxTQUFTLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDeEMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDekMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3pDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVwQyxNQUFNLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUNqRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVzthQUMxQztTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzNDLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDL0MsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV2RCxVQUFVLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3pFLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDOUUsQ0FBQztDQUNGO0FBbEVELGtDQWtFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBPY3JBcHBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGpvYnNUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ0pvYnNUYWJsZScsICdPY3JBcHBTdGFjay1EYXRhYmFzZUpvYnNUYWJsZTdDMjBGNjFDLTI1V1FHVDcwRFJJRCcpO1xuICAgIGNvbnN0IGRvY0J1Y2tldCA9IHMzLkJ1Y2tldC5mcm9tQnVja2V0TmFtZSh0aGlzLCAnRG9jQnVja2V0JywgJ29jcmFwcHN0YWNrLWFwaWRvY3VtZW50YnVja2V0MWUwZjA4ZDQtb2xubDVib2N4MnYzJyk7XG4gICAgXG4gICAgLy8g8J+SoeOAkOS/ruato+euh+aJgOOAkeaWsOimj+S9nOaIkOOBp+OBr+OBquOBj+OAgeaXouWtmOOBruODhuODvOODluODq+WQjeOCkuebtOaOpeaMh+WumuOBl+OBpuWPgueFp+OBmeOCi1xuICAgIGNvbnN0IHVzYWdlVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdVc2FnZU1ldHJpY3NUYWJsZScsICdVc2FnZU1ldHJpY3NUYWJsZScpO1xuXG4gICAgY29uc3QgaW1hZ2VzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0RhdGFiYXNlSW1hZ2VzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2FwcF9uYW1lJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ltYWdlX2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCBcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbW1vbkVudiA9IHtcbiAgICAgIEJVQ0tFVF9OQU1FOiBkb2NCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIEpPQlNfVEFCTEVfTkFNRTogam9ic1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIElNQUdFU19UQUJMRV9OQU1FOiBpbWFnZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBVU0FHRV9NRVRSSUNTX1RBQkxFX05BTUU6IHVzYWdlVGFibGUudGFibGVOYW1lLFxuICAgICAgRU5BQkxFX09DUjogJ3RydWUnLFxuICAgICAgT0NSX0VOR0lORTogJ2F6dXJlJ1xuICAgIH07XG5cbiAgICBjb25zdCBvY3JXb3JrZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlXb3JrZXJGdW5jdGlvblJlYnVpbGQnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL29jcmFwcC9vY3Jfd29ya2VyJyksXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiA1XG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlSZXN1bHQgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlSZXN1bHRGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvb2NyYXBwL2FwaV9yZXN1bHQnKSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZcbiAgICB9KTtcblxuICAgIC8vIOOBk+OBk+OBp+aXouWtmOOBriBVc2FnZU1ldHJpY3NUYWJsZSDjgavlr77jgZnjgovjgqLjgq/jgrvjgrnmqKnpmZDjgYzmraPjgZfjgY/ku5jkuI7jgZXjgozjgb7jgZlcbiAgICBqb2JzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG9jcldvcmtlcik7XG4gICAgam9ic1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlSZXN1bHQpO1xuICAgIGltYWdlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShvY3JXb3JrZXIpO1xuICAgIGltYWdlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlSZXN1bHQpO1xuICAgIHVzYWdlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG9jcldvcmtlcik7XG4gICAgdXNhZ2VUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpUmVzdWx0KTtcbiAgICBkb2NCdWNrZXQuZ3JhbnRSZWFkV3JpdGUob2NyV29ya2VyKTtcbiAgICBkb2NCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYXBpUmVzdWx0KTtcblxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ09jckFwaScsIHtcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgY29uc3Qgb2NyUmVzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ29jcicpO1xuICAgIGNvbnN0IHJlc3VsdFJlcyA9IG9jclJlcy5hZGRSZXNvdXJjZSgncmVzdWx0Jyk7XG4gICAgY29uc3QgaW1hZ2VJZFJlcyA9IHJlc3VsdFJlcy5hZGRSZXNvdXJjZSgne2ltYWdlX2lkfScpO1xuICAgIFxuICAgIGltYWdlSWRSZXMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlSZXN1bHQpKTtcbiAgICBpbWFnZUlkUmVzLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpUmVzdWx0KSk7XG4gIH1cbn1cbiJdfQ==
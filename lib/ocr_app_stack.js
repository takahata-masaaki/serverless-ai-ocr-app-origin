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
exports.OcrAppStack = OcrAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2NyX2FwcF9zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9jcl9hcHBfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCxtRUFBcUQ7QUFDckQsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUd6RCxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQUN4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDZCQUE2QjtRQUM3QixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLG9EQUFvRCxDQUFDLENBQUM7UUFDeEgsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxvREFBb0QsQ0FBQyxDQUFDO1FBRXBILDJCQUEyQjtRQUMzQixNQUFNLFdBQVcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ2xFLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3ZFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2xFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtTQUN4QyxDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ3BFLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ25FLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtTQUN4QyxDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsTUFBTSxTQUFTLEdBQUc7WUFDaEIsV0FBVyxFQUFFLFNBQVMsQ0FBQyxVQUFVO1lBQ2pDLGVBQWUsRUFBRSxTQUFTLENBQUMsU0FBUztZQUNwQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxrQkFBa0IsRUFBRSxZQUFZLENBQUMsU0FBUztZQUMxQyxVQUFVLEVBQUUsTUFBTTtTQUNuQixDQUFDO1FBRUYscUNBQXFDO1FBQ3JDLE1BQU0sUUFBUSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDN0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUM7WUFDL0MsV0FBVyxFQUFFLFNBQVM7U0FDdkIsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QyxXQUFXLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDekMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVuQyxpQkFBaUI7UUFDakIsTUFBTSxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDakQsMkJBQTJCLEVBQUU7Z0JBQzNCLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7YUFDMUM7U0FDRixDQUFDLENBQUM7UUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ2pILENBQUM7Q0FDRjtBQXJERCxrQ0FxREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgT2NyQXBwU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyAxLiDnj77lrZjjgZnjgovjg6rjgr3jg7zjgrkgKOOBguOBquOBn+OBjOeiuuiqjeOBl+OBn+WApOOCkuWbuuWumilcbiAgICBjb25zdCBqb2JzVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdKb2JzVGFibGUnLCAnT2NyQXBwU3RhY2stRGF0YWJhc2VKb2JzVGFibGU3QzIwRjYxQy0yNVdRR1Q3MERSSUQnKTtcbiAgICBjb25zdCBkb2NCdWNrZXQgPSBzMy5CdWNrZXQuZnJvbUJ1Y2tldE5hbWUodGhpcywgJ0RvY0J1Y2tldCcsICdvY3JhcHBzdGFjay1hcGlkb2N1bWVudGJ1Y2tldDFlMGYwOGQ0LW9sbmw1Ym9jeDJ2MycpO1xuXG4gICAgLy8gMi4g5raI5aSx44GX44Gf44OG44O844OW44Or44KS44GT44Gu44K544K/44OD44Kv5YaF44Gn5YaN5L2c5oiQIFxuICAgIGNvbnN0IGltYWdlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdEYXRhYmFzZUltYWdlc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdhcHBfbmFtZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdpbWFnZV9pZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2NoZW1hc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdEYXRhYmFzZVNjaGVtYXNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnbmFtZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgLy8gMy4gTGFtYmRhIOeUqOOBruWFsemAmueSsOWig+WkieaVsFxuICAgIGNvbnN0IGNvbW1vbkVudiA9IHtcbiAgICAgIEJVQ0tFVF9OQU1FOiBkb2NCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIEpPQlNfVEFCTEVfTkFNRTogam9ic1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIElNQUdFU19UQUJMRV9OQU1FOiBpbWFnZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBTQ0hFTUFTX1RBQkxFX05BTUU6IHNjaGVtYXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBFTkFCTEVfT0NSOiAndHJ1ZSdcbiAgICB9O1xuXG4gICAgLy8gNC4g5pei5a2Y44GuIExhbWJkYSDplqLmlbDjgpLlrprnvqkgKOOBvuOBn+OBr+aWsOimj+S9nOaIkOOBqOOBl+OBpuWumue+qSlcbiAgICBjb25zdCBhcGlTdGFydCA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaVN0YXJ0RnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FwaS9zdGFydCcpLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudlxuICAgIH0pO1xuXG4gICAgLy8g5qip6ZmQ5LuY5LiOXG4gICAgam9ic1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlTdGFydCk7XG4gICAgaW1hZ2VzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaVN0YXJ0KTtcbiAgICBkb2NCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYXBpU3RhcnQpO1xuXG4gICAgLy8gNS4gQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdPY3JBcGknLCB7XG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgfVxuICAgIH0pO1xuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCdvY3InKS5hZGRSZXNvdXJjZSgnc3RhcnQnKS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlTdGFydCkpO1xuICB9XG59XG4iXX0=
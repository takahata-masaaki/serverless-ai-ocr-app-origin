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
            reservedConcurrentExecutions: 1,
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
        const agent = ocr.addResource('agent');
        agent.addResource('{image_id}')
            .addMethod('POST', new apigateway.LambdaIntegration(starterLambda));
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
        // 💡【修正】正規ルートに対するDELETEメソッドを許可
        appItem.addMethod('DELETE', new apigateway.LambdaIntegration(starterLambda));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2NyX3N0YXJ0ZXJfc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvY3Jfc3RhcnRlcl9zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELG1FQUFxRDtBQUNyRCx1REFBeUM7QUFDekMsdUVBQXlEO0FBR3pELE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLFVBQVU7UUFDVixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLG9EQUFvRCxDQUFDLENBQUM7UUFDeEgsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxvREFBb0QsQ0FBQyxDQUFDO1FBQ3BILE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsMERBQTBELENBQUMsQ0FBQztRQUNsSSxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLDREQUE0RCxDQUFDLENBQUM7UUFFdEksa0JBQWtCO1FBQ2xCLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSwyREFBMkQsQ0FBQyxDQUFDO1FBRXpJLE1BQU0sYUFBYSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQy9ELDRCQUE0QixFQUFFLENBQUM7WUFD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Q0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQy9FLFlBQVksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7SUFDbEYsQ0FBQztDQUNGO0FBaEZELDBDQWdGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBPY3JTdGFydGVyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDjg6rjgr3jg7zjgrnjga7lj4LnhadcbiAgICBjb25zdCBqb2JzVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdKb2JzVGFibGUnLCAnT2NyQXBwU3RhY2stRGF0YWJhc2VKb2JzVGFibGU3QzIwRjYxQy0yNVdRR1Q3MERSSUQnKTtcbiAgICBjb25zdCBkb2NCdWNrZXQgPSBzMy5CdWNrZXQuZnJvbUJ1Y2tldE5hbWUodGhpcywgJ0RvY0J1Y2tldCcsICdvY3JhcHBzdGFjay1hcGlkb2N1bWVudGJ1Y2tldDFlMGYwOGQ0LW9sbmw1Ym9jeDJ2MycpO1xuICAgIGNvbnN0IGltYWdlc1RhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnSW1hZ2VzVGFibGUnLCAnT2NyU3RhcnRlclN0YWNrLURhdGFiYXNlSW1hZ2VzVGFibGU1MEEwRkMzNi1EVUpVN1JEMUQyM1onKTtcbiAgICBjb25zdCBzY2hlbWFzVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdTY2hlbWFzVGFibGUnLCAnT2NyU3RhcnRlclN0YWNrLURhdGFiYXNlU2NoZW1hc1RhYmxlQkZGNUE1MTMtMU85RUxKT042WElTTScpO1xuXG4gICAgLy8g5a6f5YON6YOo6ZqK77yIV29ya2Vy77yJ44Gu5Y+C54WnXG4gICAgY29uc3Qgd29ya2VyTGFtYmRhID0gbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbk5hbWUodGhpcywgJ1dvcmtlckxhbWJkYScsICdPY3JBcHBTdGFjay1BcGlXb3JrZXJGdW5jdGlvblJlYnVpbGREREM2ODhGRi1ROGlVbG9CZlB5QXcnKTtcblxuICAgIGNvbnN0IHN0YXJ0ZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdGFydGVyTGFtYmRhJywge1xuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMSxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvc3RhcnRlcicpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQlVDS0VUX05BTUU6IGRvY0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBKT0JTX1RBQkxFX05BTUU6IGpvYnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIElNQUdFU19UQUJMRV9OQU1FOiBpbWFnZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFNDSEVNQVNfVEFCTEVfTkFNRTogc2NoZW1hc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRU5BQkxFX09DUjogJ3RydWUnLFxuICAgICAgICBPQ1JfV09SS0VSX0ZOOiB3b3JrZXJMYW1iZGEuZnVuY3Rpb25OYW1lIC8vIOKYhVdvcmtlcuOBruWQjeWJjeOCkui/veWKoFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8g5qip6ZmQ44Gu5LuY5LiOXG4gICAgZG9jQnVja2V0LmdyYW50UmVhZFdyaXRlKHN0YXJ0ZXJMYW1iZGEpO1xuICAgIGpvYnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc3RhcnRlckxhbWJkYSk7XG4gICAgaW1hZ2VzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHN0YXJ0ZXJMYW1iZGEpO1xuICAgIHNjaGVtYXNUYWJsZS5ncmFudFJlYWREYXRhKHN0YXJ0ZXJMYW1iZGEpO1xuXG4gICAgLy8g4piF5Y+X5LuY5L+C44Gr44CB5a6f5YON6YOo6ZqK44KS5ZG844Gz5Ye644GZKEludm9rZSnmqKnpmZDjgpLku5jkuI5cbiAgICB3b3JrZXJMYW1iZGEuZ3JhbnRJbnZva2Uoc3RhcnRlckxhbWJkYSk7XG5cbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdPY3JTdGFydGVyQXBpJywge1xuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhcGkucm9vdC5hZGRSZXNvdXJjZSgnZ2VuZXJhdGUtcHJlc2lnbmVkLXVybCcpLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcbiAgICBhcGkucm9vdC5hZGRSZXNvdXJjZSgndXBsb2FkLWNvbXBsZXRlJykuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuICAgIGFwaS5yb290LmFkZFJlc291cmNlKCdpbWFnZXMnKS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcbiAgICBjb25zdCBvY3IgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnb2NyJyk7XG4gICAgb2NyLmFkZFJlc291cmNlKCdzdGFydCcpLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcbiAgICBjb25zdCBhZ2VudCA9IG9jci5hZGRSZXNvdXJjZSgnYWdlbnQnKTtcbiAgICBhZ2VudC5hZGRSZXNvdXJjZSgne2ltYWdlX2lkfScpXG4gICAgICAuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuXG4gICAgLy8gPT09PT0gYXBwcyBBUEnvvIjku4rlm57ov73liqDvvIk9PT09PVxuICAgIGNvbnN0IGFwcHMgPSBvY3IuYWRkUmVzb3VyY2UoJ2FwcHMnKTtcbiAgICBhcHBzLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuICAgIGFwcHMuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuXG4gICAgYXBwcy5hZGRSZXNvdXJjZSgnc2NoZW1hJylcbiAgICAgIC5hZGRSZXNvdXJjZSgnZ2VuZXJhdGUtcHJlc2lnbmVkLXVybCcpXG4gICAgICAuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuXG4gICAgY29uc3QgYXBwSXRlbSA9IGFwcHMuYWRkUmVzb3VyY2UoJ3thcHBfbmFtZX0nKTtcbiAgICBhcHBJdGVtLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuICAgIGFwcEl0ZW0uYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG4gICAgLy8g8J+SoeOAkOS/ruato+OAkeato+imj+ODq+ODvOODiOOBq+WvvuOBmeOCi0RFTEVUReODoeOCveODg+ODieOCkuioseWPr1xuICAgIGFwcEl0ZW0uYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG5cbiAgICBjb25zdCBhcHBTY2hlbWEgPSBhcHBJdGVtLmFkZFJlc291cmNlKCdzY2hlbWEnKTtcbiAgICBhcHBTY2hlbWEuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG4gICAgYXBwU2NoZW1hLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN0YXJ0ZXJMYW1iZGEpKTtcbiAgICBhcHBTY2hlbWEuYWRkUmVzb3VyY2UoJ2dlbmVyYXRlJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG5cbiAgICBjb25zdCBjdXN0b21Qcm9tcHQgPSBhcHBJdGVtLmFkZFJlc291cmNlKCdjdXN0b20tcHJvbXB0Jyk7XG4gICAgY3VzdG9tUHJvbXB0LmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RhcnRlckxhbWJkYSkpO1xuICAgIGN1c3RvbVByb21wdC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdGFydGVyTGFtYmRhKSk7XG4gIH1cbn1cbiJdfQ==
import boto3
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
ddb = boto3.resource('dynamodb')

# 既存の設計に基づいたテーブル指定
jobs_table = ddb.Table(os.environ['JOBS_TABLE_NAME'])
images_table = ddb.Table(os.environ['IMAGES_TABLE_NAME'])
usage_table_name = os.getenv("USAGE_METRICS_TABLE_NAME")
usage_table = ddb.Table(usage_table_name) if usage_table_name else None

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def get_image(image_id):
    # JobsTable からメタデータを取得する既存ルートを維持
    return jobs_table.get_item(Key={'id': image_id}).get('Item')

def update_image_status(image_id, status, metrics=None):
    job_item = get_image(image_id)
    if not job_item:
        logger.error(f"Job record {image_id} not found for status update")
        return

    app_name = job_item.get('app_name', 'default')
    # 成功データ(test.pdf)の形式に合わせ、大文字のエンジン名を優先
    engine = metrics.get('ocr_engine') if metrics else job_item.get('ocr_engine', 'AZURE_VISION')
    
    # 既存の成功データと全く同じ「usage_metrics」マップを構築
    usage_metrics = {}
    if metrics:
        usage_metrics = {
            "input_tokens": int(metrics.get('input_tokens', 0)),
            "output_tokens": int(metrics.get('output_tokens', 0)),
            "page_count": int(metrics.get('page_count', 0)),
            "ocr_engine": engine
        }

    # 1. JobsTable の更新 (内部管理用)
    job_status = "DONE" if status == "completed" else "FAILED"
    jobs_table.update_item(
        Key={'id': image_id},
        UpdateExpression="SET #st=:s, updated_at=:u",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":s": job_status, ":u": now_iso()}
    )

    # 2. ImagesTable の更新 (UI表示用)
    # 成功データのスキーマ通り、トップレベルと usage_metrics 両方に書き込む
    update_expr = "SET #st=:s, updated_at=:u, ocr_engine=:e"
    attr_names = {"#st": "status"}
    attr_values = {":s": status, ":u": now_iso(), ":e": engine}

    if metrics:
        update_expr += ", input_tokens=:it, output_tokens=:ot, page_count=:pc, usage_metrics=:um"
        attr_values.update({
            ":it": usage_metrics["input_tokens"],
            ":ot": usage_metrics["output_tokens"],
            ":pc": usage_metrics["page_count"],
            ":um": usage_metrics
        })

    try:
        images_table.update_item(
            Key={'app_name': app_name, 'image_id': image_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values
        )
    except Exception as e:
        logger.error(f"ImagesTable update failed: {e}")

    # 3. UsageMetricsTable への集計 (TOTAL行の更新)
    if usage_table and metrics:
        try:
            usage_table.update_item(
                Key={"metric_date": "TOTAL"},
                UpdateExpression="SET updated_at=:u ADD total_pages :pc, total_input_tokens :it, total_output_tokens :ot",
                ExpressionAttributeValues={
                    ":u": now_iso(),
                    ":pc": usage_metrics["page_count"],
                    ":it": usage_metrics["input_tokens"],
                    ":ot": usage_metrics["output_tokens"]
                }
            )
        except Exception: pass

def update_ocr_result(image_id, result, status, metrics=None):
    # OCRテキストの保存処理
    job_item = get_image(image_id)
    if job_item:
        try:
            images_table.update_item(
                Key={'app_name': job_item.get('app_name', 'default'), 'image_id': image_id},
                UpdateExpression='SET ocr_text = :txt',
                ExpressionAttributeValues={':txt': result.get('text', '')}
            )
        except Exception: pass
    update_image_status(image_id, status, metrics)

import os
from datetime import datetime
import boto3

REGION = os.getenv("AWS_REGION", "us-east-1")
ddb = boto3.resource("dynamodb", region_name=REGION)
s3  = boto3.client("s3", region_name=REGION)

JOBS_TABLE   = os.environ["JOBS_TABLE_NAME"]
IMAGES_TABLE = os.environ["IMAGES_TABLE_NAME"]
BUCKET       = os.environ["BUCKET_NAME"]
USAGE_TABLE  = os.getenv("USAGE_METRICS_TABLE_NAME", "")

jobs = ddb.Table(JOBS_TABLE)
imgs = ddb.Table(IMAGES_TABLE)
usage = ddb.Table(USAGE_TABLE) if USAGE_TABLE else None

def now():
    return datetime.utcnow().isoformat()

def today():
    return datetime.utcnow().strftime("%Y-%m-%d")

def record_usage():
    if not usage:
        return
    usage.update_item(
        Key={"metric_date": today()},
        UpdateExpression="ADD process_count :c",
        ExpressionAttributeValues={":c": 1}
    )

def handler(event, context):
    try:
        job_id = event.get("job_id")
        s3_key = event.get("s3_key", "")

        # 進捗更新
        jobs.update_item(
            Key={"id": job_id},
            UpdateExpression="SET #st=:p, ocr_input_key=:k, updated_at=:u",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":p": "PROCESSING", ":k": s3_key, ":u": now()},
        )

        # S3確認（軽量）
        b = s3.get_object(Bucket=BUCKET, Key=s3_key)["Body"].read()
        text = f"OK: bytes={len(b)} key={s3_key}"

        # 保存
        imgs.put_item(Item={
            "id": job_id,
            "job_id": job_id,
            "jobId": job_id,
            "status": "DONE",
            "ocr_engine": "TEST",
            "ocr_text": text,
            "s3_key": [s3_key],
            "created_at": now(),
            "updated_at": now(),
        })

        # DONE更新
        jobs.update_item(
            Key={"id": job_id},
            UpdateExpression="SET #st=:d, ocr_engine=:e, updated_at=:u",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":d": "DONE", ":e": "TEST", ":u": now()},
        )

        # ★ ここが今回の追加
        record_usage()

        print(f"[OK] job_id={job_id}")
        return {"ok": True, "job_id": job_id}

    except Exception as e:
        jobs.update_item(
            Key={"id": job_id},
            UpdateExpression="SET #st=:f, error=:er, updated_at=:u",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":f": "FAILED", ":er": str(e)[:900], ":u": now()},
        )
        raise

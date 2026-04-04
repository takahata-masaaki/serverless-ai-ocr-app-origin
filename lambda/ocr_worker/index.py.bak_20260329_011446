import os
from datetime import datetime
import boto3

REGION = os.getenv("AWS_REGION", "us-east-1")
ddb = boto3.resource("dynamodb", region_name=REGION)
s3  = boto3.client("s3", region_name=REGION)

JOBS_TABLE   = os.environ["JOBS_TABLE_NAME"]
IMAGES_TABLE = os.environ["IMAGES_TABLE_NAME"]
BUCKET       = os.environ["BUCKET_NAME"]

def now():
    return datetime.utcnow().isoformat()

def handler(event, context):
    try:
    job_id = event.get("job_id")
    s3_key = event.get("s3_key", "")

    jobs = ddb.Table(JOBS_TABLE)
    imgs = ddb.Table(IMAGES_TABLE)

    # 進捗更新
    jobs.update_item(
        Key={"id": job_id},
        UpdateExpression="SET #st=:p, ocr_input_key=:k, updated_at=:u",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":p": "PROCESSING", ":k": s3_key, ":u": now()},
    )

    # S3から読めるか確認（重いOCRはまだやらない）
    b = s3.get_object(Bucket=BUCKET, Key=s3_key)["Body"].read()
    text = f"OK: bytes={len(b)} key={s3_key}"

    # ImagesTableへ保存（id=job_id の簡易運用）
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

    # DONEへ
    jobs.update_item(
        Key={"id": job_id},
        UpdateExpression="SET #st=:d, ocr_engine=:e, updated_at=:u",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":d": "DONE", ":e": "TEST", ":u": now()},
    )

    print(f"[OK] job_id={job_id} wrote ImagesTable id={job_id}")
            return {"ok": True, "job_id": job_id}
    except Exception as e:
        # 失敗時はFAILEDに落として原因を残す
        jobs.update_item(
            Key={"id": job_id},
            UpdateExpression="SET #st=:f, error=:er, updated_at=:u",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":f": "FAILED", ":er": str(e)[:900], ":u": now()},
        )
        raise

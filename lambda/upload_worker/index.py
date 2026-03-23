import os
from urllib.parse import unquote_plus
import boto3

ddb = boto3.resource("dynamodb", region_name="us-east-1")
lam = boto3.client("lambda", region_name="us-east-1")

JOBS_TABLE = os.environ["JOBS_TABLE_NAME"]
OCR_WORKER_FN = os.environ.get("OCR_WORKER_FN", "")

def handler(event, context):
    table = ddb.Table(JOBS_TABLE)

    for r in event.get("Records", []):
        key = unquote_plus(r["s3"]["object"]["key"])
        parts = key.split("/")
        if len(parts) >= 3 and parts[0] == "uploads":
            job_id = parts[1]

            # 1) status進行（制御点）
            table.update_item(
                Key={"id": job_id},
                UpdateExpression="SET #st=:s, uploaded_key=:k",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={":s": "QUEUED_OCR", ":k": key},
            )

            # 2) OCR Worker を非同期起動（設定がある場合だけ）
            if OCR_WORKER_FN:
                lam.invoke(
                    FunctionName=OCR_WORKER_FN,
                    InvocationType="Event",
                    Payload=(f'{{"job_id":"{job_id}","s3_key":"{key}"}}').encode("utf-8"),
                )

    return {"ok": True}

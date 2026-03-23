import os, json
from urllib.parse import unquote_plus
from datetime import datetime, timezone
import boto3

REGION = os.getenv("AWS_REGION", "us-east-1")
ddb = boto3.resource("dynamodb", region_name=REGION)
lam = boto3.client("lambda", region_name=REGION)

JOBS_TABLE = os.environ["JOBS_TABLE_NAME"]
OCR_WORKER_FN = os.environ["OCR_WORKER_FN"]

def now():
    return datetime.now(timezone.utc).isoformat()

def handler(event, context):
    t = ddb.Table(JOBS_TABLE)
    for r in event.get("Records", []):
        key = unquote_plus(r["s3"]["object"]["key"])
        parts = key.split("/")
        if len(parts) >= 3 and parts[0] == "uploads":
            job_id = parts[1]

            t.update_item(
                Key={"id": job_id},
                UpdateExpression="SET #st=:s, uploaded_key=:k, updated_at=:u",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={":s": "QUEUED_OCR", ":k": key, ":u": now()},
            )

            lam.invoke(
                FunctionName=OCR_WORKER_FN,
                InvocationType="Event",
                Payload=json.dumps({"job_id": job_id, "s3_key": key}).encode("utf-8"),
            )
    return {"ok": True}

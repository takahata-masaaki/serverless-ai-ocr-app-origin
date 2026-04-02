import os
import json
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal): return float(obj)
        return super(DecimalEncoder, self).default(obj)

REGION = os.getenv("AWS_REGION", "us-east-1")
s3 = boto3.client("s3", region_name=REGION)
ddb = boto3.resource("dynamodb", region_name=REGION)

BUCKET = os.environ["BUCKET_NAME"]
IMAGES_TABLE = os.environ["IMAGES_TABLE_NAME"]
JOBS_TABLE = os.environ["JOBS_TABLE_NAME"]

def _cors():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,DELETE",
    }

def _resp(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": _cors(),
        "body": json.dumps(body, ensure_ascii=False, cls=DecimalEncoder),
    }

def _presign_get(key: str, expires: int = 300) -> str:
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires,
    )

def _parse_iso(s: str):
    if not s: return None
    try:
        if s.endswith("Z"): s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None

def _is_timeout(upload_time: str, updated_at: str, limit_seconds: int = 600) -> bool:
    ref = _parse_iso(updated_at) or _parse_iso(upload_time)
    if not ref: return False
    return (datetime.now(timezone.utc) - ref).total_seconds() > limit_seconds

def _head_exists(key: str) -> bool:
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except ClientError:
        return False

def _resolve_status(image_item: dict, job_item: dict):
    raw_status = image_item.get("status", "")
    upload_time = image_item.get("uploadTime", "")
    updated_at = image_item.get("updated_at", "")
    job_status = (job_item or {}).get("status", "")

    image_id = image_item.get("image_id", "")
    md_key = f"outputs/{image_id}/output.md"
    js_key = f"outputs/{image_id}/structured.json"

    has_md = _head_exists(md_key)
    has_json = _head_exists(js_key)

    if (raw_status == "completed" and job_item and job_status == "DONE" and has_md and has_json):
        resolved = "completed"
    elif raw_status == "failed" or job_status == "FAILED":
        resolved = "failed"
    elif raw_status == "processing":
        if _is_timeout(upload_time, updated_at, 600): resolved = "failed"
        else: resolved = "processing"
    elif raw_status == "pending":
        resolved = "pending"
    elif raw_status == "completed":
        resolved = "failed"
    else:
        resolved = raw_status or "pending"

    return {
        "status": resolved,
        "raw_status": raw_status,
        "job_status": job_status,
        "has_output_md": has_md,
        "has_structured_json": has_json,
    }

def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 204, "headers": _cors(), "body": ""}

    path = event.get("pathParameters") or {}
    qs = event.get("queryStringParameters") or {}

    image_id = path.get("job_id") or path.get("image_id")
    app_name = qs.get("app_name") or path.get("app_name")

    if not app_name or not image_id:
        return _resp(400, {"error": "app_name and image_id are required"})

    images_table = ddb.Table(IMAGES_TABLE)
    jobs_table = ddb.Table(JOBS_TABLE)

    image_item = images_table.get_item(Key={"app_name": app_name, "image_id": image_id}).get("Item")
    if not image_item:
        return _resp(404, {"error": "not found"})

    job_item = jobs_table.get_item(Key={"id": image_id}).get("Item") or {}

    status_info = _resolve_status(image_item, job_item)
    status = status_info["status"]

    resp = {
        "app_name": image_item.get("app_name", app_name),
        "image_id": image_item.get("image_id", image_id),
        "job_id": image_item.get("image_id", image_id),
        "status": status,
        "raw_status": status_info["raw_status"],
        "job_status": status_info["job_status"],
        "has_output_md": status_info["has_output_md"],
        "has_structured_json": status_info["has_structured_json"],
        "updated_at": image_item.get("updated_at"),
        "uploadTime": image_item.get("uploadTime"),
        "filename": image_item.get("filename") or image_item.get("name"),
        "name": image_item.get("name") or image_item.get("filename"),
        "s3_key": image_item.get("s3_key"),
    }

    source_key = image_item.get("s3_key")
    if source_key:
        resp["source_file_key"] = source_key
        resp["source_file_url"] = _presign_get(source_key)

    if status_info["has_output_md"]:
        md_key = f"outputs/{image_id}/output.md"
        resp["markdown_key"] = md_key
        resp["markdown_url"] = _presign_get(md_key)

    if status_info["has_structured_json"]:
        js_key = f"outputs/{image_id}/structured.json"
        resp["json_key"] = js_key
        resp["json_url"] = _presign_get(js_key)

    if job_item.get("error"):
        resp["error"] = job_item.get("error")

    # 💡 画面のカウンター（ラベル）を表示させるための文字列ハック処理
    try:
        base_fn = resp.get("filename", "unknown.pdf").split(" ［")[0]
        in_t = int(job_item.get("input_tokens", 0) or 0)
        out_t = int(job_item.get("output_tokens", 0) or 0)
        p_c = int(job_item.get("page_count", 1) or 1)
        # コスト計算 (Input + Output + Page)
        cost = (in_t * 0.00045) + (out_t * 0.0022) + (p_c * 0.225)
        
        # フロントエンドが期待しているフォーマットで上書き
        resp["filename"] = f"{base_fn} ［約{cost:.3f}円 / {in_t}in, {out_t}out |Month:0.0］"
    except Exception:
        pass

    return _resp(200, resp)

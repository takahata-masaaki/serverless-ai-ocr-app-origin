import os
import json
import uuid
from datetime import datetime, timezone
import boto3
from boto3.dynamodb.conditions import Key

REGION = os.getenv("AWS_REGION", "us-east-1")
s3 = boto3.client("s3", region_name=REGION)
ddb = boto3.resource("dynamodb", region_name=REGION)
lambda_client = boto3.client("lambda", region_name=REGION)

BUCKET = os.environ["BUCKET_NAME"]
JOBS_TABLE = os.environ["JOBS_TABLE_NAME"]
SCHEMA_PREFIX = "schemas/"
SCHEMA_INPUT_PREFIX = "schema-inputs/"

def now_iso(): return datetime.now(timezone.utc).isoformat()

def _cors():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
    }

def _resp(code, body): return {"statusCode": code, "headers": _cors(), "body": json.dumps(body, ensure_ascii=False)}

def _json_body(event):
    body = event.get("body")
    if not body: return {}
    if isinstance(body, dict): return body
    try: return json.loads(body)
    except Exception: return {}

def _norm_parts(path: str):
    parts = [p for p in (path or "").strip("/").split("/") if p]
    if parts and parts[0] == "ocr": parts = parts[1:]
    return parts

def _schema_key(app_name: str) -> str: return f"{SCHEMA_PREFIX}{app_name}.json"

def _load_app(app_name: str):
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=_schema_key(app_name))
        data = json.loads(obj["Body"].read().decode("utf-8"))
        if isinstance(data, dict): return data
    except Exception: pass
    return {"name": app_name, "display_name": app_name, "fields": [], "prompt": "", "updated_at": now_iso()}

def _save_app(app_name: str, data: dict):
    item = {"name": app_name, "display_name": data.get("display_name") or app_name, "description": data.get("description", ""), "fields": data.get("fields", []), "prompt": data.get("prompt", ""), "updated_at": now_iso()}
    s3.put_object(Bucket=BUCKET, Key=_schema_key(app_name), Body=json.dumps(item, ensure_ascii=False, indent=2).encode("utf-8"), ContentType="application/json; charset=utf-8")
    return item

def _list_apps():
    apps = []
    token = None
    while True:
        kwargs = {"Bucket": BUCKET, "Prefix": SCHEMA_PREFIX}
        if token: kwargs["ContinuationToken"] = token
        res = s3.list_objects_v2(**kwargs)
        for c in res.get("Contents", []):
            key = c.get("Key", "")
            if not key.endswith(".json"): continue
            try:
                obj = s3.get_object(Bucket=BUCKET, Key=key)
                data = json.loads(obj["Body"].read().decode("utf-8"))
                if isinstance(data, dict): apps.append(data)
            except Exception:
                app_name = key.split("/")[-1].replace(".json", "")
                apps.append({"name": app_name, "display_name": app_name, "fields": [], "prompt": "", "updated_at": c.get("LastModified").isoformat() if c.get("LastModified") else now_iso()})
        if not res.get("IsTruncated"): break
        token = res.get("NextContinuationToken")
    apps.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return {"apps": apps}

def _default_generated_schema(app_name: str, file_name: str, s3_key: str):
    base_label = app_name.replace("_", " ").replace("-", " ").strip() or "document"
    return {"name": app_name, "display_name": app_name, "description": f"{base_label} schema", "fields": [{"name": "document_title", "type": "string", "description": "書類タイトル", "required": False}, {"name": "document_date", "type": "string", "description": "書類日付", "required": False}, {"name": "issuer_name", "type": "string", "description": "発行者名", "required": False}, {"name": "recipient_name", "type": "string", "description": "宛先名", "required": False}, {"name": "total_amount", "type": "number", "description": "合計金額", "required": False}, {"name": "notes", "type": "string", "description": "備考", "required": False}], "prompt": "", "_meta": {"generated_from": file_name or "", "source_key": s3_key or "", "generator": "fallback-server-generator"}, "updated_at": now_iso()}

def _images_table():
    table_name = os.environ.get("IMAGES_TABLE_NAME", "")
    return ddb.Table(table_name)

def _list_images(app_name: str):
    res = _images_table().query(KeyConditionExpression=boto3.dynamodb.conditions.Key("app_name").eq(app_name))
    items = res.get("Items", [])
    items.sort(key=lambda x: x.get("uploadTime", ""), reverse=True)
    return {"images": items}

def _delete_image(app_name: str, image_id: str):
    _images_table().delete_item(Key={"app_name": app_name, "image_id": image_id})
    return _resp(200, {"status": "deleted", "image_id": image_id})

def _generate_upload_presigned(body: dict):
    app_name, image_id, filename = (body.get("app_name") or "default").strip() or "default", str(uuid.uuid4()), body.get("filename") or "file.pdf"
    content_type, page_processing_mode = body.get("content_type") or body.get("contentType") or "application/pdf", body.get("page_processing_mode") or "combined"
    s3_key = f"uploads/{image_id}/{filename}"
    url = s3.generate_presigned_url(ClientMethod="put_object", Params={"Bucket": BUCKET, "Key": s3_key, "ContentType": content_type}, ExpiresIn=3600)
    return {"presigned_url": url, "s3_key": s3_key, "job_id": image_id, "image_id": image_id, "app_name": app_name, "page_processing_mode": page_processing_mode}

def _upload_complete(body: dict):
    image_id, filename, s3_key, app_name = body.get("image_id"), body.get("filename") or "file.pdf", body.get("s3_key") or "", (body.get("app_name") or "default").strip() or "default"
    if not image_id: return _resp(400, {"error": "image_id is required"})
    _images_table().put_item(Item={"app_name": app_name, "image_id": image_id, "filename": filename, "name": filename, "s3_key": s3_key, "status": "pending", "uploadTime": now_iso(), "updated_at": now_iso(), "page_processing_mode": body.get("page_processing_mode") or "combined"})
    return _resp(200, {"status": "ok", "image_id": image_id})

def _handle_non_ocr(path, method, qs, body):
    parts = _norm_parts(path)
    if len(parts) == 1 and parts[0] == "images" and method == "GET": return _resp(200, _list_images((qs.get("app_name") or "default").strip() or "default"))
    if len(parts) == 2 and parts[0] == "images" and method == "DELETE": return _delete_image((qs.get("app_name") or "default").strip() or "default", parts[1])
    if path == "/generate-presigned-url" and method == "POST": return _resp(200, _generate_upload_presigned(body))
    if path == "/upload-complete" and method == "POST": return _upload_complete(body)
    return None

def _handle_apps(parts, method, body):
    if parts == ["apps"]:
        if method == "GET": return _resp(200, _list_apps())
        if method == "POST":
            app_name = (body.get("name") or body.get("app_name") or "").strip()
            return _resp(200, _save_app(app_name, body)) if app_name else _resp(400, {"error": "name is required"})
    if parts == ["apps", "schema", "generate-presigned-url"]:
        if method != "POST": return _resp(405, {"error": "method not allowed"})
        app_name, filename, content_type = (body.get("app_name") or "temp").strip(), body.get("file_name") or body.get("filename") or "schema-source.bin", body.get("content_type") or body.get("contentType") or "application/octet-stream"
        key = f"{SCHEMA_INPUT_PREFIX}{app_name}/{str(uuid.uuid4())}/{filename}"
        upload_url = s3.generate_presigned_url(ClientMethod="put_object", Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type}, ExpiresIn=300, HttpMethod="PUT")
        return _resp(200, {"message": "Ready for schema source upload", "upload_url": upload_url, "target_key": key, "file_path": key})
    if len(parts) == 2 and parts[0] == "apps":
        if method == "GET": return _resp(200, _load_app(parts[1]))
        if method == "PUT": return _resp(200, _save_app(parts[1], {**_load_app(parts[1]), **body, "name": parts[1]}))
    if len(parts) == 3 and parts[0] == "apps" and parts[2] == "schema":
        if method == "GET":
            app = _load_app(parts[1])
            return _resp(200, {"name": app.get("name", parts[1]), "display_name": app.get("display_name", parts[1]), "fields": app.get("fields", []), "description": app.get("description", ""), "updated_at": app.get("updated_at", now_iso())})
        if method == "POST":
            curr, inc = _load_app(parts[1]), body.get("schema", body)
            return _resp(200, _save_app(parts[1], {**curr, **inc, "name": parts[1], "fields": inc.get("fields", curr.get("fields", []))}))
    if len(parts) == 3 and parts[0] == "apps" and parts[2] == "custom-prompt":
        if method == "GET": return _resp(200, {"prompt": _load_app(parts[1]).get("prompt", "")})
        if method in ("PUT", "POST"):
            curr = _load_app(parts[1])
            curr["prompt"] = body.get("prompt", "")
            return _resp(200, {"prompt": _save_app(parts[1], curr).get("prompt", "")})
    if len(parts) == 4 and parts[0] == "apps" and parts[2] == "schema" and parts[3] == "generate":
        if method != "POST": return _resp(405, {"error": "method not allowed"})
        curr = _load_app(parts[1])
        generated = {**curr, "name": parts[1], "display_name": curr.get("display_name") or parts[1], "updated_at": now_iso()} if curr.get("fields") else _default_generated_schema(parts[1], body.get("file_name") or body.get("filename") or "", body.get("file_path") or body.get("target_key") or body.get("s3_key") or "")
        return _resp(200, _save_app(parts[1], generated))
    return None

def _handle_ocr_start(body):
    app_name, ocr_engine, worker_fn = (body.get("app_name") or "").strip(), body.get("ocr_engine", "yomitoku_ec2"), os.environ.get("OCR_WORKER_FN", "").strip()
    if not app_name or not worker_fn: return _resp(400, {"error": "Config missing"})
    pending = [x for x in _list_images(app_name).get("images", []) if (x.get("status") or "").lower() in ("pending", "uploaded", "waiting", "unprocessed", "未処理")]
    if not pending: return _resp(200, {"message": "No pending images", "app_name": app_name, "started": 0})
    started, errors, table = [], [], _images_table()
    for item in pending:
        image_id, s3_key, filename = item.get("image_id"), item.get("s3_key"), item.get("filename") or item.get("name") or "upload.bin"
        if not image_id or not s3_key:
            errors.append({"image_id": image_id, "error": "missing data"})
            continue
        try:
            lambda_client.invoke(FunctionName=worker_fn, InvocationType="Event", Payload=json.dumps({"job_id": image_id, "image_id": image_id, "app_name": app_name, "filename": filename, "s3_key": s3_key, "ocr_engine": ocr_engine}).encode("utf-8"))
            table.update_item(Key={"app_name": app_name, "image_id": image_id}, UpdateExpression="SET #s = :s, updated_at = :u, ocr_engine = :e", ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":s": "processing", ":u": now_iso(), ":e": ocr_engine})
            started.append({"image_id": image_id, "filename": filename, "s3_key": s3_key})
        except Exception as e: errors.append({"image_id": image_id, "error": str(e)})
    return _resp(200, {"message": "OCR dispatch completed", "app_name": app_name, "started": len(started), "items": started, "errors": errors})


def _json_response(status_code: int, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }

def _handle_safe_images_list(event):
    qs = event.get("queryStringParameters") or {}
    app_name = (qs.get("app_name") or "").strip()
    if not app_name:
        return _json_response(400, {"message": "app_name is required"})

    table_name = os.environ["IMAGES_TABLE_NAME"]
    t = boto3.resource("dynamodb", region_name=REGION).Table(table_name)

    resp = t.query(
        KeyConditionExpression=Key("app_name").eq(app_name)
    )

    rows = []
    for item in resp.get("Items", []):
        image_id = item.get("image_id")
        if not image_id:
            continue

        rows.append({
            "app_name": item.get("app_name", ""),
            "image_id": image_id,
            "filename": item.get("filename") or item.get("name") or "",
            "name": item.get("name") or item.get("filename") or "",
            "s3_key": item.get("s3_key", ""),
            "status": item.get("status", "pending"),
            "ocr_engine": item.get("ocr_engine", ""),
            "page_processing_mode": item.get("page_processing_mode", "combined"),
            "uploadTime": item.get("uploadTime", ""),
            "updated_at": item.get("updated_at", ""),
            "job_id": item.get("job_id", ""),
        })

    rows.sort(key=lambda x: (x.get("uploadTime") or x.get("updated_at") or ""), reverse=True)
    return _json_response(200, {"images": rows})


def handler(event, context):
    http_method = (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method")
        or ""
    ).upper()
    path = event.get("rawPath") or event.get("path") or ""

    if http_method == "GET" and path.endswith("/images") and not path.endswith("/images/"):
        return _handle_safe_images_list(event)
    method, path = event.get("httpMethod", ""), event.get("path", "")
    if method == "OPTIONS": return {"statusCode": 204, "headers": _cors(), "body": ""}
    qs, body = event.get("queryStringParameters") or {}, _json_body(event)
    non_ocr_resp = _handle_non_ocr(path, method, qs, body)
    if non_ocr_resp is not None: return non_ocr_resp
    parts = _norm_parts(path)
    app_resp = _handle_apps(parts, method, body)
    if app_resp is not None: return app_resp
    if parts == ["start"] and method == "POST":
        try: return _handle_ocr_start(body)
        except Exception as e: return _resp(500, {"error": str(e)})
    return _resp(404, {"error": "route not found", "path": path, "method": method})

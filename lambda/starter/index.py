import json
import os
import uuid
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

def now():
    return datetime.now(timezone.utc).isoformat()

def parse_iso(s: str):
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:
        return None

def is_timeout(upload_time: str, updated_at: str, limit_seconds: int = 600) -> bool:
    ref = parse_iso(updated_at) or parse_iso(upload_time)
    if not ref:
        return False
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - ref).total_seconds() > limit_seconds

def resp(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,GET,POST,DELETE",
            "Content-Type": "application/json",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }

def start_backend(payload: dict):
    mode = os.environ.get("OCR_BACKEND_MODE", "lambda").lower()
    worker_fn = os.environ.get("OCR_WORKER_FN", "")
    sfn_arn = os.environ.get("OCR_SFN_ARN", "")

    if mode == "stepfunctions":
        if not sfn_arn:
            raise RuntimeError("OCR_SFN_ARN is empty while OCR_BACKEND_MODE=stepfunctions")
        sfn = boto3.client("stepfunctions")
        execution_name = f"{payload['image_id']}-{uuid.uuid4().hex[:8]}"
        r = sfn.start_execution(
            stateMachineArn=sfn_arn,
            name=execution_name[:80],
            input=json.dumps(payload, ensure_ascii=False)
        )
        return {
            "backend_mode": "stepfunctions",
            "execution_arn": r["executionArn"]
        }

    if not worker_fn:
        raise RuntimeError("OCR_WORKER_FN is empty while OCR_BACKEND_MODE=lambda")

    lambda_client = boto3.client("lambda")
    lambda_client.invoke(
        FunctionName=worker_fn,
        InvocationType="Event",
        Payload=json.dumps(payload).encode("utf-8")
    )
    return {
        "backend_mode": "lambda",
        "execution_arn": ""
    }


SCHEMA_PREFIX = "app-schemas/"

def schema_key(app_name: str) -> str:
    return f"{SCHEMA_PREFIX}{app_name}.json"

def load_app_schema(s3, bucket_name: str, app_name: str) -> dict:
    try:
        key = schema_key(app_name)
        print(f"[DEBUG] bucket_name={bucket_name}")
        print(f"[DEBUG] key={key}")
        print(f"[DEBUG] app_name={app_name}")
        print(f"[load_app_schema] bucket={bucket_name} key={key} app_name={app_name}")
        obj = s3.get_object(Bucket=bucket_name, Key=key)
        raw = obj["Body"].read().decode("utf-8")
        print(f"[load_app_schema] raw_len={len(raw)}")
        data = json.loads(raw)
        print(f"[load_app_schema] loaded_fields={len(data.get('fields', []))} loaded_name={data.get('name')}")
        return data
    except Exception as e:
        print(f"[load_app_schema][ERROR] bucket={bucket_name} key={schema_key(app_name)} app_name={app_name} error={repr(e)}")
        return {
            "name": app_name,
            "display_name": app_name,
            "description": "",
            "fields": [],
            "prompt": "",
            "updated_at": now(),
        }

def save_app_schema(s3, bucket_name: str, app_name: str, data: dict) -> dict:
    item = {
        "name": app_name,
        "display_name": data.get("display_name") or app_name,
        "description": data.get("description", ""),
        "fields": data.get("fields", []),
        "prompt": data.get("prompt", ""),
        "updated_at": now(),
    }
    s3.put_object(
        Bucket=bucket_name,
        Key=schema_key(app_name),
        Body=json.dumps(item, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json"
    )
    return item

def list_app_schemas(s3, bucket_name: str) -> list:
    items = []
    token = None
    while True:
        kwargs = {"Bucket": bucket_name, "Prefix": SCHEMA_PREFIX}
        if token:
            kwargs["ContinuationToken"] = token
        res = s3.list_objects_v2(**kwargs)
        for c in res.get("Contents", []):
            key = c.get("Key", "")
            if not key.endswith(".json"):
                continue
            try:
                obj = s3.get_object(Bucket=bucket_name, Key=key)
                data = json.loads(obj["Body"].read().decode("utf-8"))
                if isinstance(data, dict):
                    items.append(data)
            except Exception:
                app_name = key.split("/")[-1].replace(".json", "")
                items.append({
                    "name": app_name,
                    "display_name": app_name,
                    "description": "",
                    "fields": [],
                    "prompt": "",
                    "updated_at": now(),
                })
        if not res.get("IsTruncated"):
            break
        token = res.get("NextContinuationToken")
    items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return items

def build_fallback_schema(app_name: str) -> dict:
    return {
        "name": app_name,
        "display_name": app_name,
        "description": "",
        "fields": [
            {"name": "document_title", "type": "string", "description": "書類タイトル", "required": False},
            {"name": "document_date", "type": "string", "description": "書類日付", "required": False},
            {"name": "issuer_name", "type": "string", "description": "発行者名", "required": False},
            {"name": "recipient_name", "type": "string", "description": "宛先名", "required": False},
            {"name": "total_amount", "type": "number", "description": "合計金額", "required": False},
            {"name": "notes", "type": "string", "description": "備考", "required": False},
        ],
        "prompt": "",
        "updated_at": now(),
    }

def resolve_status(item: dict, jobs_table, s3, bucket_name: str):
    image_id = item.get("image_id", "")
    raw_status = item.get("status", "")
    upload_time = item.get("uploadTime", "")
    updated_at = item.get("updated_at", "")

    job_item = jobs_table.get_item(Key={"id": image_id}).get("Item") or {}
    job_status = job_item.get("status", "")

    md_key = f"outputs/{image_id}/output.md"
    js_key = f"outputs/{image_id}/structured.json"

    has_md = False
    has_json = False
    try:
        s3.head_object(Bucket=bucket_name, Key=md_key)
        has_md = True
    except Exception:
        pass
    try:
        s3.head_object(Bucket=bucket_name, Key=js_key)
        has_json = True
    except Exception:
        pass

    # completed は4条件すべて必要
    if (
        raw_status == "completed" and
        job_item and
        job_status == "DONE" and
        has_md and
        has_json
    ):
        resolved = "completed"

    # failed 明示
    elif raw_status == "failed" or job_status == "FAILED":
        resolved = "failed"

    # processing のタイムアウト
    elif raw_status == "processing":
        if is_timeout(upload_time, updated_at, 600):
            resolved = "failed"
        else:
            resolved = "processing"

    # pending はそのまま
    elif raw_status == "pending":
        resolved = "pending"

    # completed っぽいが実体不足 → failed 扱い
    elif raw_status == "completed":
        resolved = "failed"

    else:
        resolved = raw_status or "pending"

    item["status"] = resolved
    item["raw_status"] = raw_status
    item["job_status"] = job_status
    item["has_output_md"] = has_md
    item["has_structured_json"] = has_json
    return item

def handler(event, context):
    try:
        path = event.get("path", "")
        method = event.get("httpMethod", "")
        qs = event.get("queryStringParameters") or {}
        path_params = event.get("pathParameters") or {}

        db = boto3.resource("dynamodb")
        s3 = boto3.client("s3")

        bucket_name = os.environ.get("BUCKET_NAME", "")
        images_table = db.Table(os.environ.get("IMAGES_TABLE_NAME", ""))
        jobs_table = db.Table(os.environ.get("JOBS_TABLE_NAME", ""))

        if method == "OPTIONS":
            return {
                "statusCode": 204,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,DELETE",
                },
                "body": ""
            }

        # GET /images?app_name=...
        if "/images" in path and method == "GET" and "/images/" not in path:
            app_name = qs.get("app_name", "default")
            response = images_table.query(
                KeyConditionExpression=Key("app_name").eq(app_name)
            )
            items = response.get("Items", [])

            normalized = []
            for item in items:
                if "name" not in item:
                    item["name"] = item.get("filename", "Unknown")
                normalized.append(resolve_status(item, jobs_table, s3, bucket_name))

            normalized = sorted(normalized, key=lambda x: x.get("uploadTime", ""), reverse=True)
            return resp(200, {"images": normalized})

        # DELETE /images/{image_id}?app_name=...
        elif "/images/" in path and method == "DELETE":
            app_name = qs.get("app_name", "default")
            image_id = path_params.get("image_id")

            if not image_id:
                return resp(400, {"error": "image_id is required"})

            item = images_table.get_item(
                Key={"app_name": app_name, "image_id": image_id}
            ).get("Item")

            if not item:
                return resp(404, {"error": "not found"})

            s3_key = item.get("s3_key")

            if s3_key:
                try:
                    s3.delete_object(Bucket=bucket_name, Key=s3_key)
                except Exception:
                    pass

            for key in [
                f"outputs/{image_id}/output.md",
                f"outputs/{image_id}/structured.json",
            ]:
                try:
                    s3.delete_object(Bucket=bucket_name, Key=key)
                except Exception:
                    pass

            images_table.delete_item(
                Key={"app_name": app_name, "image_id": image_id}
            )

            try:
                jobs_table.delete_item(Key={"id": image_id})
            except Exception:
                pass

            return resp(200, {"status": "deleted", "image_id": image_id})



        # =========================
        # /ocr/apps 系
        # =========================

        # GET /ocr/apps
        elif path.endswith("/ocr/apps") and method == "GET":
            return resp(200, {"apps": list_app_schemas(s3, bucket_name)})

        # POST /ocr/apps
        elif path.endswith("/ocr/apps") and method == "POST":
            body = json.loads(event.get("body") or "{}")
            app_name = body.get("name") or body.get("app_name") or "default"
            saved = save_app_schema(s3, bucket_name, app_name, body)
            return resp(200, saved)

        # POST /ocr/apps/schema/generate-presigned-url
        elif path.endswith("/ocr/apps/schema/generate-presigned-url") and method == "POST":
            body = json.loads(event.get("body") or "{}")
            app_name = body.get("app_name", "default")
            image_id = str(uuid.uuid4())
            filename = body.get("file_name", body.get("filename", "file.pdf"))
            content_type = body.get("content_type", body.get("contentType", "application/pdf"))
            s3_key = f"schema-inputs/{app_name}/{image_id}/{filename}"

            url = s3.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=3600
            )

            return resp(200, {
                "presigned_url": url,
                "s3_key": s3_key,
                "image_id": image_id
            })

        # GET /ocr/apps/{app_name}
        elif "/ocr/apps/" in path and "/schema" not in path and "/custom-prompt" not in path and method == "GET":
            parts = [x for x in path.split("/") if x]
            try:
                app_name = parts[parts.index("apps") + 1]
            except Exception:
                return resp(400, {"error": "invalid app path"})
            return resp(200, load_app_schema(s3, bucket_name, app_name))

        # PUT /ocr/apps/{app_name}
        elif "/ocr/apps/" in path and "/schema" not in path and "/custom-prompt" not in path and method == "PUT":
            parts = [x for x in path.split("/") if x]
            try:
                app_name = parts[parts.index("apps") + 1]
            except Exception:
                return resp(400, {"error": "invalid app path"})
            body = json.loads(event.get("body") or "{}")
            current = load_app_schema(s3, bucket_name, app_name)
            merged = {**current, **body, "name": app_name}
            saved = save_app_schema(s3, bucket_name, app_name, merged)
            return resp(200, saved)

        # GET /ocr/apps/{app_name}/schema
        elif path.endswith("/schema") and "/ocr/apps/" in path and method == "GET":
            parts = [x for x in path.split("/") if x]
            try:
                app_name = parts[parts.index("apps") + 1]
            except Exception:
                return resp(400, {"error": "invalid app path"})
            app = load_app_schema(s3, bucket_name, app_name)
            return resp(200, app)

        # POST /ocr/apps/{app_name}/schema/generate
        elif path.endswith("/schema/generate") and "/ocr/apps/" in path and method == "POST":
            parts = [x for x in path.split("/") if x]
            try:
                app_name = parts[parts.index("apps") + 1]
            except Exception:
                return resp(400, {"error": "invalid app path"})
            current = load_app_schema(s3, bucket_name, app_name)
            generated = current if current.get("fields") else build_fallback_schema(app_name)
            saved = save_app_schema(s3, bucket_name, app_name, generated)
            return resp(200, saved)

        # GET /ocr/apps/{app_name}/custom-prompt
        elif path.endswith("/custom-prompt") and "/ocr/apps/" in path and method == "GET":
            parts = [x for x in path.split("/") if x]
            try:
                app_name = parts[parts.index("apps") + 1]
            except Exception:
                return resp(400, {"error": "invalid app path"})
            app = load_app_schema(s3, bucket_name, app_name)
            return resp(200, {"prompt": app.get("prompt", "")})

        # POST /ocr/apps/{app_name}/custom-prompt
        elif path.endswith("/custom-prompt") and "/ocr/apps/" in path and method == "POST":
            parts = [x for x in path.split("/") if x]
            try:
                app_name = parts[parts.index("apps") + 1]
            except Exception:
                return resp(400, {"error": "invalid app path"})
            body = json.loads(event.get("body") or "{}")
            app = load_app_schema(s3, bucket_name, app_name)
            app["prompt"] = body.get("prompt", "")
            saved = save_app_schema(s3, bucket_name, app_name, app)
            return resp(200, {"prompt": saved.get("prompt", "")})


        # POST /generate-presigned-url
        elif "/generate-presigned-url" in path and method == "POST":
            body = json.loads(event.get("body") or "{}")
            image_id = str(uuid.uuid4())
            filename = body.get("filename", "file.pdf")
            content_type = body.get("content_type", body.get("contentType", "application/pdf"))
            s3_key = f"uploads/{image_id}/{filename}"

            url = s3.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=3600
            )

            return resp(200, {
                "presigned_url": url,
                "s3_key": s3_key,
                "image_id": image_id
            })

        # POST /upload-complete
        elif "/upload-complete" in path and method == "POST":
            body = json.loads(event.get("body") or "{}")
            filename = body.get("filename", "Unknown")
            app_name = body.get("app_name", "default")
            image_id = body.get("image_id")
            s3_key = body.get("s3_key")

            if not image_id or not s3_key:
                return resp(400, {"error": "image_id and s3_key are required"})

            images_table.put_item(Item={
                "app_name": app_name,
                "image_id": image_id,
                "name": filename,
                "filename": filename,
                "s3_key": s3_key,
                "status": "pending",
                "uploadTime": now()
            })

            return resp(200, {"status": "ok"})

        # POST /ocr/start
        elif "/ocr/start" in path and method == "POST":
            body = json.loads(event.get("body") or "{}")
            app_name = body.get("app_name", "default")

            response = images_table.query(
                KeyConditionExpression=Key("app_name").eq(app_name)
            )
            items = response.get("Items", [])
            pending_items = [item for item in items if item.get("status") == "pending"]

            # 最大1件だけ起動
            pending_items = pending_items[:1]

            kicked = []

            for item in pending_items:
                image_id = item["image_id"]
                s3_key = item.get("s3_key", "")
                filename = item.get("filename", item.get("name", "Unknown"))
                job_id = image_id

                payload = {
                    "job_id": job_id,
                    "app_name": app_name,
                    "image_id": image_id,
                    "s3_key": s3_key
                }

                start_result = start_backend(payload)

                jobs_table.put_item(Item={
                    "id": job_id,
                    "job_id": job_id,
                    "app_name": app_name,
                    "image_id": image_id,
                    "filename": filename,
                    "s3_key": s3_key,
                    "status": "QUEUED_OCR",
                    "backend_mode": start_result["backend_mode"],
                    "execution_arn": start_result["execution_arn"],
                    "created_at": now(),
                    "updated_at": now()
                })

                images_table.update_item(
                    Key={"app_name": app_name, "image_id": image_id},
                    UpdateExpression="SET #s = :stat",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":stat": "processing"}
                )

                kicked.append({
                    "job_id": job_id,
                    "image_id": image_id,
                    "filename": filename,
                    "s3_key": s3_key,
                    "backend_mode": start_result["backend_mode"],
                    "execution_arn": start_result["execution_arn"]
                })

            return resp(200, {
                "status": "ok",
                "app_name": app_name,
                "count": len(kicked),
                "jobs": kicked
            })

        return resp(404, {"error": "Not found"})

    except Exception as e:
        return resp(500, {"error": str(e)})

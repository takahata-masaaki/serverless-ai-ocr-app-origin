import os
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

import boto3

REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_REGION = os.getenv("MODEL_REGION") or REGION
MODEL_ID = os.getenv("MODEL_ID", "")
LLM_MAX_CHARS = int(os.getenv("LLM_MAX_CHARS", "12000"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1200"))

BUCKET = os.environ["BUCKET_NAME"]
JOBS_TABLE = os.environ["JOBS_TABLE_NAME"]
IMAGES_TABLE = os.environ["IMAGES_TABLE_NAME"]

OCR_ENGINE = os.getenv("OCR_ENGINE", "yomitoku_ec2").lower()
YOMITOKU_EC2_URL = os.getenv("YOMITOKU_EC2_URL", "").rstrip("/")
AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT", "").rstrip("/")
AZURE_VISION_KEY = os.getenv("AZURE_VISION_KEY", "")
AZURE_VISION_API_VERSION = os.getenv("AZURE_VISION_API_VERSION", "v3.2")

ddb = boto3.resource("dynamodb", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)
br = boto3.client("bedrock-runtime", region_name=MODEL_REGION)

def now():
    return datetime.now(timezone.utc).isoformat()

def corsafe(s: str) -> str:
    return (s or "")[:900]

def call_claude(ocr_text: str) -> dict:
    if not MODEL_ID:
        raise RuntimeError("MODEL_ID is empty")

    ocr_text = (ocr_text or "")[:LLM_MAX_CHARS]

    prompt = (
        "あなたの仕事はOCR結果を整形することだけです。\n"
        "OCR_TEXTに存在しない内容を絶対に追加してはいけません。\n"
        "読めない箇所は空文字または null にしてください。\n"
        "サンプル、例、仮定、補完、要約の創作を禁止します。\n"
        "必ず JSON 1個のみで返す。\n"
        "形式: {\"structured\": <object>, \"markdown\": \"<string>\"}\n\n"
        "OCR_TEXT:\n" + ocr_text
    )

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": LLM_MAX_TOKENS,
        "temperature": 0,
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
    }

    resp = br.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps(body).encode("utf-8"),
        accept="application/json",
        contentType="application/json",
    )
    payload = json.loads(resp["body"].read())
    out_text = payload["content"][0]["text"].strip()

    if out_text.startswith("```"):
        out_text = out_text.strip("`")
        out_text = out_text[out_text.find("\n") + 1:].strip()

    return json.loads(out_text)

def azure_read_ocr(blob: bytes, content_type: str) -> str:
    if not AZURE_VISION_ENDPOINT or not AZURE_VISION_KEY:
        raise RuntimeError("AZURE_VISION_ENDPOINT or AZURE_VISION_KEY is empty")

    analyze_url = f"{AZURE_VISION_ENDPOINT}/vision/{AZURE_VISION_API_VERSION}/read/analyze"

    req = urllib.request.Request(
        analyze_url,
        data=blob,
        method="POST",
        headers={
            "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY,
            "Content-Type": content_type or "application/octet-stream",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            op_loc = r.headers.get("Operation-Location")
            if not op_loc:
                raise RuntimeError("Azure Operation-Location header missing")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Azure POST failed: {e.code} {detail}")

    for _ in range(30):
        time.sleep(2)
        poll_req = urllib.request.Request(
            op_loc,
            method="GET",
            headers={"Ocp-Apim-Subscription-Key": AZURE_VISION_KEY},
        )
        try:
            with urllib.request.urlopen(poll_req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Azure poll failed: {e.code} {detail}")

        status = (data.get("status") or "").lower()
        if status == "succeeded":
            lines = []
            for page in data.get("analyzeResult", {}).get("readResults", []):
                for line in page.get("lines", []):
                    text = line.get("text", "")
                    if text:
                        lines.append(text)
            return "\n".join(lines).strip()

        if status == "failed":
            raise RuntimeError(f"Azure OCR failed: {json.dumps(data, ensure_ascii=False)}")

    raise RuntimeError("Azure OCR polling timeout")

def yomitoku_ec2_ocr(blob: bytes, content_type: str) -> str:
    if not YOMITOKU_EC2_URL:
        raise RuntimeError("YOMITOKU_EC2_URL is empty")

    req = urllib.request.Request(
        YOMITOKU_EC2_URL,
        data=blob,
        method="POST",
        headers={
            "Content-Type": content_type or "application/octet-stream",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8", errors="ignore")
            data = json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Yomitoku POST failed: {e.code} {detail}")
    except Exception as e:
        raise RuntimeError(f"Yomitoku request failed: {e}")

    # 応答ゆれ吸収
    for key in ["text", "ocr_text", "content", "markdown", "result"]:
        v = data.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()

    lines = []
    for page in data.get("pages", []) or []:
        for line in page.get("lines", []) or []:
            txt = line.get("text", "")
            if txt:
                lines.append(txt)

    for block in data.get("blocks", []) or []:
        txt = block.get("text", "")
        if txt:
            lines.append(txt)

    text = "\n".join(lines).strip()
    if not text:
        raise RuntimeError(f"Yomitoku returned empty text: {json.dumps(data, ensure_ascii=False)[:1000]}")
    return text

def extract_ocr_text(blob: bytes, content_type: str, requested_engine: str = None) -> tuple[str, str]:
    # 指定があれば優先、なければ環境変数を参照
    engine = (requested_engine or OCR_ENGINE or "yomitoku_ec2").lower()

    # YomiToku (EC2) 実行試行
    if "yomitoku" in engine:
        try:
            text = yomitoku_ec2_ocr(blob, content_type)
            if text.strip():
                return text, "YOMITOKU_EC2"
        except Exception as e:
            print(f"Yomitoku無反応または失敗。Azureに切り替えます: {e}")

    # Azure実行（フォールバックまたは直接指定）
    text = azure_read_ocr(blob, content_type)
    return text, "AZURE_VISION"
def handler(event, context):
    job_id = event.get("job_id")
    app_name = event.get("app_name", "")
    image_id = event.get("image_id", "")
    s3_key = event.get("s3_key", "")

    if not job_id or not s3_key:
        raise RuntimeError("job_id or s3_key missing")

    jobs_t = ddb.Table(JOBS_TABLE)
    images_t = ddb.Table(IMAGES_TABLE)

    item = jobs_t.get_item(Key={"id": job_id}).get("Item") or {}
    st = item.get("status", "")

    if st in ("DONE", "FAILED"):
        return {"ok": True, "skipped": True, "status": st}

    try:
        jobs_t.update_item(
            Key={"id": job_id},
            UpdateExpression="SET #st=:p, ocr_input_key=:k, updated_at=:u",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":p": "PROCESSING", ":k": s3_key, ":u": now()},
        )

        obj = s3.get_object(Bucket=BUCKET, Key=s3_key)
        blob = obj["Body"].read()
        content_type = obj.get("ContentType", "application/octet-stream")

        requested_engine = item.get("ocr_engine")
        ocr_text, used_engine = extract_ocr_text(blob, content_type, requested_engine)
        if not ocr_text.strip():
            raise RuntimeError("OCR text is empty")

        print("OCR_TEXT_HEAD:", (ocr_text or "")[:1000])

        raw_key = f"outputs/{job_id}/ocr_raw.txt"
        s3.put_object(
            Bucket=BUCKET,
            Key=raw_key,
            Body=ocr_text.encode("utf-8"),
            ContentType="text/plain; charset=utf-8",
        )

        out = call_claude(ocr_text)
        structured = out.get("structured", {})
        markdown = out.get("markdown", "")

        js_key = f"outputs/{job_id}/structured.json"
        md_key = f"outputs/{job_id}/output.md"

        s3.put_object(
            Bucket=BUCKET,
            Key=js_key,
            Body=json.dumps(structured, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json; charset=utf-8",
        )
        s3.put_object(
            Bucket=BUCKET,
            Key=md_key,
            Body=str(markdown).encode("utf-8"),
            ContentType="text/markdown; charset=utf-8",
        )

        jobs_t.update_item(
            Key={"id": job_id},
            UpdateExpression="SET #st=:d, ocr_engine=:e, updated_at=:u",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":d": "DONE", ":e": used_engine, ":u": now()},
        )

        if app_name and image_id:
            images_t.update_item(
                Key={"app_name": app_name, "image_id": image_id},
                UpdateExpression="SET #st=:d, updated_at=:u",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={":d": "completed", ":u": now()},
            )

        return {"ok": True, "job_id": job_id, "ocr_raw_key": raw_key, "used_engine": used_engine}

    except Exception as e:
        jobs_t.update_item(
            Key={"id": job_id},
            UpdateExpression="SET #st=:f, #err=:er, updated_at=:u",
            ExpressionAttributeNames={"#st": "status", "#err": "error"},
            ExpressionAttributeValues={":f": "FAILED", ":er": corsafe(str(e)), ":u": now()},
        )
        if app_name and image_id:
            images_t.update_item(
                Key={"app_name": app_name, "image_id": image_id},
                UpdateExpression="SET #st=:f, updated_at=:u",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={":f": "failed", ":u": now()},
            )
        raise

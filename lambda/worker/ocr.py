import os
import time
import base64
import logging
import requests
import uuid
from typing import Dict, Any, Union
import boto3
from config import settings
from clients import s3_client
from database import update_image_status, update_ocr_result, get_image

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
textract_client = boto3.client('textract')

def get_image_bytes(image_id: str) -> bytes:
    record = get_image(image_id)
    if not record: raise ValueError(f"No DB record: {image_id}")
    bucket = settings.BUCKET_NAME
    key = record.get('converted_s3_key') or record.get('s3_key')
    if isinstance(key, list) and len(key) > 0: key = key[0]
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    return obj['Body'].read()

def normalize_to_words_format(raw: Dict[str, Any]) -> Dict[str, Any]:
    if "words" in raw: return raw
    words = []
    if "analyzeResult" in raw:
        pages = raw["analyzeResult"].get("readResults", [])
        for page in pages:
            for line in page.get("lines", []):
                words.append({"id": len(words), "content": line.get("text", ""), "points": line.get("boundingBox", [])})
    raw["words"], raw["text"] = words, "\n".join(w.get("content", "") for w in words)
    raw["word_count"] = len(words)
    return raw

def save_markdown_to_s3(image_id: str, ocr_result: Dict[str, Any]):
    bucket = settings.BUCKET_NAME
    key = f"outputs/{image_id}/output.md"
    text = ocr_result.get("text") or ""
    s3_client.put_object(Bucket=bucket, Key=key, Body=text.encode("utf-8"), ContentType="text/markdown; charset=utf-8")

def run_azure_ocr(image_bytes: bytes) -> Dict[str, Any]:
    azure_key = getattr(settings, "AZURE_VISION_KEY", None) or os.getenv("AZURE_VISION_KEY")
    azure_endpoint = getattr(settings, "AZURE_VISION_ENDPOINT", None) or os.getenv("AZURE_VISION_ENDPOINT")
    headers = {"Ocp-Apim-Subscription-Key": azure_key, "Content-Type": "application/octet-stream"}
    url = f"{azure_endpoint.rstrip('/')}/vision/v3.2/read/analyze"
    res = requests.post(url, headers=headers, data=image_bytes, timeout=30)
    res.raise_for_status()
    op_url = res.headers["Operation-Location"]
    for _ in range(30):
        time.sleep(1)
        poll = requests.get(op_url, headers={"Ocp-Apim-Subscription-Key": azure_key})
        if poll.json().get("status") == "succeeded": return poll.json()
    raise TimeoutError("Azure OCR timeout")

def run_yomitoku_ocr(image_bytes: bytes, filename: str, image_id: str) -> Dict[str, Any]:
    yomitoku_url = getattr(settings, "YOMITOKU_EC2_URL", None) or os.getenv("YOMITOKU_EC2_URL")
    payload = {"image_data": base64.b64encode(image_bytes).decode("utf-8"), "filename": filename, "image_id": image_id}
    res = requests.post(yomitoku_url, json=payload, timeout=20)
    res.raise_for_status()
    return res.json()

def perform_ocr(image_input: Union[bytes, str], filename: str = "image.png", image_id: str = None, engine: str = None) -> Dict[str, Any]:
    if isinstance(image_input, str):
        image_id = image_id or image_input
        image_bytes = get_image_bytes(image_id)
    else:
        image_bytes = image_input

    # エンジンの確定
    requested_engine = (engine or getattr(settings, "OCR_ENGINE", "azure")).lower().strip()
    result_json = {}
    engine_used = requested_engine
    fallback_applied = False

    # 厳格なルーターとフォールバック
    if requested_engine in ["yomitoku_ec2", "yomitoku"]:
        try:
            logger.info(f"[{image_id}] OCR engine: yomitoku_ec2")
            result_json = run_yomitoku_ocr(image_bytes, filename, image_id)
            engine_used = "yomitoku_ec2"
        except Exception as e:
            logger.warning(f"[{image_id}] YomiToku failed. fallback to Azure Vision. error={e}")
            result_json = run_azure_ocr(image_bytes)
            engine_used = "azure"
            fallback_applied = True
    elif requested_engine in ["azure", "azure_vision"]:
        logger.info(f"[{image_id}] OCR engine: azure")
        result_json = run_azure_ocr(image_bytes)
        engine_used = "azure"
    elif requested_engine == "paddle":
        raise ValueError("Paddle is not available in this environment")
    else:
        raise ValueError(f"Unsupported OCR engine: {requested_engine}")

    # UI表示用のメタデータ
    result_json["engineRequested"] = requested_engine
    result_json["engineUsed"] = engine_used
    result_json["fallbackApplied"] = fallback_applied

    result_json = normalize_to_words_format(result_json)
    if image_id:
        save_markdown_to_s3(image_id, result_json)
        save_llm_outputs_to_s3(image_id, result_json)
        update_ocr_result(image_id, result_json, "completed")
        update_image_status(image_id, "completed")
        
    return result_json

# -----------------------------
# Bedrock (Claude) formatter
# -----------------------------
import json
from botocore.exceptions import ClientError

MODEL_REGION = os.getenv("MODEL_REGION") or os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("MODEL_ID", "")
ENABLE_LLM = os.getenv("ENABLE_LLM", "true").lower() == "true"
LLM_MAX_CHARS = int(os.getenv("LLM_MAX_CHARS", "12000"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1200"))

def _s3_obj_exists(bucket: str, key: str) -> bool:
    s3 = boto3.client("s3", region_name=MODEL_REGION)
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return False
        raise

def _extract_text_for_llm(ocr_result: dict) -> str:
    # できるだけ短く：textがあればそれを優先、なければJSONを縮めて使う
    if isinstance(ocr_result, dict):
        for k in ("text", "fullText", "ocr_text"):
            v = ocr_result.get(k)
            if isinstance(v, str) and v.strip():
                return v
    return json.dumps(ocr_result, ensure_ascii=False)

def _call_bedrock_claude(text: str) -> dict:
    if not MODEL_ID:
        raise RuntimeError("MODEL_ID is empty")

    br = boto3.client("bedrock-runtime", region_name=MODEL_REGION)

    prompt = (
        "次のOCRテキストを整形してください。\n"
        "出力は『追加テキストなし』で、必ず JSON 1個のみ。\n"
        "JSON形式: {\"structured\": <object>, \"markdown\": \"<string>\"}\n"
        "structured は推定できる範囲で構造化し、markdown は人間が読める表にしてください。\n\n"
        "OCR_TEXT:\n" + text
    )

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": LLM_MAX_TOKENS,
        "temperature": 0,
        "messages": [
            {"role": "user", "content": [{"type": "text", "text": prompt}]}
        ],
    }

    resp = br.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps(body).encode("utf-8"),
        accept="application/json",
        contentType="application/json",
    )
    payload = json.loads(resp["body"].read())
    out_text = payload["content"][0]["text"].strip()

    # code fence対策
    if out_text.startswith("```"):
        out_text = out_text.strip("`")
        out_text = out_text[out_text.find("\n")+1:].strip()

    return json.loads(out_text)

def save_llm_outputs_to_s3(image_id: str, ocr_result: dict):
    """
    outputs/{image_id}/structured.json と outputs/{image_id}/output.md を生成。
    structured.json が既にあれば Bedrock を呼ばない（1回制限）。
    """
    if not ENABLE_LLM:
        return

    bucket = os.environ.get("BUCKET_NAME") or os.environ.get("DOCUMENT_BUCKET_NAME")
    if not bucket:
        raise RuntimeError("BUCKET_NAME is empty")

    structured_key = f"outputs/{image_id}/structured.json"
    md_key = f"outputs/{image_id}/output.md"

    # すでに生成済みならスキップ（= 1 job 1回）
    if _s3_obj_exists(bucket, structured_key):
        return

    text = _extract_text_for_llm(ocr_result)
    text = text[:LLM_MAX_CHARS]

    data = _call_bedrock_claude(text)
    structured = data.get("structured", {})
    markdown = data.get("markdown", "")

    s3 = boto3.client("s3", region_name=MODEL_REGION)
    s3.put_object(
        Bucket=bucket, Key=structured_key,
        Body=json.dumps(structured, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json; charset=utf-8",
    )
    s3.put_object(
        Bucket=bucket, Key=md_key,
        Body=str(markdown).encode("utf-8"),
        ContentType="text/markdown; charset=utf-8",
    )

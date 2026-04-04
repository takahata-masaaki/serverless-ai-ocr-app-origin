import os
import time
import base64
import logging
import requests
import json
import boto3
from typing import Dict, Any, Union
from config import settings
from clients import s3_client
from database import update_image_status, update_ocr_result, get_image

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MODEL_REGION = os.getenv("MODEL_REGION") or "us-east-1"
MODEL_ID = os.getenv("MODEL_ID")
LLM_MAX_CHARS = int(os.getenv("LLM_MAX_CHARS", "12000"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1200"))
ENABLE_LLM = os.getenv("ENABLE_LLM", "true").lower() == "true"

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

def run_azure_ocr(image_bytes: bytes) -> Dict[str, Any]:
    azure_key = os.getenv("AZURE_VISION_KEY")
    azure_endpoint = os.getenv("AZURE_VISION_ENDPOINT")
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

def _call_bedrock_claude(text: str) -> tuple:
    br = boto3.client("bedrock-runtime", region_name=MODEL_REGION)
    prompt = f"次のOCRテキストを整形してJSONで返してください。\nJSON形式: {{\"structured\": <object>, \"markdown\": \"<string>\"}}\n\nOCR_TEXT:\n{text}"
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": LLM_MAX_TOKENS,
        "temperature": 0,
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
    }
    resp = br.invoke_model(modelId=MODEL_ID, body=json.dumps(body))
    payload = json.loads(resp["body"].read())
    usage = payload.get("usage", {})
    out_text = payload["content"][0]["text"].strip()
    if out_text.startswith("```"):
        out_text = out_text.split("\n", 1)[-1].rsplit("\n", 1)[0].strip()
    return json.loads(out_text), usage

def perform_ocr(image_input: Union[bytes, str], filename: str = "image.png", image_id: str = None, engine: str = None) -> Dict[str, Any]:
    if isinstance(image_input, str):
        image_id = image_id or image_input
        image_bytes = get_image_bytes(image_id)
    else:
        image_bytes = image_input

    requested_engine = (engine or os.getenv("OCR_ENGINE", "azure")).lower().strip()
    # シンプルにAzure実行
    result_json = run_azure_ocr(image_bytes)
    page_count = len(result_json.get("analyzeResult", {}).get("readResults", []))
    result_json = normalize_to_words_format(result_json)
    
    usage = {}
    if image_id and ENABLE_LLM:
        data, usage = _call_bedrock_claude(result_json["text"][:LLM_MAX_CHARS])
        # S3保存処理などは維持
        s3_client.put_object(Bucket=os.getenv("BUCKET_NAME"), Key=f"outputs/{image_id}/structured.json", Body=json.dumps(data))
    
    if image_id:
        metrics = {
            "page_count": page_count,
            "input_tokens": usage.get("input_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0)
        }
        update_ocr_result(image_id, result_json, "completed", metrics=metrics)
        
    return result_json

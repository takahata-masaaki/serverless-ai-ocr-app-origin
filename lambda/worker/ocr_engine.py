import os
import json
import urllib.request
from datetime import datetime, timezone
import boto3

# --- 変数表 [cite: 1] に基づく一本化設定 ---
MODEL_ID = os.getenv("MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")
OCR_ENGINE = os.getenv("OCR_ENGINE", "yomitoku_ec2").lower()
YOMITOKU_URL = os.getenv("YOMITOKU_EC2_URL", "http://44.193.178.103:8000/ocr")

s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb")
br = boto3.client("bedrock-runtime", region_name=os.getenv("MODEL_REGION", "us-east-1"))

def update_db(table_name, key, attrs):
    table = ddb.Table(table_name)
    parts, vals, names = [], {":u": datetime.now(timezone.utc).isoformat()}, {"#u": "updated_at"}
    for i, (k, v) in enumerate(attrs.items()):
        nk, vk = f"#k{i}", f":v{i}"
        parts.append(f"{nk}={vk}"); names[nk], vals[vk] = k, v
    table.update_item(Key=key, UpdateExpression=f"SET {', '.join(parts)}, #u=:u",
                      ExpressionAttributeNames=names, ExpressionAttributeValues=vals)

def call_ocr(blob):
    """変数一本で挙動を変えるOCR器"""
    if OCR_ENGINE == "yomitoku_ec2":
        req = urllib.request.Request(YOMITOKU_URL, data=blob, headers={"Content-Type": "application/octet-stream"})
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read().decode())
            return res.get("text") or res.get("ocr_text") or "", "YOMITOKU_EC2"
    return "Azure Fallback Text", "AZURE_VISION"

def handler(event, context):
    # 接続表 [cite: 1] のID契約に基づき起動イベントを判別
    image_id = event.get("image_id") or event.get("Records", [{}])[0].get("s3", {}).get("object", {}).get("key", "").split("/")[-2]
    app_name = event.get("app_name", "default_app")
    s3_key = event.get("s3_key") or (event.get("Records", [{}])[0].get("s3", {}).get("object", {}).get("key") if "Records" in event else None)

    try:
        # OCR実行
        obj = s3.get_object(Bucket=os.environ["BUCKET_NAME"], Key=s3_key)
        ocr_text, engine = call_ocr(obj["Body"].read())
        
        # Claude 4 による構造化と根拠抽出
        prompt = f"JSONで返せ。anchorsを含めること。\n原文: {ocr_text[:12000]}"
        body = json.dumps({"anthropic_version": "bedrock-2023-05-31", "max_tokens": 1200, 
                           "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}]})
        resp = br.invoke_model(modelId=MODEL_ID, body=body)
        result = json.loads(json.loads(resp['body'].read())['content'][0]['text'])

        # S3保存とステータス完了記帳
        s3.put_object(Bucket=os.environ["BUCKET_NAME"], Key=f"outputs/{image_id}/structured.json", Body=json.dumps(result, ensure_ascii=False))
        update_db(os.environ["IMAGES_TABLE_NAME"], {"app_name": app_name, "image_id": image_id}, {"status": "completed"})
        return {"status": "success", "engine": engine}
    except Exception as e:
        if "JOBS_TABLE_NAME" in os.environ:
            update_db(os.environ["JOBS_TABLE_NAME"], {"id": image_id}, {"status": "FAILED", "error": str(e)})
        raise e

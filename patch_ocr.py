import re

file_path = "lambda/worker/ocr.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# ドキュメントの仕様を満たした新しい perform_ocr 関数
new_func = """def perform_ocr(image_input: Union[bytes, str], filename: str = "image.png", image_id: str = None, engine: str = None) -> Dict[str, Any]:
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
"""

pattern = r"def perform_ocr\(.*?(?=\n# -+|$)"
new_content = re.sub(pattern, new_func, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("✅ 本家の lambda/worker/ocr.py のフォールバック実装が完了しました！")

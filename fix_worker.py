import sys
file_path = 'lambda/ocrapp/ocr_worker/index.py'
with open(file_path, 'r') as f:
    content = f.read()

monthly_logic = """
    current_month = datetime.now(timezone.utc).strftime('%Y-%m')
    usage_t.update_item(
        Key={"metric_date": current_month},
        UpdateExpression="SET updated_at=:u ADD total_cost_jpy :cost",
        ExpressionAttributeValues={":u": now(), ":cost": cost_jpy}
    )
"""
if 'current_month' not in content:
    content = content.replace('record_usage_total(page_count, input_tokens, output_tokens, used_engine, cost_jpy)', 
                              'record_usage_total(page_count, input_tokens, output_tokens, used_engine, cost_jpy)\n' + monthly_logic)
    with open(file_path, 'w') as f:
        f.write(content)

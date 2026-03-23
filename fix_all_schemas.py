import re, os
for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.venv' in root or 'cdk.out' in root: continue
    if 'schemas.py' in files:
        path = os.path.join(root, 'schemas.py')
        with open(path, 'r') as f: text = f.read()
        if "Any" not in text: text = text.replace("from typing import ", "from typing import Any, ")
        text = re.sub(r'(id:\s*)int', r'\1Any', text)
        text = re.sub(r'(content:\s*)str', r'\1Any', text)
        text = text.replace("Optional[List[List[float]]]", "Optional[Any]")
        text = text.replace("Optional[List[float]]", "Optional[Any]")
        text = text.replace("Optional[float]", "Optional[Any]")
        text = text.replace("Optional[int]", "Optional[Any]")
        text = text.replace("Optional[List[Dict]]", "Optional[Any]")
        if "markdownUrl" not in text: text = re.sub(r'(imageUrl:\s*Optional\[str\])', r'\1\n    markdownKey: Optional[str] = None\n    markdownUrl: Optional[str] = None', text)
        if "ocr_engine" not in text and "OcrStartRequest" in text: text = re.sub(r'(class OcrStartRequest.*?app_name:\s*Optional\[str\].*?)\n', r'\1\n    ocr_engine: Optional[str] = None\n', text, flags=re.DOTALL)
        with open(path, 'w') as f: f.write(text)
        print(f"✅ {path} を安全に修復・緩和しました！")

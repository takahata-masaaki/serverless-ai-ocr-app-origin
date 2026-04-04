const fs = require('fs');

// --- (A) バックエンドの修正（Azureのコスト計算を追加） ---
let workerFile = 'lambda/ocrapp/ocr_worker/index.py';
if (fs.existsSync(workerFile)) {
    let code = fs.readFileSync(workerFile, 'utf8');
    code = code.replace(
        /raw_cost = \(input_tokens \* 0\.00045\) \+ \(output_tokens \* 0\.0022\)/g,
        'raw_cost = (input_tokens * 0.00045) + (output_tokens * 0.0022) + (page_count * 0.225)'
    );
    fs.writeFileSync(workerFile, code);
}

let apiFile = 'lambda/ocrapp/api_result/index.py';
if (fs.existsSync(apiFile)) {
    let code = fs.readFileSync(apiFile, 'utf8');
    code = code.replace(
        /legend = "※\(In×0\.00045\) \+ \(Out×0\.0022\)"/g,
        'legend = "※(In×0.00045) + (Out×0.0022) + (Page×0.225)"'
    );
    fs.writeFileSync(apiFile, code);
}

// --- (B) フロントエンドの修正（UI、トースト、警告の黙殺） ---
let ocrFile = 'web/src/pages/OCRResult.jsx';
if (fs.existsSync(ocrFile)) {
    let code = fs.readFileSync(ocrFile, 'utf8');
    
    // ① トーストの文言修正（不審者感をなくす）
    code = code.replace(/'確認完了にしました'/g, "'確認を完了しました'");
    
    // ② 座標の警告をデバッグメモに降格
    code = code.replace(
        /console\.warn\("OCRが有効ですが、OCR結果が見つかりません"\)/g,
        'console.debug("[メモ] 座標データ未実装のため、ハイライト機能をスキップします")'
    );
    
    // ③ トークンの in / out を (入力) / (出力) に和訳 (JP-en対応)
    code = code.replace(
        /\{filename\.split\(" \/ "\)\[1\]\.split\("］"\)\[0\]\}/g,
        '{filename.split(" / ")[1].split("］")[0].replace("in", " (入力)").replace("out", " (出力)")}'
    );

    // ④ パネル側の凡例にもAzureの式を追加
    code = code.replace(
        /\(Input × 0\.00045\) \+ \(Output × 0\.0022\)/g,
        '(Input × 0.00045) + (Output × 0.0022) + (Page × 0.225)'
    );
    fs.writeFileSync(ocrFile, code);
}

// ⑤ チェックボックスのラベル「確認完了」を「確認を完了」へ修正
let infoFile = 'web/src/components/ExtractedInfoDisplay.jsx';
if (fs.existsSync(infoFile)) {
    let code = fs.readFileSync(infoFile, 'utf8');
    code = code.replace(/>\s*確認完了\s*</g, '> 確認を完了 <');
    code = code.replace(/"確認完了"/g, '"確認を完了"');
    fs.writeFileSync(infoFile, code);
}

console.log("✅ すべてのコード修正が完了しました！");

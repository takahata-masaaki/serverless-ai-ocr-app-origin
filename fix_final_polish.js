const fs = require('fs');
const file = 'web/src/pages/OCRResult.jsx';
let content = fs.readFileSync(file, 'utf8');

// ① tokens という単位を追加
content = content.replace(
    /\{filename\.split\(" \/ "\)\[1\]\.split\("］"\)\[0\]\.replace\("in", " \(入力\)"\)\.replace\("out", " \(出力\)"\)\}/g,
    '{filename.split(" / ")[1].split("］")[0].replace("in", " (入力)").replace("out", " (出力)")} tokens'
);

// ② 凡例エリア全体を、ご指定の「完全にスッキリした状態」にブロックごと上書きする
const legendRegex = /※ 凡例・計算根拠:<br\/>[\s\S]*?<\/span>/;
const newLegend = `※ 凡例・計算根拠:<br/>(Input × 0.00045) + (Output × 0.0022) + (Page × 0.225) JPY (※Azure OCR)<br/>
            <span className="block mt-1.5 text-[10.5px] leading-tight text-gray-400">
              エージェント検証使用時、1回あたり約2.0(JPY)。
            </span>`;

if (content.match(legendRegex)) {
    content = content.replace(legendRegex, newLegend);
}

fs.writeFileSync(file, content);
console.log("✅ 単位の追加と不要テキストの完全消去が完了しました！");

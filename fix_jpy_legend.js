const fs = require('fs');
const file = 'web/src/pages/OCRResult.jsx';
let content = fs.readFileSync(file, 'utf8');

// ① コストの金額表示を「〇〇円」から「〇〇円(JPY)」に変更
content = content.replace(
    /\{\"約\" \+ filename\.split\(\" ［約\"\)\[1\]\.split\(\"円\"\)\[0\] \+ \"円\"\}/g,
    '{"約" + filename.split(" ［約")[1].split("円")[0] + "円(JPY)"}'
);

// ② 計算式にJPYを追記し、その下に小さくエージェントコストの目安を追加
const targetLegend = /\(Input × 0\.00045\) \+ \(Output × 0\.0022\) \+ \(Page × 0\.225\)/g;
const replacementLegend = `(Input × 0.00045) + (Output × 0.0022) + (Page × 0.225) JPY<br/>
            <span className="block mt-1.5 text-[10.5px] leading-tight text-gray-400">
              ※ エージェント検証使用の場合、1回あたり約2.0円(JPY)かかります。<br/>
              (Sonnet 4.0, 北米-1 目安)
            </span>`;

content = content.replace(targetLegend, replacementLegend);

fs.writeFileSync(file, content);
console.log("✅ JPY表記とエージェントコスト凡例の追加が完了しました！");

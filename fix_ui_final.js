const fs = require('fs');
const file = 'web/src/pages/OCRResult.jsx';
let content = fs.readFileSync(file, 'utf8');

// ① ファイル名の横からコスト情報を消し、スッキリした元の表示に戻す
const filenameBlockRegex = /<div className="flex flex-col max-w-md">[\s\S]*?<\/div>/;
if (content.match(filenameBlockRegex)) {
    content = content.replace(filenameBlockRegex, `<span className="text-xl font-semibold text-gray-800 truncate max-w-md">
                {filename ? filename.split(" ［")[0] : "画像プレビュー"}
              </span>`);
}

// ② 画面右下に、独立した「コスト・凡例パネル」をフローティング配置する
const footerRegex = /\{\/\* カスタムプロンプトモーダル \*\/\}/;
const footerBox = `{filename && filename.includes(" ［") && (
        <div className="fixed bottom-6 right-6 bg-white border border-gray-300 shadow-xl p-4 rounded-md z-50 text-sm min-w-[250px]">
          <div className="font-bold text-gray-700 border-b border-gray-200 pb-2 mb-3">📊 処理コストとトークン数</div>
          <div className="text-gray-600 mb-2 flex justify-between">
            <span>推定コスト:</span>
            <span className="font-mono font-medium">{"約" + filename.split(" ［約")[1].split("円")[0] + "円"}</span>
          </div>
          <div className="text-gray-600 mb-3 flex justify-between">
            <span>使用トークン:</span>
            <span className="font-mono font-medium">{filename.split(" / ")[1].split("］")[0]}</span>
          </div>
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-2 mt-2">
            ※ 凡例・計算根拠:<br/>(Input × 0.00045) + (Output × 0.0022)
          </div>
        </div>
      )}
      {/* カスタムプロンプトモーダル */}`;

if (content.match(footerRegex)) {
    content = content.replace(footerRegex, footerBox);
}

// ③ 座標データがないという警告をコンソールから消す（メモとしてデバッグログに降格）
const warnRegex = /console\.warn\("OCRが有効ですが、OCR結果が見つかりません"\)/g;
content = content.replace(warnRegex, `console.debug("[メモ] 座標データ未実装のため、抽出テキストのハイライト機能をスキップします")`);

fs.writeFileSync(file, content);
console.log("✅ OCRResult.jsx の最終仕上げが完了しました！");

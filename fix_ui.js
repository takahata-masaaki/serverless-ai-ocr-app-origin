const fs = require('fs');
const file = 'web/src/pages/OCRResult.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetRegex = /<span className="text-xl font-semibold text-gray-800 truncate max-w-md">[\s\n]*\{filename \|\| "画像プレビュー"\}[\s\n]*<\/span>/g;
const replacement = `<div className="flex flex-col max-w-md">
    <span className="text-xl font-semibold text-gray-800 truncate">
        {filename ? filename.split(" ［")[0] : "画像プレビュー"}
    </span>
    {filename && filename.includes(" ［") && (
        <span className="text-xs font-normal text-gray-500 mt-1 whitespace-nowrap">
            {"［" + filename.split(" ［")[1]}
        </span>
    )}
</div>`;

if(content.match(targetRegex)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync(file, content);
    console.log("✅ OCRResult.jsx の安全な書き換えに成功しました！");
} else {
    console.log("⚠️ 置換対象が見つかりませんでした。すでに書き換え済みかもしれません。");
}

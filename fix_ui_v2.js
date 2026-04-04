const fs = require('fs');
const path = 'web/src/pages/OCRResult.jsx';
let content = fs.readFileSync(path, 'utf8');

// 月別累積表示の追加 
const monthlyBox = `
<div className="text-[10px] text-gray-400 text-right mt-1 border-t border-gray-100 pt-1">
  {new Date().getMonth() + 1}月の累計費用(実測): {filename.split("|Month:")[1]?.split("］")[0] || "---"}円
</div>`;
content = content.replace(/エージェント検証使用時.*?<\/span>/s, `$&${monthlyBox}`);

// トースト通知の位置を「右上」から「右下」へ移動（ログアウトボタンとの被り防止） 
content = content.replace(/position="top-right"/g, 'position="bottom-right"');

fs.writeFileSync(path, content);

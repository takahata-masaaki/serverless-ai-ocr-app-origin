const fs = require('fs');
const path = 'web/src/pages/OCRResult.jsx';
if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    // 私が勝手に追加した「月別累計」のHTMLブロックを正規表現で探して消し去ります
    content = content.replace(/<div className="text-\[10px\] text-gray-400 text-right mt-1 border-t border-gray-100 pt-1">[\s\S]*?<\/div>/, '');
    fs.writeFileSync(path, content);
    console.log("✅ クラッシュ原因のコードを削除しました。");
}

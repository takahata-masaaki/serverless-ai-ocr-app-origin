const fs = require('fs');
const file = 'web/src/pages/OCRResult.jsx';
let content = fs.readFileSync(file, 'utf8');

// 指定されたスッキリとしたテキストに置換
content = content.replace(
    /※ エージェント検証使用の場合、1回あたり約2\.0円\(JPY\)かかります。/g,
    'エージェント検証使用時、1回あたり約2.0(JPY)。'
);

fs.writeFileSync(file, content);
console.log("✅ エージェントコストの文言修正が完了しました！");

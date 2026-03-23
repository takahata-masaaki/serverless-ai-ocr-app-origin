#!/bin/bash
# 現物パラメータのセット
export REGION="us-east-1"
export WEB_BUCKET="ocr-ui-281934763368-1773213367"
export DIST_ID="E2WX04LQN7LYK"

echo "--- 最終ビルド開始 ---"
npm run build

if [ $? -eq 0 ]; then
    echo "--- S3同期開始 ($WEB_BUCKET) ---"
    aws s3 sync dist "s3://$WEB_BUCKET/" --delete --region "$REGION"
    
    echo "--- CloudFrontキャッシュクリア ---"
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
    
    echo "--- 完了：ブラウザをリロードして確認してください ---"
else
    echo "!!! ビルド失敗：まだ型エラーが残っています !!!"
fi

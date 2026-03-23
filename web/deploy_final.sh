#!/bin/bash
export REGION="us-east-1"
export WEB_BUCKET="ocr-ui-281934763368-1773213367"
export DIST_ID="E2WX04LQN7LYK"

echo "Step 1: Building Frontend..."
npm run build

if [ $? -eq 0 ]; then
    echo "Step 2: Syncing to S3 ($WEB_BUCKET)..."
    aws s3 sync dist "s3://$WEB_BUCKET/" --delete --region "$REGION"
    
    echo "Step 3: Invalidating CloudFront..."
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
    echo "Done! Please refresh your browser."
else
    echo "Build failed. Check the error messages above."
fi

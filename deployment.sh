export AWS_PROFILE=default
export AWS_REGION=us-west-2

echo "Removing output folder.."
rm -rf out

echo "Recreating output folder.."
mkdir out

echo "Compiling typescript..."
npx tsc

echo "Copying package.json and entering dist folder..."
cp package.json dist/package.json
cd dist

echo "Installing node modules..."
npm i

echo "Zipping 'dist' folder into 'out' folder..."
7z a ../out/outlands-pawnshop-parser.zip -r .

echo "Copying zip to s3..."
aws s3 cp ../out/outlands-pawnshop-parser.zip s3://outlands-pawnshop-lambda-zips

echo "Updating lambda function..."
aws lambda update-function-code \
    --no-cli-pager \
    --function-name "outlands-pawnshop-parser" \
    --s3-bucket "outlands-pawnshop-lambda-zips" \
    --s3-key "outlands-pawnshop-parser.zip"

cd ..
echo "Finished."
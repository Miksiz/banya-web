#!/bin/bash
REPO=https://github.com/Miksiz/banya-web.git

SCRIPT_FOLDER=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ASSETS_FOLDER=$SCRIPT_FOLDER/assets
BUILD_FOLDER=$SCRIPT_FOLDER/build
if [ ! -d "$BUILD_FOLDER" ]; then
  echo "Creating $BUILD_FOLDER..."
  mkdir $BUILD_FOLDER
fi
git -C $BUILD_FOLDER status 2>&1 >/dev/null
if [ $? -ne 0 ]; then
  echo "Cloning $REPO..."
  git clone --depth 1 $REPO $BUILD_FOLDER || exit 1
else
  echo "Pulling $REPO..."
  git -C $BUILD_FOLDER pull || exit 1
fi
echo "Installing node dependencies..."
npm install --prefix $BUILD_FOLDER || exit 1
echo "Linking assets..."
ln -snf $ASSETS_FOLDER $BUILD_FOLDER/assets
echo "Building website production bundle..."
npm run --prefix $BUILD_FOLDER build || exit 1

DIST_FOLDER=$BUILD_FOLDER/dist
TARGET_FOLDER=/opt/app/www

echo "Assigning file owner and permissions for bundle files..."
chown -R www-data:www-data $DIST_FOLDER || exit 1
find $DIST_FOLDER -type d -exec chmod 750 {} + || exit 1
find $DIST_FOLDER -type f -exec chmod 640 {} + || exit 1

echo "Removing old website folder..."
rm -rf $TARGET_FOLDER || exit 1
echo "Moving bundle to website folder..."
mv $DIST_FOLDER $TARGET_FOLDER || exit 1
echo "Update completed!"

#!/bin/bash
REPO=https://github.com/Miksiz/banya-web.git

SCRIPT_FOLDER=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
TMP_FOLDER=$(mktemp -d)
TARGET_FOLDER=/opt/app/www
ASSETS_FOLDER=$SCRIPT_FOLDER/assets

TMP_REPO=$TMP_FOLDER/repo

git clone --depth 1 $REPO $TMP_REPO
rm -rf $TMP_REPO/.git
rm -f $TMP_REPO/.gitignore
cp -R $ASSETS_FOLDER $TMP_REPO/
chown -R www-data:www-data $TMP_REPO
find $TMP_REPO -type d -exec chmod 750 {} +
find $TMP_REPO -type f -exec chmod 640 {} +
rm -rf $TARGET_FOLDER
mv $TMP_REPO $TARGET_FOLDER
rm -rf $TMP_FOLDER

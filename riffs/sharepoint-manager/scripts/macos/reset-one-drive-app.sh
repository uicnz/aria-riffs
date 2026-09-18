#!/bin/bash

# This script cleans OneDrive app states
MyPath=`dirname ${0}`
MyDir=`realpath $MyPath`
GroupContainer=~/Library/Group\ Containers/UBF8T346G9.OneDriveSyncClientSuite
Container=~/Library/Containers/com.microsoft.OneDrive-mac
ExtensionBundleId=com.microsoft.OneDrive-mac.FileProvider
TempFilePath=~/.fpdomains.txt
TempFilePathFiltered=~/.fpdomainsfiltered.txt

echo killing OneDrive
killall OneDrive

if [ -d "$GroupContainer" ]; then
    echo removing GroupContainer: $GroupContainer
    rm -rf "$GroupContainer"
fi

if [ -d "$Container" ]; then
    echo removing $Container
    rm -rf "$Container"
fi

echo Archiving all File Provider domains belonging to $ExtensionBundleId
$MyDir/../MacOS/OneDrive /removedomains
echo Done archiving domains

echo killing cfprefsd
killall cfprefsd

echo waiting for cfprefsd
defaults read NSGlobalDomain > /dev/null

echo disableing Finder Extension
/usr/bin/pluginkit -e ignore -i com.microsoft.OneDrive-mac.FinderSync
echo stopping Finder Extension
killall FinderSync

PASSWORD_MATCH="Used to identify you when you start up OneDrive."
security find-generic-password -j "$PASSWORD_MATCH" &> /dev/null
while [ $? -eq 0 ]; do
    security delete-generic-password -j "$PASSWORD_MATCH"
    if [ $? -ne 0 ]; then
       echo Failed to clear cached credentials for business
    fi
    security find-generic-password -j "$PASSWORD_MATCH" &> /dev/null
done

PASSWORD_MATCH="Used to identify you when you start up OneDrive for business."
security find-generic-password -j "$PASSWORD_MATCH" &> /dev/null
while [ $? -eq 0 ]; do
    security delete-generic-password -j "$PASSWORD_MATCH"
    if [ $? -ne 0 ]; then
       echo Failed to clear cached credentials for business
    fi
    security find-generic-password -j "$PASSWORD_MATCH" &> /dev/null
done

PASSWORD_MATCH="com.microsoft.OneDrive-mac.HockeySDK"
security find-generic-password -l "$PASSWORD_MATCH" &> /dev/null
if [ $? -eq 0 ]; then
    security delete-generic-password -l "$PASSWORD_MATCH"
    if [ $? -ne 0 ]; then
       echo Failed to clear OneDrive main App HockeySDK password credential
    fi
fi

PASSWORD_MATCH="com.microsoft.OneDrive-mac.FinderSync.HockeySDK"
security find-generic-password -l "$PASSWORD_MATCH" &> /dev/null
if [ $? -eq 0 ]; then
    security delete-generic-password -l "$PASSWORD_MATCH"
    if [ $? -ne 0 ]; then
       echo Failed to clear OneDrive FinderSync HockeySDK credential
    fi
fi

PERSISTED_COOKIE_MATCH="com.microsoft.onedrive.cookies"
security find-generic-password -s "$PERSISTED_COOKIE_MATCH" &> /dev/null
if [ $? -eq 0 ]; then
    security delete-generic-password -s "$PERSISTED_COOKIE_MATCH"
    if [ $? -ne 0 ]; then
        echo Failed to clear OneDrive persistent cookies
    fi
fi

PERSISTED_COOKIE_VALIDATORS_MATCH="com.microsoft.onedrive.cookievalidators"
security find-generic-password -s "$PERSISTED_COOKIE_VALIDATORS_MATCH" &> /dev/null
if [ $? -eq 0 ]; then
    security delete-generic-password -s "$PERSISTED_COOKIE_VALIDATORS_MATCH"
    if [ $? -ne 0 ]; then
        echo Failed to clear OneDrive persistent cookie validators
    fi
fi

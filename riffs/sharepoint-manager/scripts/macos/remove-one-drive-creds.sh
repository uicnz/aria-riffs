#!/bin/bash

# Remove OneDrive cached credentials from keychain

echo -----------------------------------------
echo -- `date`: Clear Cached Credentials
echo -----------------------------------------

KEYCHAIN_NAME=$1
if [[ -z "$KEYCHAIN_NAME" ]]; then
   KEYCHAIN_NAME=~/Library/Keychains/login.keychain
fi

echo "“**Warning**"
echo "Running this script will remove cached credentials used by OneDrive and other Microsoft applications."
echo "After you run it, you may need to re-enter your password."

read -p "Do you wish to proceed? [Y/n]" should_proceed

if [ $should_proceed != Y ]; then
	echo "Exiting without running the script"
	exit 0
fi

echo Removing cached credentials from $KEYCHAIN_NAME

continue_loop=1

while [[ $continue_loop != 0 ]];
do
security delete-generic-password -s "OneAuthAccount"
if [ $? -ne 0 ]; then
    echo Failed to clear OneAuth account information.
	continue_loop=0
fi
done

continue_loop=1

while [[ $continue_loop -ne 0 ]];
do
security delete-generic-password -s "OneAuthCredential"
if [ $? -ne 0 ]; then
    echo Failed to clear OneAuth credential information.
	continue_loop=0
fi
done

continue_loop=1

while [[ $continue_loop -ne 0 ]];
do
security delete-generic-password -l "com.microsoft.adalcache"
if [ $? -ne 0 ]; then
    echo Failed to clear ADAL cache.
	continue_loop=0
fi
done

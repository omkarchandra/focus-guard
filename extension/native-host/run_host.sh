#!/bin/sh
echo "STARTED" >> /tmp/webblocker_native.log 2>&1
exec /usr/bin/python3 "/Users/mes7956/Desktop/app_web_block/extension/native-host/app_blocker.py" 2>> /tmp/webblocker_native.log

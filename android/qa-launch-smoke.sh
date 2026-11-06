#!/usr/bin/env bash
set -euo pipefail
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop com.yawmilife.app || true
adb logcat -c -b crash || true
adb shell am start -W -n com.yawmilife.app/.YawmiMainActivity | tee /tmp/yawmi-launch.txt
sleep 12
adb shell dumpsys activity activities > /tmp/yawmi-activity.txt
grep -F 'com.yawmilife.app/.YawmiMainActivity' /tmp/yawmi-activity.txt
adb shell pidof com.yawmilife.app
mkdir -p /tmp/yawmi-emulator-artifacts
adb shell dumpsys package com.yawmilife.app > /tmp/yawmi-emulator-artifacts/package.txt
adb shell dumpsys appwidget > /tmp/yawmi-emulator-artifacts/widgets.txt
if ! grep -q 'YawmiCategoryWidget' /tmp/yawmi-emulator-artifacts/package.txt; then
  echo 'FAIL: native widget receivers missing from installed YAWMI package' >&2
  exit 1
fi
echo 'PASS: native widget receivers registered in installed YAWMI Android APK'
mkdir -p /tmp/yawmi-emulator-artifacts
adb shell uiautomator dump /sdcard/yawmi-views.xml || true
adb pull /sdcard/yawmi-views.xml /tmp/yawmi-emulator-artifacts/window.xml || true
adb shell screencap -p /sdcard/yawmi-screenshot.png
adb pull /sdcard/yawmi-screenshot.png /tmp/yawmi-emulator-artifacts/screenshot.png
adb logcat -d -b crash > /tmp/yawmi-emulator-artifacts/crash-log.txt
if grep -F 'Process: com.yawmilife.app' /tmp/yawmi-emulator-artifacts/crash-log.txt; then
  echo "YAWMI native Android process crashed" >&2
  exit 1
fi
echo "PASS: original YAWMI package is installed, resumed and running"

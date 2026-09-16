#!/usr/bin/env bash
set +e
mkdir -p android-evidence/device
adb shell dumpsys webviewupdate > android-evidence/device/webview-version.txt
gradle -p android connectedDebugAndroidTest --stacktrace
status=$?
adb pull /sdcard/Android/data/io.beltrix.preview/files/screenshots android-evidence/device/ >/dev/null 2>&1
adb logcat -d -s AndroidRuntime:E > android-evidence/device/android-runtime-errors.txt
exit "$status"

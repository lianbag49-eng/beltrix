#!/usr/bin/env bash
# Preserve Gradle's actual exit code and concise diagnostics as downloadable evidence.
set +e
mkdir -p android-evidence/device
adb shell dumpsys webviewupdate > android-evidence/device/webview-version.txt
gradle -p android connectedDebugAndroidTest --stacktrace 2>&1 | tee android-evidence/device/instrumentation.log
status=${PIPESTATUS[0]}
adb pull /sdcard/Android/data/io.beltrix.preview/files/screenshots android-evidence/device/ >/dev/null 2>&1
adb logcat -d -s AndroidRuntime:E chromium:W > android-evidence/device/android-runtime-errors.txt
exit "$status"

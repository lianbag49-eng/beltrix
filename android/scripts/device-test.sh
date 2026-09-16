#!/usr/bin/env bash
# Preserve Gradle's exit code and native evidence before UTP uninstalls the app.
set +e
mkdir -p android-evidence/device
adb shell dumpsys webviewupdate > android-evidence/device/webview-version.txt
# The test app's own scoped files are removed by the runner on completion.
# Pull generated public TEST-ONLY screenshots while that app still exists.
(
  while true; do
    adb pull /sdcard/Android/data/io.beltrix.preview/files/screenshots android-evidence/device/ >/dev/null 2>&1
    sleep 2
  done
) &
collector=$!
trap 'kill "$collector" 2>/dev/null; wait "$collector" 2>/dev/null' EXIT
gradle -p android connectedDebugAndroidTest --stacktrace 2>&1 | tee android-evidence/device/instrumentation.log
status=${PIPESTATUS[0]}
kill "$collector" 2>/dev/null
wait "$collector" 2>/dev/null
trap - EXIT
adb logcat -d -s AndroidRuntime:E chromium:W > android-evidence/device/android-runtime-errors.txt
if [ "$status" -eq 0 ]; then
  for file in android-perps.png android-spot.png android-usdt-qr.png native-file-roundtrip.json; do
    if [ ! -s "android-evidence/device/screenshots/$file" ]; then
      echo "Missing required Android visual/file evidence: $file" >&2
      status=1
    fi
  done
fi
exit "$status"

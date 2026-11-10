#!/usr/bin/env bash
# Builds the web bundle and packages it into a signed Android APK.
# Requirements: Node 18+, JDK 17+, Android SDK (platform 34, build-tools 34) at $ANDROID_HOME.
set -euo pipefail
cd "$(dirname "$0")"
(cd web && npm install --no-audit --no-fund && node build.mjs)
cd android
[ -f local.properties ] || echo "sdk.dir=${ANDROID_HOME:?ANDROID_HOME ayarlanmalı}" > local.properties
./gradlew assembleRelease
mkdir -p ../release
cp app/build/outputs/apk/release/app-release.apk ../release/GolgeDerinlikleri.apk
echo "APK: release/GolgeDerinlikleri.apk"

# Changelog

All notable changes to Phone Mirror are documented here. Version numbers follow the releases on GitHub.

## 1.1.0 — 2026-11-06

Linux x64 packages, alongside the Windows builds.

- Debian package (`PhoneMirror_<version>_amd64.deb`) and AppImage
- Bundles the official scrcpy 5.0.1 Linux build, including adb
- The Debian package installs udev rules so adb can open the phone over USB
- A phone that Linux cannot open is labeled as a USB permission problem

## 1.0.0 — 2026-11-06

First public release of Phone Mirror for 64-bit Windows.

- Lists phones from `adb devices -l` and refreshes every two seconds
- Starts one scrcpy window for the selected phone, or one window for every ready phone
- Connects over Wi-Fi, pairs with an Android 11+ pairing code, or switches a USB phone to Wi-Fi
- Picture, sound, window, input, and capture options, with Everyday, Low latency, High quality, and Recording presets
- Saves your own presets on this PC
- Shows the exact scrcpy argument list and a session log
- Explains common adb and scrcpy failures in plain language
- Light, dark, and system themes
- Bundles the official scrcpy 5.0.1 Windows build, including adb
- Portable exe and an NSIS installer

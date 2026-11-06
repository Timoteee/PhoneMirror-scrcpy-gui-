# Third-party notices

Phone Mirror bundles the official scrcpy 5.0.1 builds, including `adb`. Windows packages contain the Windows x64 build. Linux packages contain the Linux x86_64 build. Each archive is downloaded from the scrcpy release, checked against the published `SHA256SUMS.txt`, and packed into the app as `resources/scrcpy`.

## scrcpy

- Project: [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy)
- Copyright: Genymobile and Romain Vimont
- License: Apache License 2.0
- Version bundled: 5.0.1

The full license text is in [`third_party/scrcpy/LICENSE`](third_party/scrcpy/LICENSE). Phone Mirror copies that file next to the bundled binaries. About in the app shows the same text. The upstream 5.0.1 release does not ship a separate NOTICE file.

Phone Mirror itself is MIT licensed. See [LICENSE](LICENSE). The MIT license covers this application and does not replace the Apache-2.0 license on the bundled scrcpy binaries.

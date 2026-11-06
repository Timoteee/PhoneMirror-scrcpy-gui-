# Contributing

Thanks for looking at Phone Mirror. Issues and pull requests are welcome.

## Reporting a bug

Use the [bug report](https://github.com/Timoteee/PhoneMirror-scrcpy-gui-/issues/new?template=bug_report.yml) template. The session log at the bottom of the window is the most useful thing you can include. Open it after a failure and paste the lines from that attempt.

## Suggesting a change

Use the [feature request](https://github.com/Timoteee/PhoneMirror-scrcpy-gui-/issues/new?template=feature_request.yml) template. Phone Mirror is a control panel for scrcpy, so a change that adds a second product (file transfer, an embedded video surface, accounts) needs a strong reason. [DESIGN.md](DESIGN.md) records the interface decisions and the jobs the app is for.

## Developing

Requirements: Node.js 22 or newer. On Windows, that is enough to run the app and build the Windows packages. On Linux, `npm run dev` and `npm run dist:linux` build the deb and AppImage. Packaging the Windows exe on Linux needs Wine.

```bash
npm install
npm test
npm run typecheck
npm run dev
```

`npm install` does not download scrcpy. `npm run dev` and `npm run build` do, via `scripts/fetch-scrcpy.mjs`. The script downloads scrcpy 5.0.1 from the official GitHub release, checks `SHA256SUMS.txt`, and unpacks the Windows x64 zip into `resources/scrcpy-win64`. On Linux and macOS it also unpacks the Linux build into `resources/scrcpy-host` so the window can be tried. Those directories are gitignored.

```bash
npm run dist
npm run dist:linux
```

The packager does not upload anything. `npm run dist` on Windows writes:

- `release/PhoneMirror-1.1.0-portable.exe`
- `release/PhoneMirror-1.1.0-setup.exe`

`npm run dist:linux` on Linux writes:

- `release/PhoneMirror_1.1.0_amd64.deb`
- `release/PhoneMirror-1.1.0-x86_64.AppImage`

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep the change focused.
3. Run `npm test` and `npm run typecheck`. If you touched the window, try the relevant screen in `npm run dev`.
4. Open a pull request and say what you tested.

A few constraints are easy to break and worth keeping:

- One filled primary button on the main window. That button is **Start mirroring** (or **Stop mirroring** while the selected phone is running).
- Spawn scrcpy and adb with an argument array. Do not build a shell command from anything the user typed.
- The renderer has no Node access. Add IPC for a named action, and validate the payload in the main process.
- Keep scrcpy's Apache-2.0 license in `third_party/scrcpy/LICENSE`, in the bundled resources, and reachable from About.
- Plain language on buttons and labels. Flag names belong in the command preview and in tooltips.

## Code style

TypeScript is in strict mode. Indent with 2 spaces and match the file you are editing. `.editorconfig` sets the indentation and line endings.

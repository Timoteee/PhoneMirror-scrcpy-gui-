# Phone Mirror — design brief

Phone Mirror is a Windows desktop utility that wraps scrcpy (v5.0.1). A person plugs in an Android phone, or pairs it over Wi-Fi, and mirrors the screen with one click. They never see a terminal unless they open the log on purpose.

## Users and top tasks

**Primary user.** A non-technical Windows user who wants their phone on the PC: demos, messaging, reading a code from the phone, or recording a short clip. They know Settings on the phone. They do not know adb, serials, or flags.

**Secondary user.** Someone who already uses scrcpy and wants the same flags, saved, without retyping them. The command line stays visible so nothing is hidden.

Top tasks, in order:

1. See whether a phone is connected, and what to do if it is not.
2. Start mirroring the selected phone.
3. Connect a phone that is not plugged in: type an address, pair with a code, or switch a USB phone to Wi-Fi.
4. Change picture, sound, window, input, or capture without learning flag names.
5. Reuse a preset (low latency, high quality, recording) and save their own.
6. Move a file between the PC and the phone without knowing adb paths or flags.
7. Read a plain-language reason when it fails, with the raw scrcpy log one click away.

## Comparable products

Studied before settling the layout:

- **QtScrcpy** puts a dense icon toolbar on the video window. Connection and quality live in that chrome. It is fast to click once you know the icons, and opaque until you do. It forks scrcpy instead of running it. Phone Mirror keeps scrcpy as a separate window (the mirror itself) and uses this app as the control panel, so the primary action is not competing with the video.
- **guiscrcpy** (archived 2023) exposes almost every flag as a checkbox on one form, plus a separate network manager and floating nav panels. The completeness is right; the density is not. Checkboxes with no grouping force a technical reading order. Phone Mirror uses the same "form that builds a command" idea, grouped and collapsed.
- **Escrcpy** is an Electron shell with an embedded multi-device grid, automation, and extra paid tools. Powerful for a device lab. Too many equal actions for someone who owns one phone. Phone Mirror does not embed the video, broadcast input, or install apps.
- **Vysor** is the closest interaction model: a short device list and one obvious way to open the phone. Quality and wireless sit behind an account and a paywall. Phone Mirror copies the restraint, not the gate. Wireless pairing and recording are on the main surface.

What we took from all four: one primary action, a device list as the home screen, wireless as its own small task, and presets so the long tail of flags is not the first thing on screen.

## Visual direction

A calm Windows 11 utility. Native title bar, flat surfaces, hairline borders, no gradients, no glass, no decorative illustration. The mirror window belongs to scrcpy; this window is a control panel and should look like Settings, not like a media player.

Hierarchy on the home screen:

1. The device list (or the empty-state instructions).
2. One filled button: **Start mirroring**. It becomes **Stop mirroring** when the selected phone is already running.
3. Everything else is secondary: Wi-Fi, presets, setting groups, the command, the log.

One primary button per view. The Wi-Fi dialog has one primary button that matches the selected task (Connect, Pair, or Switch to Wi-Fi). The Files dialog has one primary per tab (**Send to phone**, **Get from phone**); it is a task dialog, not a second home screen, and it never adds a filled button to the main window.

Setting groups are collapsed by default. Each header shows the current choice in plain language ("Native · 8 Mbps · H.264") so people can scan without expanding. Tooltips on labels explain the consequence, including the scrcpy flag, for the secondary user.

The command sits under the primary button. It is the exact argument list that will be spawned, quoted for display. A Copy control is always next to it.

The log is a single collapsible panel across the bottom. Collapsed, it shows the last line. It opens itself when scrcpy or adb reports a failure. Errors are a sentence in the status area; the log keeps the original text.

Light and dark themes follow the system. An optional override (system / light / dark) is persisted, because a utility that only follows the system cannot be checked on a machine whose theme you do not control, and because some people want the panel dark while Windows is light. The default is system.

## Palette

Tokens are CSS variables. Text colors below are the ones used for reading, checked against WCAG 2.2 AA (4.5:1 for text, 3:1 for interface boundaries and focus).

Light:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#F3F3F3` | Window canvas (Windows 11 settings gray) |
| `--surface` | `#FFFFFF` | Cards, inputs, dialogs |
| `--surface-sunken` | `#EAEAEA` | Segmented-control track, log |
| `--border` | `#6B6B6B` | Control and card outline. About 5:1 against white and against `#F3F3F3`, so the edge of a field is visible without color |
| `--text` | `#1A1A1A` | Primary text on white and canvas |
| `--text-secondary` | `#454545` | Supporting text. About 9:1 on white, about 8:1 on `#F3F3F3` |
| `--accent` | `#005A9E` | Primary button fill, links, focus ring. White label on this fill is about 7:1 |
| `--accent-hover` | `#004E8C` | Primary button hover |
| `--danger` | `#9E1B12` | Error text |
| `--danger-bg` | `#FDE7E9` | Error banner |
| `--success` | `#0B6A0B` | Connected / mirroring |
| `--warning` | `#6B4F00` | Unauthorized, waiting for Allow |
| `--warning-bg` | `#FFF4CE` | Warning banner |

Dark:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#1F1F1F` | Canvas |
| `--surface` | `#2B2B2B` | Cards |
| `--surface-sunken` | `#242424` | Tracks, log |
| `--border` | `#9A9A9A` | Control and card outline, above 3:1 against `#2B2B2B` and `#1F1F1F` |
| `--text` | `#F5F5F5` | Primary text |
| `--text-secondary` | `#D0D0D0` | Supporting text, above 7:1 on surface and canvas |
| `--accent` | `#6CB6FF` | Primary button fill. Label is `#041422` (dark on light), above 8:1 |
| `--accent-hover` | `#8AC6FF` | Hover |
| `--danger` | `#FFB4AB` | Error text on dark |
| `--danger-bg` | `#3F1512` | Error banner |
| `--success` | `#6CCB6C` | Positive status |
| `--warning` | `#F5D576` | Warning text |
| `--warning-bg` | `#3A3112` | Warning banner |

Focus is a 2px solid `--accent` ring with a 2px offset, on every interactive control, including segmented buttons, device cards, and the summary headers. Focus is never removed for mouse users only; `:focus-visible` is the ring.

## Type scale

The family is `"Segoe UI Variable", "Segoe UI", Inter, sans-serif`. Segoe is used on Windows. Inter is bundled so the type metrics stay the same on PCs that do not have Segoe UI. Monospace for the command and the log is `"Cascadia Mono", "Cascadia Code", Consolas, ui-monospace`.

| Token | Size / line-height | Use |
| --- | --- | --- |
| `--text-caption` | 12px / 16px | Timestamps, version, only where the string is short and high-contrast |
| `--text-body` | 14px / 20px | Labels, device meta, buttons, log body |
| `--text-group` | 16px / 22px | Group titles, dialog titles |
| `--text-title` | 20px / 28px | Window heading |
| `--text-display` | 28px / 36px | Empty-state heading only |

Weight is 400 for body and 600 for titles and the primary button. No lighter than 400.

## Spacing

A 4px grid: 4, 8, 12, 16, 24, 32, 48. Card padding is 16. Gap between cards is 8. Page padding is 24. The two columns split at 440px (devices) and fluid (settings). Below 860px the settings column stacks under the devices so a short window still has one column and one primary button.

## States

Every region has an empty, loading, error, and success state:

- **Devices.** Loading: "Looking for phones…" with a quiet progress text, not a spinner-only void. Empty: numbered steps for USB debugging, plus Connect over Wi-Fi. Error: adb or scrcpy missing, with the recovery action. Success: a card per phone with model, USB or Wi-Fi, and Ready / Allow on phone / Offline.
- **Mirroring.** Idle, starting, running (success), failed (sentence + log opens).
- **Wireless.** Invalid address inline, working, connected, pairing failed.
- **Files.** Send: nothing chosen yet, items ready, invalid phone folder inline, transferring (percent bar for a file, indeterminate bar for a folder or an install), cancelled, failed. Get: reading a folder, empty folder, folder that Android will not open (with the parent-folder hint), files selected, no PC folder chosen yet, transferring, done. The progress bar is an accent fill on the sunken surface with a body-size caption; it introduces no new colour.
- **Recording.** No file chosen yet is an error on the primary button, not a silent no-op.
- **Log.** Empty copy when nothing has run.

## Accessibility

- Full keyboard use. Device list is a radiogroup (arrows move, Space selects). Setting segments are radiogroups. Dialogs trap focus and close with Escape. Ctrl+Enter starts or stops. F5 refreshes devices.
- Names and tooltips are real accessible names, not placeholder-only.
- Status changes go through an `aria-live="polite"` region.
- Contrast pairs above are the contract. Do not introduce gray text below `--text-secondary` for anything a person must read.

## Out of scope

Embedded video, automation, accounts, and theming beyond light, dark, and system. Those are how the products above grew past a single primary action. File transfer and APK install used to sit here; `docs/DECISIONS.md` ADR-1 records why they are now owned, and scrcpy's own drag-and-drop remains a shortcut for people who prefer it.

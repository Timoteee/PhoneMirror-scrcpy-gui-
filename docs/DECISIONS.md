# Decisions

Architecture Decision Records for Phone Mirror, newest last. Each record states the decision, why
it was made (including the alternative that lost), and what it costs. Numbers are append-only.

## ADR-1 — File transfer is an owned surface over adb, not scrcpy's window

**Decision.** Phone Mirror moves files itself, through `adb push`, `adb pull`, and `adb install`,
behind a Files dialog on the phone card. scrcpy's own drag-and-drop is documented as a shortcut, not
as the product's transfer path. This reverses the line in `DESIGN.md` that put file drag-and-drop and
APK install out of scope.

**Why.** The out-of-scope list was written to keep one primary action and to protect the "control
panel, not a media player" shape, and that reason still holds for an embedded video grid. It did not
survive contact with the transfer job. scrcpy's drop target pushes to `/sdcard/Download` only, gives
no progress, no success or failure feedback in the app, cannot install to a chosen location, and has
no pull direction at all — the phone-to-PC half of the job does not exist there. It is also disabled
whenever control is disabled, which is exactly the mode a careful user chooses. The two halves that
scrcpy cannot do (pull, and visibility) are the two the primary user asks for first: "get the video
off my phone" and "did it work".

A reverse-engineering of the decision was rejected too: teaching scrcpy's window with extra flags
leaves the app unable to report anything, because scrcpy runs as a separate process whose console
output is not a file-transfer API.

**Consequences.** Phone Mirror now ships a second product surface, and `CONTRIBUTING.md` no longer
uses "file transfer" as its example of an unjustified second product. The app owns a long-running
child process outside `runProcess`, whose 12-second timeout and 200 KB output cap are wrong for a
transfer; that is `src/main/transfer.ts`. Cancelling kills the adb process, so a partial file can
remain on the phone — that is accepted rather than cleaned up, because guessing at cleanup with
`rm` on a user's storage is worse than a visible leftover. Device paths passed through
`adb shell` are a quoting surface, so they are validated and quoted in one place
(`src/shared/transfer.ts`) and never assembled from renderer strings.

Progress is measured, not borrowed. `adb push` and `adb pull` print their percentage lines only
when their output is a terminal; through the pipe we spawn them on, they print just a summary line
(measured 2026-11-11 on adb 37.0.1). The manager therefore reads the bytes on the receiving side
itself — the growing local file for a pull, `adb shell stat -c %s` for a single-file push — and
shows an indeterminate bar for folder pushes and installs, where no such number exists. The
consequence is a second adb invocation per sample on pushes; that cost was preferred to a bar that
lies.

Transfers are deliberately independent of mirroring and of the View only setting: `push` and `pull`
inject no input, so a view-only profile still moves files. Anyone reading that as a bug should read
it as this paragraph.

---

## Considered and rejected

- **Only document scrcpy's drag-and-drop.** Zero code, but it is push-only, invisible, and dead in
  read-only mode, so it fails the half of the job users ask for.
- **Embed scrcpy video and implement drag-and-drop in our own renderer.** Would fix visibility, at
  the cost of the separate-window architecture that keeps the mirror from competing with the control
  panel, and would still not pull.
- **Browse the phone through MTP or MediaStore (`adb shell content query`).** Richer media metadata,
  but device- and Android-version-dependent, and it still needs adb for the transfer itself.
- **Keep transfers out of scope permanently.** Defensible in 1.0.0, when the only shipped job was
  mirroring; rejected once moving a file was the top request.

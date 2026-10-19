# Tests

Soft Landing's trust checks run a **real Claude Code** against a **scripted stand-in model**. No account, no real model, no network beyond npm.

## Run them

```bash
test/run-matrix.sh                      # 2.1.220 2.1.280 2.1.286 latest
test/run-matrix.sh 2.1.286 latest       # pick versions
PLUGIN="/absolute/path/to/another-plugin" test/run-matrix.sh latest   # another plugin
```

Needs Node with npm, and Python 3. Each version installs once into `~/.cache/soft-landing-cc` (override with `SOFT_LANDING_CC_CACHE`). Logs land in `test/runs/<timestamp>/`, one folder per version and scenario.

## The mod's own tests

`claude plugin test plugin` runs `plugin/hooks/register.test.tsx` inside the engine, with a mocked clock: the band, the breath on terminal, desktop, vscode and mobile, Land's ending, Leave when ready, About, the question from Claude, the no-room fallback, and which command names the mod answers. It takes about a second. `scripts/package-plugin.sh` leaves test files out of the zip.

## What it does

`harness/fake_api.py` answers Claude Code's model requests. A prompt containing `START-LONG` gets a Bash call that sleeps, so a turn lasts as long as the test needs. It logs every request, so a test can see whether a command or a note reached the model.

`harness/drive.py` starts Claude Code in stream-json mode, the way the desktop app and the phone app host it, and speaks their control messages:

| Message | What the real app uses it for |
|---|---|
| `ui_attach` | "I'm the desktop app (or the phone app) and I can draw." Send `viewport.isFullscreen` or panes won't place |
| `ui_panes` | Read the open panes when the app mounts |
| `ui_render` | Ask a plugin to draw a spot, such as `AbovePrompt` (the band above the prompt) or a `Pane` |
| `ui_press` | The person pressed a button the plugin drew |
| `can_use_tool` | Claude Code asks the app to approve a tool call (used by the `permission` scenario) |

Scenarios: `idle`, `midturn`, `band`, `permission`, `breath` (opens the pane, presses Begin, reads the pane at 1, 5, 12 and 32 s). Run one directly. Give `--plugin` an absolute path, since Claude Code runs in its own work folder. Repeat `--plugin` to load a second plugin beside Soft Landing.

```bash
python3 -I test/harness/drive.py band --claude "$(which claude)" --plugin "$PWD/plugin" \
  --out /tmp/sl-band --port 9501 --surface mobile
```

It prints one JSON line: model requests, when the turn ended, when a pane showed, the plugin's own debug lines, and whether any Soft Landing text reached the model.

## What it can't tell you

- What the real desktop or phone app shows on screen. It proves the messages, not the pixels.
- What a real Claude replies. The stand-in model only proves the instructions arrived.
- Anything in regular Claude chat. Test the card there by hand.

Record anything you check by hand in `docs/test-results.md`, marked as tested by a person.

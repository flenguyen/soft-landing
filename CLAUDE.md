# Soft Landing

A breathing and transition companion for people who work with AI agents. Two moments:
- **Pause:** a 30-second breath while Claude keeps working.
- **Land:** a 2-minute breath to close out work and turn to what comes next, in three phases (settle, set the work down, turn outward), then "Notice the room around you." An optional one-line note is planned.

It ships as one Claude plugin that works in regular Claude chat, Cowork and Claude Code, on the computer. Phones are out of scope for the first launch (see `docs/decisions.md`).

## Read first

1. `docs/v0.2-plan.md`: the current plan (install flow, architecture, compatibility, scope, risks, user test).
2. `docs/decisions.md`: what was decided and why. Add to it when something changes.
3. `docs/test-results.md`: what's tested, what isn't.

History, for context only, kept locally and never published: `private/docs/` (the founding brief, the first build's notes, the v0.2 planning prompt) and `private/test/probes/` (one-off experiments).

## Status (19 October 2026)

- **Released 0.2.0 on 19 October 2026** as a public repo and its own marketplace (`flenguyen/soft-landing`, tag `v0.2.0`). Not yet submitted to Anthropic's directory. Collecting feedback.
- The breath runs in the Code pane: a self-animating ring (Braille on the terminal), Pause's 30 seconds, Land's 2 minutes in three phases, Begin, Leave when ready, and "Claude is asking you something" in Pause. Seen working in Antigravity. The chat cards match, and are smaller than before.
- Waiting on real-app checks by the maintainer (see "Not yet tested" in `docs/test-results.md`):
  - Does a plugin added from Customize reach the Code tab, with its buttons?
  - Does Claude draw the exact card in fresh chats?
  - Does sending "pause" mid-task in a long chat work?
- Two decisions are open: is one short Claude reply per breath in chat OK, and are the command names right?
- The Pause and Land skills set `model: haiku`. It works in Claude Code. Chat ignores it: on Opus the card takes about 15 s, on Haiku 4 to 5 s. The card's length is the lever left in chat.

## Product rules (don't break these)

- **No Terminal for users.** Install, update and uninstall happen in Customize → Plugins.
- **Never open a web page.** Stay inside the chat or the Code tab, even if the experience is weaker.
- **Text typed into Soft Landing never reaches Claude.** v0.1 once leaked a note into Claude's prompt. Every change that touches input gets a test against the stand-in model's log.
- **Never approve, answer, cancel or hide anything for the person.** Never hide Claude Code's own prompts or safety controls.
- **Local and quiet.** No telemetry, no network calls of our own, no account beyond the person's Claude account. Store only settings and the optional Land note, with easy delete.
- **Commands carry the plugin name:** `/soft-landing:pause`, `/soft-landing:land`, `/soft-landing:about`. Typing `/pause` or `/land` also works, unless another plugin has the same name: then the short name goes to whichever plugin loaded first, with no warning. The mod matches only the full names, so it never catches another plugin's `/pause`.
- **Degrade, never dead-end.** Detect features, not version numbers. When something can't work, say so in one plain sentence with the one step that fixes it. "Unknown command" is a failure.
- **Onboarding ends in a breath.** No setup screens, no settings to pick first.
- **Copy:** no wellness clichés, medical claims, productivity guilt or "you've done enough". Prefer permission: "You can stop here, with things unfinished." Make no research claims the sources don't support (see `docs/v0.2-plan.md` notes).

## How it works

```
.claude-plugin/marketplace.json   the repo is its own marketplace: flenguyen/soft-landing
plugin/
  .claude-plugin/plugin.json
  skills/pause/SKILL.md           the breath card for chat, plus a text breath
  skills/land/SKILL.md            the same, ending with "Notice the room around you."
  skills/about/SKILL.md           what it is, your data
  hooks/hooks.json                points at the mod, and keeps one real settings hook
  hooks/register.tsx              the mod: Claude Code layer
test/
  harness/fake_api.py             scripted stand-in for the model
  harness/drive.py                drives Claude Code like the desktop and phone apps do
  run-matrix.sh                   runs the scenarios across versions, prints a table
```

Three paths, picked at run time:

| Where | What happens |
|---|---|
| Regular chat, Cowork | The skill asks Claude to draw the card (inline HTML). Where Claude can't draw, it gives the text breath. One short Claude reply per breath |
| Claude Code where something draws (2.1.286+, desktop app, terminal, VS Code-based editors: seen in Antigravity) | The mod answers the skill's command itself (`command.run` for `soft-landing:pause`, `soft-landing:land` and `soft-landing:about`), so Claude gets no request. Pause and Land buttons sit above the prompt while Claude works (`ui.render` on `AbovePrompt`). The breath opens in a pane |
| Claude Code where nothing draws (older than 2.1.286, `claude -p`, cloud) | The mod steps aside (`$.session.surfaces()` is empty) or isn't loaded. The plain skill runs and Claude gives the text breath |

The floor is Claude Code 2.1.220 (tested). The full Code experience needs 2.1.286.

## Gotchas learned the hard way

- **Typed commands wait for the turn to end** in app-hosted sessions (desktop, phone), even with `immediate: true`. The mid-turn path in Claude Code is the button. `prompt.submit` doesn't see slash commands there either.
- **A same-named plugin skill wins over a mod-registered command.** So we don't register commands. We answer the skill's `command.run` instead.
- **Check that something draws before answering a command.** On 2.1.284 with early access on, the mod loads but the app can't draw, so the breath would open where nobody sees it.
- **A pane only places for an app that reports `viewport.isFullscreen`.** The harness must send it when it attaches (desktop `true`, phone `false`).
- **Keep a `hooks` object in `hooks.json`, even empty.** On 2.1.220, a file with only `modules` reports `hook-load-failed` to the app. `"hooks": {}` is enough (tested on 2.1.220, 2.1.280, latest), so we ship no shell hook at all.
- **Skill bodies are not plain text.** `$1`, `$ARGUMENTS` and named arguments get replaced, and an exclamation mark followed by a backtick runs a shell command. The card's HTML must contain neither.
- **The mod validator wants `$` passed only to top-level functions** (a function declaration or a const bound to one), not to closures defined inside `register`.
- **The settings `Notification` hook doesn't fire for permission prompts** in app-hosted sessions. Use the mod's `tool.check` (decision `ask`) instead.
- **Generated files:** loading the plugin with `--plugin-dir` writes `.claude-plugin/types/` and `tsconfig.json` into it. They're gitignored. Don't ship them.
- **In the harness, never `pkill -f` a pattern that appears in your own command line.** It kills the shell running it.
- **Give the harness an absolute `--plugin` path.** Claude Code runs in its own work folder, so a relative path loads nothing, and the test quietly shows the skill path instead of the mod.
- **The terminal's element table still answers `Svg`**, drawn as an empty Box. Choose the ring by `e.surface === 'terminal'`, not by `'Svg' in table`.
- **No surface reports reduced motion.** The ring's SVG asks the viewer's own `prefers-reduced-motion`. The terminal ring always moves.
- **Never swap an `Svg` source faster than about once a second.** The desktop app and the editor draw each new source off-screen, wait up to 1 s for it, then show the alt text instead ("late"). For motion, send one SVG that animates itself (CSS `animation` or `<animate>`): the webview plays it at about 30 frames a second and keeps it across redraws while the source is unchanged. Use `currentColor`: the webview passes in the app's text color.
- **JSX `key` is consumed on `Box` and `Svg`.** Tests find those by type. `Button` keeps `key` in its props.
- **In `claude plugin test`, the test's `$` has no `ui.close`.** The person closing the pane by hand isn't covered there.
- **Uploaded plugins (Customize → Upload) don't reach the iPhone**, in Chat or Code, locked skill or not (tested with a small probe plugin). Phones need the marketplace route, still to be tested.
- **A running session keeps the plugin copy it started with.** After a new upload in Customize, the new copy lands in `~/.claude/plugins/synced/.../soft-landing~gN`, but open sessions (including Antigravity's, whose processes outlive a single chat) still run the old one. Quit the editor or app fully and start a new session.
- **`turn.start` and `turn.complete` fire for subagents too** (`e.agentId` set). Track only the main turn, or the buttons vanish mid-task when Claude uses a subagent. An interrupted turn still ends in `turn.complete` (`reason: 'aborted'`). `turn.abort` is the operation a plugin calls to stop a turn, not an event to watch. Read `agentId` loosely: older types leave it off `turn.start`.
- **`/clear` starts a new session in the same process.** The mod resets on `session.start`.
- **Chat cards must be self-contained:** no `id`, every style under `.sl`, keyframes prefixed `sl-`. Two cards in one chat, or the chat page itself, must not affect each other. The toggle is a checkbox inside its label (`:has(:checked)`), named with `aria-label`.
- **Remote surfaces redraw at most 10 times a second.** The breath's clock ticks every 100 ms, but only the terminal redraws every tick. Elsewhere the words redraw once a second (about 32 `ui_invalidate` messages per breath).

## Commands

```bash
claude plugin validate --strict plugin     # the plugin
claude plugin validate .                    # the marketplace file
claude plugin test plugin                   # the mod's tests, on all four surfaces, about a second
test/run-matrix.sh                          # 2.1.220 2.1.280 2.1.286 latest, about 8 minutes
test/run-matrix.sh latest                   # just the newest version
scripts/package-plugin.sh                   # dist/soft-landing.zip, for Customize → Upload plugin
claude --plugin-dir ./plugin                # try it in a terminal session, reloads on save
```

`test/run-matrix.sh` installs each Claude Code version from npm into `~/.cache/soft-landing-cc` once. It uses no real model and no account.

## Next build steps (v0.2)

1. Done (16 October): the breath inside the Code pane.
2. Done (16 October): "Claude is asking you something" in Pause only, with "Go to it".
3. The Land note in the Code pane (`Input`), saved with `$.store`, kept 14 days and at most 7, with delete. (Phones are out of scope for now.)
4. A one-time "Take your first breath" button above the prompt in the first session (a `$.store` flag).
5. `/soft-landing:about`: what it is, "Why this practice?" with narrowed claims and sources, your data, delete everything.
6. The text breath's one-line tip: "Quit and reopen the Claude app to see Soft Landing in a side panel."
7. Tests: the Land note never reaches the stand-in model, two sessions at once, uninstall leaves nothing behind.
8. Release, in order:
   - Commit, force-push once (the old first commit carries a personal email), tag `v0.2.0`.
   - While the repo is still private: connect GitHub in Claude, install the Claude GitHub App, add `flenguyen/soft-landing` as a marketplace in Customize, and test the install on the desktop and the phone. Private repos work as marketplaces on claude.ai (docs: claude.com/docs/plugins/overview.md).
   - GitHub settings: email privacy, private vulnerability reporting. Make the repo public. Share the link.
   - Submit to Anthropic's directory at claude.ai/directory/manage (paid plan; automated checks, a security scan, and a human review of new listings; "Review time isn't fixed"). Don't wait on it to launch.

## Writing style

For docs, UI copy and messages to the maintainer: plain words, short sentences, no em dashes. Keep what you tested separate from what you assume. Before anything that runs longer than 10 minutes, say what it is and why.

# Test results

What has been checked, how, and what hasn't. Newest first. Keep "tested" and "assumed" apart.

## How the Claude Code tests work

`test/harness/drive.py` runs a real Claude Code (installed from npm) against `test/harness/fake_api.py`, a scripted stand-in for the model. It talks to Claude Code the way the desktop app and the phone app do: stream-json in and out, plus the apps' control messages for drawing (`ui_attach`, `ui_render`, `ui_press`). That's close to the real apps, but it isn't them. Anything only the real app shows still needs a person to look.

The stand-in model logs every request, so a test can tell whether a command or a note ever reached Claude.

## 19 October 2026: the release build

| Finding | Versions | How |
|---|---|---|
| The latest build works: Pause, Land after Pause, the chat card | Claude desktop app, Antigravity | **Maintainer tested**, no issues reported |

## 17 October 2026: iPhone

| Finding | Versions | How |
|---|---|---|
| On the iPhone (same account, app relaunched, plugin uploaded several times), neither `/pause` nor `/soft-landing` shows in the slash menu. Other slash commands do show | Claude iOS app | **Maintainer tested** |

| A small probe plugin (two skills, one locked with `disable-model-invocation`, one not, no code), uploaded in Customize: neither `/probe-locked` nor `/probe-open` shows on the iPhone, in Chat or in Code | Claude iOS app | **Maintainer tested** |

| Standalone skills (`soft-pause`, `soft-land`, name and description only) uploaded in Customize → Skills didn't work on the iPhone either. The maintainer's own hand-made skills do show there | Claude iOS app | **Maintainer tested** (no detail on how it failed) |

So uploaded plugins don't reach the iPhone at all, and the lock isn't the cause. Phones are out of scope for the first launch (decision, 17 October). Still worth trying later: a plugin added from the GitHub marketplace, on the phone.

## 17 October 2026: safety pass

An independent review read every shipped file. No high-severity findings. Fixed:

| Finding | Fix | How checked |
|---|---|---|
| A subagent finishing its turn would hide Pause and Land while Claude was still working | Track only the main turn | mod test: a subagent's end keeps the buttons, an interrupted main turn hides them |
| "Claude is asking you something" could linger after the question was answered | Cleared when a turn starts or ends | mod test |
| `/clear` (a new session in the same process) kept the old pane state | Reset on `session.start` | read the code. No test: the kit has no new-session call |
| Text typed after `/pause` reaches Claude on the skill path | The skill tells Claude to ignore it and act on nothing. Disclosed in the README | read the skill |
| Two cards in one chat shared an `id`, so one card's Begin could start the other. Bare `p` and `label` styles could restyle the page | No ids, styles scoped under `.sl`, a checkbox inside its label | browser: two cards on a page, pressing the first leaves the second still |
| The card's toggle had no name for screen readers ("checkbox, on") | `aria-label="Breathe"` | browser accessibility tree |
| The package script could ship stale or untracked files | Builds in a fresh temp folder from the files git would publish, minus tests | the zip holds exactly 7 files |
| A tool decision of allow, deny or ask could, in theory, be changed | Proven unchanged in Pause and Land | 3 mod tests |

Checked and fine: no network, file, process or storage calls in the mod. Debug lines are fixed phrases. No script, link or shell line in any skill. The fake test key is clearly fake, and the stand-in model listens on 127.0.0.1 only. 24 mod tests pass.

## 17 October 2026: Pause then Land, and the shell hook

| Finding | Versions | How |
|---|---|---|
| Pressing Land after Pause, in the same session, left the panel on Pause in Antigravity | Claude Code extension | **Maintainer tested** |
| The engine side was right: after Land, the pane reads "Two minutes. Nothing to do." Likely cause: the editor's webview missed the one redraw sent with the button press, then nothing else came, so it kept Pause's last frame while the ring played out 30 s | 2.1.302 (Antigravity's own binary), as desktop and as editor | new `drive.py switch` scenario |
| Fix: switching from Pause to Land closes and reopens the panel, then redraws twice (at once and 300 ms later). The engine now sends the panel's close, its reopening, and both redraws | 2.1.302 | `drive.py switch`, message log |
| The no-op shell hook (`Stop`: `true`) can go. With `"hooks": {}` beside the mod, 2.1.220 reports no plugin error, older versions run the text breath, latest's mod answers | 2.1.220, 2.1.280, 2.1.302 | `drive.py idle`, `plugin_errors` in the start message |
| With only `modules` (no `hooks` object), 2.1.220 tells the app about a plugin error (`hook-load-failed`) | 2.1.220 | start message |
| 19 mod tests pass, including Land after Pause when Pause is ready, breathing or done | 2.1.299 engine | `claude plugin test plugin` |

Not yet tested: the fix in Antigravity itself, and whether Customize still shows "Can run code without asking" once the shell hook is gone (the mod is still code that runs, so it may).

## 16 October 2026: Haiku for the skills

| Finding | Versions | How |
|---|---|---|
| With `model: haiku` on the Pause skill, `/pause` runs on Haiku, and the next prompt goes back to the session model | 2.1.220 (claude-haiku-4-5), 2.1.302 (claude-haiku-5-5) | `drive.py idle --then`, model read from the stand-in model's log |
| `claude plugin validate --strict` accepts `model: haiku` | 2.1.299 | validate |

| Chat ignores the skill's `model: haiku`. `/pause` in a chat on Opus takes about 15 s to show the card. The same chat switched to Haiku by hand takes 4 to 5 s. The upload itself accepts the field | Claude desktop app, chat | **Maintainer tested** |

| Chat cards cut to the minimum, no script: a CSS ring, one fixed line, and a Begin that turns into Leave when ready. Pause 788 characters (was 1,734 at first, 1,478 this morning). Land 908, with its ring fading to a trace over 2 minutes. Both breathe in a browser | Chromium | in-app browser |

| The minimal card on Opus in a real chat: about 7 s (was about 15 s). The button overlapped the wrapped line and the bottom was clipped, and Claude added a sentence after the card. Fixed the layout (a column with gaps, a 30-character line, a block button) and made the no-extra-text rule blunter | Claude desktop app, chat | **Maintainer tested**, screenshot. Fix checked in a narrow browser window |

Not yet tested: Cowork and the phone with `model:` (expected to ignore it too), and the fixed card in a real chat.

## 16 October 2026: Land becomes 2 minutes

| Finding | Versions | How |
|---|---|---|
| In the pane, Land runs 12 breaths: counts for 4, then one line per breath (set down, then turn outward), phase dots, the ring fading to a trace, and ends with "Notice the room around you." and no buttons | 2.1.299 engine | `claude plugin test plugin`, all four surfaces, 16 tests pass |
| The new chat cards draw and breathe in a browser: dashed-circle ring, counts, phase lines, the ending with no buttons. Pause card 1,478 characters, Land card 1,820. The first Pause card was 1,734 | Chromium | in-app browser, with the chat's CSS variables stood in |

Not yet tested: the new cards inside a real Claude chat, and whether the smaller card arrives noticeably sooner.

## 16 October 2026: the breath in the Code pane

The pane now runs the real breath: the dotted ring (`Svg` on desktop, editor and phone, Braille on the terminal), 4 in and 6 out, three times, then Pause's or Land's ending. Begin, Leave when ready, and in Pause only, "Claude is asking you something" with Go to it.

| Finding | Versions | How |
|---|---|---|
| 13 mod tests pass on terminal, desktop, vscode and mobile: band, breath timing, ring per surface, Land's ending, Leave when ready, About, the question in Pause only, Go to it, the no-room fallback, command names | 2.1.299 engine | `claude plugin test plugin`, mocked clock |
| In a real Claude Code process, `/pause` and `/land` open the pane, Begin starts the breath, and the pane reads right at 1, 5, 12 and 32 s (ring grows on the in-breath, shrinks on the out-breath, ends with the right words) | 2.1.286, 2.1.302 | `drive.py breath`, desktop and mobile |
| During a breath the engine tells the app to redraw about 10 times a second, and stops at 30 s | 2.1.302 | 298 `ui_invalidate` messages in 30.1 s |
| In a terminal session, `/pause` opens the side pane with the Braille ring, the words and both buttons, with no reply from Claude | 2.1.295 | seen on screen in the Terminal panel. Pressing Begin there not yet tried |
| In Antigravity, after a re-upload and a full restart, the breath works in the side panel | Claude Code extension 2.1.301 | **Maintainer tested** |
| In Antigravity, the ring showed as its alt text, with no animation. Cause: the ring sent a new SVG every 100 ms, and the editor's webview waits up to 1 s to draw each one off-screen, then gives up and shows the alt text | Claude Code extension 2.1.301 | **Maintainer tested**, screenshot. Cause read from the extension's webview code |
| Fixed: one self-animating SVG per breath (CSS animation, `currentColor`). In a browser, drawn as an image the way the webview does, it grows over 4 s, shrinks over 6 s, three times, in the theme's text color on dark and light | Chromium | in-app browser, screenshots at 2, 4.5, 7.5 and 18 s |
| After a re-upload and a full restart, the ring animates in Antigravity's side panel | Claude Code extension 2.1.301 | **Maintainer tested** |
| The SVG source stays the same for the whole breath, then returns to the still ring. Redraw messages fell from about 300 to 32 per breath | 2.1.302 | `drive.py breath` |
| If nothing places the pane, `/pause` falls back to the text breath, and the Pause button shows one sentence saying why | 2.1.299 engine | mod test only |

`test/run-matrix.sh` on all four versions (latest 2.1.302) gave the same 20 rows as the command-rename run below, so the new mod changes nothing on older versions. From now on the matrix also runs the `breath` scenario.

Assumed, not tested: that the webview's off-screen drawing honours `prefers-reduced-motion` inside the SVG, and that the phone app passes its text color in as Antigravity does (if not, `currentColor` is black there).

## 16 October 2026: command rename

The commands became `/soft-landing:pause`, `/soft-landing:land` and `/soft-landing:about`. The mod's `command.run` now matches only those full names.

`claude plugin validate --strict plugin` passed. `test/run-matrix.sh` (latest was 2.1.302) gave the same table as 14 October, now with `/pause` as the command:

```
version    scenario  app      result
2.1.220    idle      none     skill ran, 1 request(s) to Claude
2.1.220    idle      desktop  skill ran, 1 request(s) to Claude
2.1.220    midturn   desktop  waited for the turn to end (15.41s)
2.1.220    band      desktop  app drawing not supported
2.1.220    band      mobile   app drawing not supported
2.1.280    idle      none     skill ran, 1 request(s) to Claude
2.1.280    idle      desktop  skill ran, 1 request(s) to Claude
2.1.280    midturn   desktop  waited for the turn to end (15.38s)
2.1.280    band      desktop  app drawing not supported
2.1.280    band      mobile   app drawing not supported
2.1.286    idle      none     skill ran, 1 request(s) to Claude
2.1.286    idle      desktop  Soft Landing answered, no Claude reply
2.1.286    midturn   desktop  waited for the turn to end (15.43s)
2.1.286    band      desktop  buttons ['Pause', 'Land'], pane opened mid-turn
2.1.286    band      mobile   buttons ['Pause', 'Land'], pane opened mid-turn
latest     idle      none     skill ran, 1 request(s) to Claude
latest     idle      desktop  Soft Landing answered, no Claude reply
latest     midturn   desktop  waited for the turn to end (15.47s)
latest     band      desktop  buttons ['Pause', 'Land'], pane opened mid-turn
latest     band      mobile   buttons ['Pause', 'Land'], pane opened mid-turn
```

Also on 16 October:

| Finding | Versions | How |
|---|---|---|
| All six spellings work: `/pause`, `/land`, `/about` and the three full names. With the app attached, the mod answers each one with no Claude request. Without it, the right skill reaches Claude | 2.1.302 | `drive.py idle --command`, stand-in model log |
| With a second plugin that also has a `pause` skill, `/other-tools:pause` runs that plugin's skill and Soft Landing stays out of it | 2.1.302 | `drive.py --plugin` twice |
| With two plugins that both have `pause`, the short `/pause` goes to whichever plugin loaded first, with no warning | 2.1.302 | both load orders |
| In Antigravity (built on VS Code), the Claude Code extension draws the Pause and Land buttons, and Pause opens the side panel mid-turn. The panel shows only placeholder text, since the breath isn't built yet | Claude Code extension | **Maintainer tested**, screenshot |

## 14 October 2026: matrix from the repo

`test/run-matrix.sh 2.1.220 2.1.280 2.1.286 latest` (latest was 2.1.299):

```
version    scenario  app      result
2.1.220    idle      none     skill ran, 1 request(s) to Claude
2.1.220    idle      desktop  skill ran, 1 request(s) to Claude
2.1.220    midturn   desktop  waited for the turn to end (15.89s)
2.1.220    band      desktop  app drawing not supported
2.1.220    band      mobile   app drawing not supported
2.1.280    idle      none     skill ran, 1 request(s) to Claude
2.1.280    idle      desktop  skill ran, 1 request(s) to Claude
2.1.280    midturn   desktop  waited for the turn to end (15.78s)
2.1.280    band      desktop  app drawing not supported
2.1.280    band      mobile   app drawing not supported
2.1.286    idle      none     skill ran, 1 request(s) to Claude
2.1.286    idle      desktop  Soft Landing answered, no Claude reply
2.1.286    midturn   desktop  waited for the turn to end (15.81s)
2.1.286    band      desktop  buttons ['Pause', 'Land'], pane opened mid-turn
2.1.286    band      mobile   buttons ['Pause', 'Land'], pane opened mid-turn
latest     idle      none     skill ran, 1 request(s) to Claude
latest     idle      desktop  Soft Landing answered, no Claude reply
latest     midturn   desktop  waited for the turn to end (15.75s)
latest     band      desktop  buttons ['Pause', 'Land'], pane opened mid-turn
latest     band      mobile   buttons ['Pause', 'Land'], pane opened mid-turn
```

How to read it:
- **idle, no app:** like `claude -p` or a session nothing draws for. The plain skill runs, so Claude replies with the text breath.
- **idle, desktop:** on 2.1.286+, the mod answers the command itself. Zero requests to Claude.
- **midturn:** a typed command sent while Claude works waits until the turn ends, on every version. That's why Pause is a button in the app.
- **band:** on 2.1.286+, the Pause and Land buttons draw for the desktop app and the phone app, and pressing Pause opens the breath while Claude keeps working. Older versions refuse the app's drawing messages.

## 13 October 2026: findings from the planning session

All on real Claude Code with the stand-in model unless marked.

| Finding | Versions | How |
|---|---|---|
| A typed command mid-turn waits for the turn to end, and never reaches Claude | 2.1.287, 2.1.296 | app-style session |
| Same with the message queue's `priority: "now"` | 2.1.296 | app-style session |
| `immediate: true` commands also wait in app-style sessions. The command list the app receives doesn't say which commands are immediate | 2.1.296 | `initialize` response |
| `prompt.submit` doesn't fire for slash commands in app-style sessions | 2.1.296 | debug log |
| A button above the prompt, pressed 6 s into a 20 s turn, opens the pane at once | 2.1.286, 2.1.287, 2.1.296 | `ui_press` |
| A pane only places for an app that reports `viewport.isFullscreen` (true or false) when it attaches | 2.1.296 | debug log |
| The settings `Notification` hook doesn't fire for a permission prompt in an app-style session | 2.1.296 | `can_use_tool` flow |
| A mod's `tool.check` hook sees `decision: "ask"` at the moment the app is asked | 2.1.296 | `can_use_tool` flow |
| A mod's `command.run` hook can answer a plugin skill's command (`soft-landing:soft-pause`), so the skill never runs and Claude gets no request | 2.1.296 | stand-in model log |
| A same-named plugin skill wins over a mod-registered command when typed. So we answer the skill's command instead of registering our own | 2.1.296 | stand-in model log |
| Without mods, the plugin still loads its skills, and the skill text reaches Claude intact | 2.1.220, 2.1.250, 2.1.280, 2.1.284 | stand-in model log |
| A `hooks.json` with only `modules` reports `hook-load-failed`. With a real `hooks` entry beside it, it doesn't | 2.1.220 | debug log |
| 2.1.284 refuses `ui_attach`. With early access on, the mod loads and takes the command, but nothing can draw | 2.1.284 | control responses |
| A skill's `!` shell line runs before Claude sees the skill | 2.1.220, 2.1.296 | stand-in model log |
| A skill's `!` line that writes under `~/.claude` is refused without a prompt | 2.1.280, 2.1.296 | stderr |
| The breath card drawn inline in a Claude chat works ("works great") | Claude app chat | **Maintainer tested** |

## Not yet tested

- **Customize → Upload plugin, then the Code tab:** does the plugin reach the Code tab, and do the buttons show in the real app? (Check B in the plan.)
- **The real phone app** in a Remote Control session. The docs still say plugin drawing only shows on the computer.
- **Claude drawing the exact card in a regular chat, every time.** Try `/pause` in several fresh chats, including on a phone.
- **"pause" sent mid-task in a long-running chat.**
- **Whether a Land note can be saved in the chat card** (browser storage inside the card).
- **Real model replies** for the text breath. The stand-in model can't show what Claude says.
- **The breath in the real apps:** does the ring look right and move smoothly in the desktop app's Code tab and on the phone? (Antigravity works, ring animating.) Does it follow light and dark mode, and stop moving with reduced motion turned on?
- **Closing the pane by hand** mid-breath. The mod stops its clock on `ui.close`, but no test drives that path.
- VS Code itself (drawing was seen in Antigravity, which is built on VS Code), Windows, Linux desktop, light and dark themes on the card, screen readers.

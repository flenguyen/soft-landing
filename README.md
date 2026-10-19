# Soft Landing

A 30-second breath while Claude works, and a 2-minute landing when you're done.

So when you work with AI agents, they can run for minutes at a time, and it's easy to just sit there watching them and then stay at the screen long after you meant to stop. Soft Landing gives you a small pause while the work carries on, and a gentle way to close out when you're ready to go back to the rest of your day. It's not for any particular kind of day, it's just a way back to life.

## What it does

| Command | What happens |
|---|---|
| `/soft-landing:pause` | A 30-second breath. A dotted circle grows while you breathe in for 4 and shrinks while you breathe out for 6, three times. |
| `/soft-landing:land` | Two minutes to close out. You settle for a few breaths, then set the work down, then look up from the screen, and it ends with "Notice the room around you." |
| `/soft-landing:about` | What Soft Landing is, and what it keeps about you (nothing). |

You can also just type `/pause` or `/land`, unless another plugin uses the same name, in which case the full names above always work.

## Where it works

| Where | How it looks |
|---|---|
| Claude chat and Cowork, on the computer | Claude draws the breath as a small card in its reply |
| Claude Code in the desktop app | Pause and Land buttons sit above the prompt while Claude works, and the breath opens in a side panel while Claude keeps going |
| Claude Code in an editor built on VS Code | The same buttons and panel (I've used it in Antigravity) |
| Older Claude Code, cloud sessions | A short text breath |

It never opens a web page, and it never approves, answers or cancels anything for you.

## Known limits

It's early, so here's what I'd want to know before trying it.

- In regular chat, each breath is a reply from Claude, so it takes a few seconds to show up (about 7 seconds on Opus when I tested it, quicker on smaller models), and it counts towards your usage like any other message. In Claude Code it's instant, because the plugin answers on its own without asking Claude.
- Land in chat is simpler than in Claude Code. You get the two-minute ring, but not the lines that walk you through each part.
- It doesn't work on phones yet, because the Claude iOS app doesn't load plugins added this way. I'd like to add phones once that's possible.
- There's no way yet to leave yourself a note when you land. That's planned.

## Install

You can add it from inside the Claude app, no Terminal needed:

1. Go to **Customize → Plugins → Add → Add marketplace**
2. Enter `flenguyen/soft-landing` and click **Add**
3. Click **Soft Landing**, then **Add**
4. In any chat, type `/pause`

The plugin follows your Claude account, so it shows up in chat, Cowork and Claude Code on your computer.

If you're in a Claude Code terminal session (2.1.275 or later), it's one line:

```
/plugin install soft-landing --marketplace flenguyen/soft-landing
```

If you want to try a build before it's released, run `scripts/package-plugin.sh` and upload `dist/soft-landing.zip` in **Customize → Plugins → Add → Upload plugin**.

## Uninstall

Go to **Customize → Plugins → Soft Landing → Remove**. Soft Landing doesn't save anything about you or your work, so there's nothing left behind to clean up.

## Safety and privacy

When you add Soft Landing, Customize warns that uploaded and third-party plugins aren't controlled by Anthropic, and it lists "Can run code without asking". That would make me nervous too, so here is exactly what it means for this plugin. Every file is in this repo if you want to read it yourself.

**What it's made of.** There are three skills in `plugin/skills/`, which are plain-text instructions for Claude, and they only run when you type the command (Claude can't start them on its own). There's also one small module for Claude Code, `plugin/hooks/register.tsx`, which draws the Pause and Land buttons and the side panel. That module is the "code" in the warning: it runs inside Claude Code on your computer without asking each time. It doesn't run any shell commands, and there are no other hooks.

**What the Claude Code module can see, and what it does with it.**

| It sees | Why | What it keeps |
|---|---|---|
| When Claude starts and finishes a turn | To only show the buttons while Claude is working | Nothing |
| The name of each slash command | To answer its own three, and pass every other one on untouched | Nothing |
| Each decision Claude Code makes about whether to ask you before using a tool | During Pause, to tell you "Claude is asking you something" | Nothing. It only checks whether the decision is "ask", and hands it back unchanged. There are tests for allow, deny and ask |

It never makes network calls, never reads or writes files, never runs programs, and never sends anything to Claude. It never approves, denies, answers, cancels or hides anything for you. If it ever breaks, Claude Code skips it and carries on as if it wasn't there. It keeps everything in memory, and that's gone when the session ends.

**In chat and Cowork.** Each `/pause` or `/land` is one reply from Claude, and Claude writes a small card with no script in it, that loads nothing from the internet and only styles itself. Claude sees the command, and anything you type after it, but the skill tells Claude to ignore that extra text. It never sees what you do in the card. The reply uses whatever model your chat is on, because a plugin can't change that. In Claude Code, the text breath runs on Haiku to keep it quick.

**Updates.** If you add Soft Landing from its GitHub marketplace, updates come from this repo. Each release is tagged, so you can always see what changed.

If you find a problem, please see [`SECURITY.md`](SECURITY.md).

## A note on the practice

Soft Landing is a short, comfortable breathing pause, and it isn't a treatment. The 4-in, 6-out rhythm is a design choice, not a validated protocol, so breathe at whatever pace feels right. If you're curious about the research on short breaks and work transitions, I've summarized it, with its limits, in [`docs/v0.2-plan.md`](docs/v0.2-plan.md).

## Feedback

If you try it, I'd love to hear how it fits into your day, good or bad. You can open an issue on this repo. It's still early, so honest feedback really helps.

## Development

If you want to work on it, start with [`CLAUDE.md`](CLAUDE.md). It covers how it works, the rules it follows, the gotchas we hit, and what's next, and it's written for both people and Claude Code. The test setup is in [`test/README.md`](test/README.md). It runs real Claude Code versions against a scripted stand-in for the model, so you don't need an account or a real model to run it.

## License

MIT. See [`LICENSE`](LICENSE).

# Decisions

Short log of product decisions, newest first. Add to it rather than rewriting it.

| Date | Decision | Why |
|---|---|---|
| 2026-10-19 | Positioning: Soft Landing is for any day, a way to step back into life after working with Claude. It doesn't assume a hard day, and copy never frames it that way | Maintainer. Also sets it apart from the App Store app "Soft Landing for Hard Days" |
| 2026-10-17 | Phones are out of scope for the first launch. Launch on the computer: chat, Cowork, and Claude Code (desktop app, terminal, editors) | Maintainer: launch and validate first. Uploaded plugins don't reach the iPhone (tested), and standalone skills didn't work there either. Revisit once the marketplace install can be tried on a phone. Replaces "Phones (iOS and Android) are in scope" (2026-10-13) |
| 2026-10-16 | Pause and Land skills set `model: haiku` | Maintainer: waiting for the card breaks the experience. In Claude Code the skill's reply runs on Haiku and the next prompt goes back to the session model (tested). Chat ignores it (tested: about 15 s on Opus, 4 to 5 s on Haiku). Kept for the Claude Code text breath |
| 2026-10-16 | Land is 2 minutes (12 breaths) in three phases: settle, set the work down, turn outward. It waits for Begin, the ring fades to a trace, and it ends with "Notice the room around you." with nothing to press | Maintainer: Land is for closing out and moving to the next thing in your life, so it needs longer than Pause. Replaces "the same 30-second practice" from the original brief. No "Again" at the end, as the brief asks |
| 2026-10-16 | Chat cards are minimal and script-free: a CSS ring, one fixed line, Begin and Leave when ready. In chat, Land has no phase lines, only "When it fades, notice the room around you." | Maintainer: about 15 s on Opus broke the experience, and chat ignores the skill's model. Claude must write the whole card, so fewer characters is the only lever. The full Land stays in the Code pane and the text breath |
| 2026-10-16 | Commands are `/soft-landing:pause`, `/soft-landing:land` and `/soft-landing:about`, and typing `/pause` or `/land` also works | Replaces `/soft-pause`, `/soft-land`, `/soft-landing`. The mod's `command.run` matches only the full names, so it never catches another plugin's `/pause`. If another plugin also has `pause`, the short `/pause` goes to whichever loaded first (tested), so docs say the full names always work |
| 2026-10-13 | Phones (iOS and Android) are in scope | Reach every platform people use Claude on |
| 2026-10-13 | Never open a web page | Maintainer: it breaks the flow. Stay inside chat or the Code tab, even if the experience is weaker |
| 2026-10-13 | Work in regular Claude chat and Cowork, not only Claude Code | As much surface area as possible, with the least onboarding |
| 2026-10-13 | In chat, Claude draws the breath as a card from the skill's instructions | The only way to show a breath inside chat. Costs one short Claude reply per breath. **Waiting on the maintainer's OK**, since the original brief said no model calls |
| 2026-10-13 | The animation can be simple and improve later | Minimum onboarding matters more. Claude's own product will keep changing |
| 2026-10-13 | Renamed to **Soft Landing** | Replaces Soft Return (and Still before it) |
| 2026-10-13 | Commands: `/soft-pause`, `/soft-land`, `/soft-landing` | Carry the product name so they never clash. **Open:** `/soft-land` and `/soft-landing` may be too close |
| 2026-10-13 | Install from Customize → Plugins (a GitHub marketplace now, Anthropic's directory later) | No Terminal, one paste at most |
| 2026-10-13 | One plugin, layered by feature detection, never by version numbers | Mods answer commands where something can draw. Otherwise the plain skill runs |
| 2026-10-13 | Mid-turn Pause in the Code tab is a button above the prompt | Typed commands wait until the turn ends in the apps |
| 2026-10-13 | Cut "hide Claude's output" from v0.2 | Not needed for the core. The panel sits beside the transcript |
| 2026-10-13 | Rejected a Mac menu bar app | Installs outside Claude, needs code signing, still needs a plugin |

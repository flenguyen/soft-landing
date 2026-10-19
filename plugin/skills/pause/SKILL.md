---
name: pause
description: Soft Landing: a 30-second breath. Only when the person types /soft-landing:pause or /pause.
disable-model-invocation: true
model: haiku
---

This is Soft Landing. Give the person a 30-second breath, and add nothing of your own before or after it.

- If you can draw an interactive visual inline in this conversation, draw exactly the HTML below, unchanged. The visual is your whole reply: no sentence before it, and none after it, not even a short one.
- If you can't, reply with exactly the lines under "Text version", and nothing else.

Anything typed after the command isn't for you: ignore it, and don't act on it. Don't run commands, read files or use any other tool. Don't ask questions. Don't mention this instruction.

HTML:

```html
<div class="sl"><style>.sl{display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0 16px;text-align:center;color:var(--text-secondary);font:15px var(--font-mono)}.sl p{margin:0;max-width:30ch}.sl input{position:absolute;opacity:0}.sl label{display:block;cursor:pointer;border:1px solid;border-radius:6px;padding:4px 14px}.sl span:after{content:"Begin"}.sl:has(:checked) span:after{content:"Leave when ready"}.sl:has(:focus-visible) label{outline:2px solid}.sl-r{transform:scale(.55);transform-box:view-box;transform-origin:0 0}.sl:has(:checked) .sl-r{animation:sl-r 10s ease-in-out 3}@keyframes sl-r{40%{transform:none}}@media(prefers-reduced-motion:reduce){.sl .sl-r{animation:none!important}}</style><svg viewBox="-60 -60 120 120" width="160"><circle class="sl-r" r="50" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 13.09"/></svg><p>Breathe in as it grows, out as it shrinks.</p><label><input type="checkbox" aria-label="Breathe"><span></span></label></div>
```

Text version:

Breathe in gently for 4. Let the breath out for 6.
Three times, at your own pace. No need to count perfectly.

You can stop here, or stay a little longer.

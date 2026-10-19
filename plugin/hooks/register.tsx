import type { EngineInterface, Register, Timer } from 'claude-code'

// Soft Landing, Claude Code layer. Where Claude Code can draw (2.1.286+),
// this answers /soft-landing:pause, /soft-landing:land and /soft-landing:about
// itself, with no turn for Claude, and shows Pause and Land buttons while
// Claude works. Where nothing draws, it steps aside and the plain skills run.
const PANE = 'soft-landing'
const COMMANDS = new Map<string, 'pause' | 'land' | 'about'>([
  ['soft-landing:pause', 'pause'],
  ['soft-landing:land', 'land'],
  ['soft-landing:about', 'about'],
])

// The breath: 4 s in, 6 s out. Pause is three breaths (30 s). Land is twelve
// (2 minutes) in three phases: settle, set the work down, turn outward. Same
// timing and words as the chat cards in skills/pause and skills/land.
const IN_MS = 4000
const CYCLE_MS = 10000
const TICK_MS = 100
const SMALL = 0.55
// Land's lines, one per breath from the fifth breath on.
const SET_DOWN = [
  'The work can stay where it is.',
  'Whatever is open will keep.',
  'Let your shoulders drop.',
  'You can stop here, with things unfinished.',
]
const TURN_OUTWARD = [
  'Let your eyes rest away from the screen.',
  'Notice what you can hear.',
  'Feel your feet on the floor.',
  'What comes next for you today?',
]
const SETTLE_BREATHS = 4

let working = false
let mode: 'pause' | 'land' | 'about' = 'pause'
let phase: 'ready' | 'breathing' | 'done' | 'left' = 'ready'
let startedAt = 0
let elapsed = 0
let timer: Timer | undefined
let needsYou = false
// Each breath gets its own SVG source, so "Again" starts the animation over.
let run = 0
// The terminal redraws its Braille ring every tick. Elsewhere the SVG moves
// by itself, so the words redraw once a second.
let fastTicks = false
let shownSecond = -1

function breaths() {
  return mode === 'land' ? SETTLE_BREATHS + SET_DOWN.length + TURN_OUTWARD.length : 3
}

async function canDraw($: EngineInterface) {
  return (await $.session.surfaces()).length > 0
}

// Opens the pane; says whether anything draws it.
async function open($: EngineInterface, next: 'pause' | 'land' | 'about') {
  const switching = next !== mode
  if (switching || phase !== 'breathing') {
    stop()
    phase = 'ready'
    elapsed = 0
  }
  // Switching (Pause, then Land) gets a fresh pane. An editor's webview can
  // miss the one redraw sent right after a button press, and then it keeps
  // showing Pause's last frame while the ring plays out its 30 seconds.
  if (switching) await $.ui.close({ id: PANE })
  mode = next
  needsYou = false
  $.ui.log(`soft-landing: opened ${next} (working=${working})`, { to: 'debug' })
  const opened = await $.ui.open({ id: PANE, title: 'Soft Landing', focus: true })
  if (!opened.isPlaced) {
    $.ui.log(`soft-landing: pane not placed (${opened.reason})`, { to: 'debug' })
    await $.ui.close({ id: PANE })
    return false
  }
  $.ui.invalidate('ui.render')
  // And redraw once more, in case the first one is lost.
  $.clock.after(300, () => $.ui.invalidate('ui.render'))
  return true
}

// From a button: if the pane can't show, say so in one sentence.
async function press($: EngineInterface, next: 'pause' | 'land') {
  if (!(await open($, next))) {
    $.ui.toast('Soft Landing has no room for its panel here. Widen the window, or type /pause when Claude is done.')
  }
}

async function begin($: EngineInterface) {
  stop()
  if (mode === 'about') mode = 'pause'
  phase = 'breathing'
  elapsed = 0
  run++
  shownSecond = 0
  fastTicks = (await $.session.surfaces()).includes('terminal')
  startedAt = await $.clock.now()
  timer = $.clock.every(TICK_MS, () => void tick($))
  $.ui.log('soft-landing: breath began', { to: 'debug' })
  $.ui.invalidate('ui.render')
}

async function tick($: EngineInterface) {
  if (phase !== 'breathing') return
  elapsed = (await $.clock.now()) - startedAt
  if (elapsed >= CYCLE_MS * breaths()) {
    stop()
    phase = 'done'
    $.ui.log('soft-landing: breath done', { to: 'debug' })
    $.ui.invalidate('ui.render')
    return
  }
  const second = Math.floor(elapsed / 1000)
  if (fastTicks || second !== shownSecond) {
    shownSecond = second
    $.ui.invalidate('ui.render')
  }
}

function leave($: EngineInterface) {
  stop()
  phase = 'left'
  $.ui.invalidate('ui.render')
}

async function goToIt($: EngineInterface) {
  stop()
  phase = 'ready'
  needsYou = false
  await $.ui.close({ id: PANE })
}

// Older Claude Code types leave agentId off turn.start, so read it loosely.
function isSubagent(e: object) {
  return (e as { agentId?: string }).agentId !== undefined
}

function stop() {
  timer?.cancel()
  timer = undefined
}

// How big the ring is, from SMALL to 1, eased like the card's CSS transition.
function ringScale() {
  if (phase !== 'breathing') return SMALL
  const w = elapsed % CYCLE_MS
  const ease = (x: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2
  const grow = w < IN_MS ? ease(w / IN_MS) : 1 - ease((w - IN_MS) / (CYCLE_MS - IN_MS))
  return SMALL + (1 - SMALL) * grow
}

type Line = { text: string; dim?: boolean }

function words(): Line[] {
  if (mode === 'about') {
    return [
      { text: "Soft Landing gives you a short breath while Claude works, and a gentle way to leave when you're done." },
      { text: 'Pause is 30 seconds. Land is 2 minutes, to close out and turn to what comes next.' },
      { text: 'Pause and Land sit above the prompt while Claude works. You can also type /pause or /land.' },
      { text: 'It saves nothing about you or your work.' },
    ]
  }
  if (phase === 'ready') return [{ text: mode === 'land' ? 'Two minutes. Nothing to do.' : 'Thirty seconds. Nothing to do.' }]
  if (phase === 'left') return [{ text: 'Back when you like.' }]
  if (phase === 'done') {
    return [{ text: mode === 'land' ? 'Notice the room around you.' : 'You can stop here, or stay a little longer.' }]
  }
  const breath = Math.floor(elapsed / CYCLE_MS)
  const w = Math.floor((elapsed % CYCLE_MS) / 1000)
  const count = w < 4 ? `Breathe in gently · ${4 - w}` : `Let the breath out · ${10 - w}`
  if (mode !== 'land' || breath < SETTLE_BREATHS) return [{ text: count }]
  const line = [...SET_DOWN, ...TURN_OUTWARD][breath - SETTLE_BREATHS] ?? ''
  return [{ text: line }, { text: w < 4 ? 'Breathe in' : 'Breathe out', dim: true }]
}

// Pause: which of the three breaths. Land: which of the three phases. ● ● ○
function progress() {
  const breath = Math.floor(elapsed / CYCLE_MS)
  const n = mode === 'land' ? (breath < SETTLE_BREATHS ? 0 : breath < SETTLE_BREATHS + SET_DOWN.length ? 1 : 2) : Math.min(2, breath)
  return [0, 1, 2].map(i => (i <= n ? '●' : '○')).join(' ')
}

// 24 dots on a circle, as the card draws them, over a faint disc. While
// breathing, the SVG animates itself and its source stays the same: the
// desktop and the editor draw each new source off-screen and show the alt
// text if a new one arrives before the last is drawn. currentColor is the
// app's own text color, so it follows light and dark themes.
function ringSvg(moving: boolean) {
  const dots = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 12) * Math.PI
    return `<circle cx="${(50 * Math.cos(a)).toFixed(2)}" cy="${(50 * Math.sin(a)).toFixed(2)}" r="2.2"/>`
  }).join('')
  const inAt = Math.round((IN_MS / CYCLE_MS) * 100)
  const rest = `transform:scale(${SMALL});opacity:.5`
  // Land fades the whole ring to a faint trace over its last two phases, and
  // ends there: something comfortable to leave.
  const land = mode === 'land'
  const fadeFrom = Math.round((SETTLE_BREATHS / breaths()) * 100)
  const motion = moving
    ? `.ring{animation:breathe ${CYCLE_MS}ms ${breaths()} both}` +
      `@keyframes breathe{0%{${rest};animation-timing-function:ease-in-out}` +
      `${inAt}%{transform:scale(1);opacity:1;animation-timing-function:ease-in-out}100%{${rest}}}` +
      (land ? `.all{animation:fade ${CYCLE_MS * breaths()}ms linear both}@keyframes fade{${fadeFrom}%{opacity:1}100%{opacity:.25}}` : '') +
      '@media (prefers-reduced-motion:reduce){.ring{animation:none;transform:scale(.8);opacity:.8}}'
    : ''
  const faded = land && phase === 'done' ? ' opacity=".25"' : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120" width="180" height="180" data-run="${moving ? run : 0}">` +
    `<style>.ring{${rest};transform-box:view-box;transform-origin:0 0}${motion}</style>` +
    `<g class="all"${faded}><g class="ring" fill="currentColor"><circle r="50" fill-opacity=".07"/>${dots}</g>` +
    '<circle r="2.5" fill="currentColor" fill-opacity=".8"/></g></svg>'
  )
}

// The terminal has no Svg: the same 24 dots in Braille, 15 cells by 8.
function ringBraille(scale: number) {
  const W = 15, H = 8
  const cells: number[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => 0))
  // Braille dot bits by row (0-3) and column (0-1) inside one cell.
  const bits = [0x01, 0x08, 0x02, 0x10, 0x04, 0x20, 0x40, 0x80]
  const dot = (x: number, y: number) => {
    const px = Math.round(x), py = Math.round(y)
    const row = cells[Math.floor(py / 4)]
    if (!row || px < 0 || px >= W * 2) return
    row[Math.floor(px / 2)]! |= bits[(py % 4) * 2 + (px % 2)]!
  }
  const cx = W - 0.5, cy = H * 2 - 0.5, r = (H * 2 - 2) * scale
  for (let i = 0; i < 24; i++) dot(cx + r * Math.cos((i / 12) * Math.PI), cy + r * Math.sin((i / 12) * Math.PI))
  dot(cx, cy)
  return cells.map(row => row.map(b => String.fromCharCode(0x2800 + b)).join(''))
}

export const register: Register = on => {
  // A new session (including /clear) starts clean.
  on('session.start', async ($, e, next) => {
    stop()
    working = false
    needsYou = false
    phase = 'ready'
    elapsed = 0
    return next(e)
  })

  // The main turn only: subagents start and finish turns of their own while
  // Claude is still working. "Claude is asking you something" lasts until the
  // turn moves on. An interrupted turn completes too (reason "aborted").
  on('turn.start', async ($, e, next) => {
    if (!isSubagent(e)) {
      working = true
      needsYou = false
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!isSubagent(e)) {
      working = false
      needsYou = false
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // In Pause only: notice when Claude Code decided to ask the person. It only
  // reads the decision, never changes it, and a failure here can't block it.
  on('tool.check', async ($, e, next) => {
    const decided = await next(e)
    try {
      if (decided.decision === 'ask' && mode === 'pause') {
        needsYou = true
        $.ui.invalidate('ui.render')
      }
    } catch {}
    return decided
  })

  // Full names only, so another plugin's /pause or /land is never caught.
  // If anything here fails, the plain skill runs instead.
  on('command.run', async ($, e, next) => {
    const target = COMMANDS.get(String(e.command))
    if (!target) return next(e)
    try {
      if (!(await canDraw($))) return next(e)
      // Nothing placed the pane: let the skill give the text breath instead.
      if (!(await open($, target))) return next(e)
      return {}
    } catch {
      return next(e)
    }
  })

  // The person closed the pane: stop the clock.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      try {
        stop()
        phase = 'ready'
      } catch {}
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!working && !e.props.isWorking) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box gap={1}>
        <Button key="soft-landing-pause" label="Pause" onPress={() => press($, 'pause')} />
        <Button key="soft-landing-land" label="Land" onPress={() => press($, 'land')} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    // The terminal's table still answers Svg (as an empty Box), so ask the surface.
    const Svg = e.surface !== 'terminal' && 'Svg' in table ? table.Svg : undefined
    return (
      <Box flexDirection="column" alignItems="center" padding={2} gap={1}>
        {mode !== 'about' && Svg && (
          <Svg source={ringSvg(phase === 'breathing')} alt="A ring of dots that breathes with you." width={180} height={180} />
        )}
        {mode !== 'about' && !Svg && (
          <Box flexDirection="column">{ringBraille(ringScale()).map(line => <Text dimColor>{line}</Text>)}</Box>
        )}
        {words().map(line => <Text dimColor={line.dim}>{line.text}</Text>)}
        {phase === 'breathing' && <Text dimColor>{progress()}</Text>}
        <Box gap={1}>
          {phase !== 'breathing' && !(mode === 'land' && phase === 'done') && (
            <Button
              key="soft-landing-begin"
              label={mode === 'about' ? 'Take a breath' : phase === 'done' ? 'Again' : 'Begin'}
              variant="primary"
              autoFocus
              onPress={() => begin($)}
            />
          )}
          {mode !== 'about' && phase !== 'left' && !(mode === 'land' && phase === 'done') && (
            <Button key="soft-landing-leave" label="Leave when ready" variant="secondary" dimColor onPress={() => leave($)} />
          )}
        </Box>
        {mode === 'pause' && needsYou && (
          <Box flexDirection="column" alignItems="center">
            <Text bold>Claude is asking you something.</Text>
            <Button key="soft-landing-go" label="Go to it" onPress={() => goToIt($)} />
          </Box>
        )}
        {mode === 'pause' && working && <Text dimColor>Claude is still working.</Text>}
      </Box>
    )
  })
}

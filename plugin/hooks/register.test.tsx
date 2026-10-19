import type { On, RenderSurface } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

// The breath in the Code pane, on every surface that draws it. The clock is
// mocked, so 30 seconds of breathing take no real time.
const SITE = { scroll: { offset: 0, bodyRows: 20 }, view: {} }
const PANE = {
  component: 'Pane',
  requestId: 'soft-landing',
  props: { title: 'Soft Landing', isFocused: true, bodyColumns: 40, placement: 'dock', ...SITE },
} as const
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 3, bodyColumns: 80, ...SITE },
} as const
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

// What the engine would answer beneath the plugin: the pane places, logs land.
function engine(on: On, surfaces: () => RenderSurface[] = () => ['desktop'], closed: string[] = []) {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.close', async (_$, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('ui.log', async () => ({ value: undefined }))
  on('session.surfaces', async () => ({ value: surfaces() }))
}

// The ring as drawn: the Svg's markup, or the terminal's Braille rows.
async function ring(ui: {
  find: (q: { type: string }) => Promise<{ props: Record<string, unknown> } | undefined>
  findAll: (q: { type: string; text: RegExp }) => Promise<{ text: string }[]>
}) {
  const svg = await ui.find({ type: 'Svg' })
  if (svg) return String(svg.props.source)
  return (await ui.findAll({ type: 'Text', text: /[\u2800-\u28ff]/ })).map(t => t.text).join('\n')
}

async function words(ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }) {
  return (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' / ')
}

describe('the band above the prompt', () => {
  test('shows Pause and Land while Claude works, and Pause opens the pane', async ($, on) => {
    const opened: string[] = []
    on('ui.open', async (_$, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })
    on('ui.log', async () => ({ value: undefined }))
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'soft-landing', surface, ...BAND })
      expect(await ui.find({ key: 'soft-landing-pause' })).toBeDefined()
      expect(await ui.find({ key: 'soft-landing-land' })).toBeDefined()
      await ui.press({ key: 'soft-landing-pause' })
      await ui.unmount()
    }
    expect(opened).toEqual(['soft-landing', 'soft-landing', 'soft-landing', 'soft-landing'])
  })
})

describe('the breath', () => {
  for (const surface of SURFACES) {
    test(`pause runs 4 in, 6 out, three times, on ${surface}`, { timeoutMs: 15000 }, async ($, on) => {
      const clock = mock.clock(on, { now: 1000 })
      engine(on)
      const band = await $.ui.mount({ plugin: 'soft-landing', surface, ...BAND })
      await band.press({ key: 'soft-landing-pause' })
      const ui = await $.ui.mount({ plugin: 'soft-landing', surface, ...PANE })

      expect(await words(ui)).toContain('Thirty seconds. Nothing to do.')
      const resting = await ring(ui)
      await ui.press({ key: 'soft-landing-begin' })
      await clock.settle()
      await ui.redraw()
      expect(await words(ui)).toContain('Breathe in gently · 4')
      expect(await words(ui)).toContain('● ○ ○')
      const first = await ring(ui)
      expect(first).not.toBe('')

      await clock.advance(3900)
      await ui.redraw()
      expect(await words(ui)).toContain('Breathe in gently · 1')
      if (surface === 'terminal') {
        // The terminal redraws its Braille ring as the breath grows.
        expect(await ring(ui)).not.toBe(first)
      } else {
        // Elsewhere one SVG animates itself: a new source mid-breath would
        // make the desktop and the editor show the alt text instead.
        expect(first).not.toBe(resting)
        expect(first).toContain('animation:breathe 10000ms 3')
        expect(await ring(ui)).toBe(first)
      }

      await clock.advance(100)
      await ui.redraw()
      expect(await words(ui)).toContain('Let the breath out · 6')
      expect(await ui.find({ key: 'soft-landing-begin' })).toBeUndefined()

      await clock.advance(10000)
      await ui.redraw()
      expect(await words(ui)).toContain('● ● ○')
      if (surface !== 'terminal') expect(await ring(ui)).toBe(first)

      await clock.advance(16000)
      await ui.redraw()
      expect(await words(ui)).toContain('You can stop here, or stay a little longer.')
      expect(await words(ui)).not.toContain('●')
      expect((await ui.find({ key: 'soft-landing-begin' }))?.props.label).toBe('Again')

      // Again starts the animation over, from a new source.
      await ui.press({ key: 'soft-landing-begin' })
      await clock.settle()
      await ui.redraw()
      if (surface !== 'terminal') {
        expect(await ring(ui)).toContain('animation:breathe')
        expect(await ring(ui)).not.toBe(first)
      }
    })
  }

  test('the ring is an Svg where the surface has one, and Braille on the terminal', async ($, on) => {
    engine(on)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'soft-landing', surface, ...PANE })
      const svg = await ui.find({ type: 'Svg' })
      if (surface === 'terminal') {
        expect(svg).toBeUndefined()
        expect(await words(ui)).toMatch(/[⠁-⣿]/)
      } else {
        expect(svg?.props.alt).toMatch(/ring of dots/)
        // Resting: no animation, and the app's own text color.
        expect(String(svg?.props.source)).not.toContain('animation')
        expect(String(svg?.props.source)).toContain('currentColor')
      }
      await ui.unmount()
    }
  })

  for (const surface of SURFACES) {
    test(`land runs 2 minutes in three phases and ends quietly, on ${surface}`, { timeoutMs: 15000 }, async ($, on) => {
      const clock = mock.clock(on)
      engine(on)
      const band = await $.ui.mount({ plugin: 'soft-landing', surface, ...BAND })
      await band.press({ key: 'soft-landing-land' })
      const ui = await $.ui.mount({ plugin: 'soft-landing', surface, ...PANE })
      expect(await words(ui)).toContain('Two minutes. Nothing to do.')
      await ui.press({ key: 'soft-landing-begin' })
      await clock.settle()
      if (surface !== 'terminal') {
        await ui.redraw()
        expect(await ring(ui)).toContain('animation:breathe 10000ms 12')
        expect(await ring(ui)).toContain('animation:fade 120000ms')
      }

      // Settle: four breaths of counting.
      await clock.advance(35000)
      await ui.redraw()
      expect(await words(ui)).toContain('Let the breath out')
      expect(await words(ui)).toContain('● ○ ○')

      // Set the work down: one line per breath.
      await clock.advance(5000)
      await ui.redraw()
      expect(await words(ui)).toContain('The work can stay where it is.')
      expect(await words(ui)).toContain('Breathe in')
      expect(await words(ui)).toContain('● ● ○')
      await clock.advance(30000)
      await ui.redraw()
      expect(await words(ui)).toContain('You can stop here, with things unfinished.')

      // Turn outward.
      await clock.advance(10000)
      await ui.redraw()
      expect(await words(ui)).toContain('Let your eyes rest away from the screen.')
      expect(await words(ui)).toContain('● ● ●')
      await clock.advance(30000)
      await ui.redraw()
      expect(await words(ui)).toContain('What comes next for you today?')

      // The end: the room, a faint ring, nothing to press, nothing about Claude.
      await clock.advance(10000)
      await ui.redraw()
      const text = await words(ui)
      expect(text).toContain('Notice the room around you.')
      expect(text).not.toContain('●')
      expect(text).not.toContain('Claude')
      expect(await ui.find({ key: 'soft-landing-begin' })).toBeUndefined()
      expect(await ui.find({ key: 'soft-landing-leave' })).toBeUndefined()
      if (surface !== 'terminal') expect(await ring(ui)).toContain('opacity=".25"')
    })
  }

  test('Leave when ready stops the breath', async ($, on) => {
    const clock = mock.clock(on)
    engine(on)
    const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...BAND })
    await band.press({ key: 'soft-landing-pause' })
    const ui = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...PANE })
    await ui.press({ key: 'soft-landing-begin' })
    await clock.advance(2000)
    await ui.press({ key: 'soft-landing-leave' })
    await clock.advance(30000)
    await ui.redraw()
    expect(await words(ui)).toContain('Back when you like.')
    expect((await ui.find({ key: 'soft-landing-begin' }))?.props.label).toBe('Begin')
  })
})

describe('around the breath', () => {
  for (const after of ['ready', 'breathing', 'done'] as const) {
    test(`Land replaces Pause when Pause is ${after}`, { timeoutMs: 15000 }, async ($, on) => {
      const clock = mock.clock(on)
      engine(on)
      const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...BAND })
      await band.press({ key: 'soft-landing-pause' })
      const ui = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...PANE })
      if (after !== 'ready') {
        await ui.press({ key: 'soft-landing-begin' })
        await clock.advance(after === 'done' ? 31000 : 5000)
      }
      await band.press({ key: 'soft-landing-land' })
      await ui.redraw()
      expect(await words(ui)).toContain('Two minutes. Nothing to do.')
      await ui.press({ key: 'soft-landing-begin' })
      await clock.advance(35000)
      await ui.redraw()
      expect(await words(ui)).toContain('Let the breath out')
      expect(await words(ui)).not.toContain('stay a little longer')
    })
  }


  test('about says what it is and what it keeps, with no ring', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'soft-landing:about', args: '', origin: { kind: 'user' }, presentation: {} } as never)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'soft-landing', surface, ...PANE })
      const text = await words(ui)
      expect(text).toContain('It saves nothing about you or your work.')
      expect(await ring(ui)).toBe('')
      expect((await ui.find({ key: 'soft-landing-begin' }))?.props.label).toBe('Take a breath')
      await ui.unmount()
    }
  })

  test('in Pause, a question from Claude shows, and Go to it closes the pane', async ($, on) => {
    const closed: string[] = []
    const clock = mock.clock(on)
    engine(on, undefined, closed)
    on('tool.check', async () => ({ decision: 'ask' }) as never)
    const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...BAND })
    await band.press({ key: 'soft-landing-pause' })
    await $.tool.check({ tool: 'Bash', input: { command: 'curl example.com' } })
    const ui = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...PANE })
    expect(await words(ui)).toContain('Claude is asking you something.')
    await ui.press({ key: 'soft-landing-begin' })
    await clock.advance(2000)
    await ui.press({ key: 'soft-landing-go' })
    expect(closed).toEqual(['soft-landing'])
    await clock.advance(30000)
    await ui.redraw()
    expect(await words(ui)).toContain('Thirty seconds. Nothing to do.')
  })

  test('Land never shows a question from Claude', async ($, on) => {
    engine(on)
    on('tool.check', async () => ({ decision: 'ask' }) as never)
    const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...BAND })
    await band.press({ key: 'soft-landing-land' })
    await $.tool.check({ tool: 'Bash', input: { command: 'curl example.com' } })
    const ui = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...PANE })
    expect(await words(ui)).not.toContain('asking')
    expect(await ui.find({ key: 'soft-landing-go' })).toBeUndefined()
  })
})

describe('when the pane has no room', () => {
  test('the command falls back to the text breath, and the button says why', async ($, on) => {
    const toasts: string[] = []
    let passedOn = 0
    on('ui.open', async () => ({ value: { isPlaced: false, reason: 'narrow terminal' } }))
    on('ui.close', async () => ({ value: undefined }))
    on('ui.log', async () => ({ value: undefined }))
    on('ui.toast', async (_$, e) => {
      toasts.push(String(e.text))
      return { value: undefined }
    })
    on('session.surfaces', async () => ({ value: ['terminal'] as RenderSurface[] }))
    on('command.run', async () => {
      passedOn++
      return { text: 'skill ran' }
    })
    const result = await $.command.run({ command: 'soft-landing:pause', args: '', origin: { kind: 'user' }, presentation: {} } as never)
    expect(result).toEqual({ text: 'skill ran' })
    expect(passedOn).toBe(1)
    const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'terminal', ...BAND })
    await band.press({ key: 'soft-landing-pause' })
    expect(toasts).toHaveLength(1)
  })
})

describe('working, from the main turn only', () => {
  const IDLE_BAND = { ...BAND, props: { ...BAND.props, isWorking: false } }
  type Mounter = { ui: { mount: (t: typeof IDLE_BAND & { plugin: string; surface: 'desktop' }) => Promise<{ find: (q: { key: string }) => Promise<unknown>; unmount: () => Promise<void> }> } }
  async function showsButtons($: Mounter) {
    const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...IDLE_BAND })
    const shown = (await band.find({ key: 'soft-landing-pause' })) !== undefined
    await band.unmount()
    return shown
  }
  const ended = (turnId: string, agentId?: string) =>
    ({ turnId, agentId, answer: '', durationMs: 1, isAborted: !agentId, reason: agentId ? 'answer' : 'aborted' }) as never
  function turns(on: On) {
    engine(on)
    on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
    on('turn.complete', async () => ({ text: '' }))
    // When the band steps aside, the engine would draw nothing there.
    on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>the engine's own band</Text>
    })
  }

  test('a subagent finishing does not hide the buttons, and an interrupted turn does', async ($, on) => {
    turns(on)
    await $.turn.start({ text: 'go', turnId: 'main' })
    expect(await showsButtons($ as never)).toBe(true)
    await $.turn.start({ text: 'sub', turnId: 'sub', agentId: 'helper' } as never)
    await $.turn.complete(ended('sub', 'helper'))
    expect(await showsButtons($ as never)).toBe(true)
    await $.turn.complete(ended('main'))
    expect(await showsButtons($ as never)).toBe(false)
  })

  test('a new turn clears "Claude is asking you something"', async ($, on) => {
    turns(on)
    on('tool.check', async () => ({ decision: 'ask' }) as never)
    const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...BAND })
    await band.press({ key: 'soft-landing-pause' })
    await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })
    const ui = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...PANE })
    expect(await words(ui)).toContain('Claude is asking you something.')
    await $.turn.start({ text: 'next', turnId: 'two' })
    await ui.redraw()
    expect(await words(ui)).not.toContain('asking')
  })
})

describe('never decides for the person', () => {
  for (const decision of ['allow', 'deny', 'ask'] as const) {
    test(`a tool decision of "${decision}" comes back unchanged, in Pause and in Land`, async ($, on) => {
      engine(on)
      const inner = { decision, reason: 'set by Claude Code' }
      on('tool.check', async () => inner as never)
      const band = await $.ui.mount({ plugin: 'soft-landing', surface: 'desktop', ...BAND })
      for (const key of ['soft-landing-pause', 'soft-landing-land']) {
        await band.press({ key })
        const result = await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' } })
        expect(result).toEqual(inner)
      }
    })
  }
})

describe('commands', () => {
  test('answers only its own full names, and only where something draws', async ($, on) => {
    let surfaces: RenderSurface[] = ['desktop']
    let passedOn: string[] = []
    engine(on, () => surfaces)
    on('command.run', async (_$, e) => {
      passedOn.push(e.command)
      return { text: 'skill ran' }
    })
    const run = (command: string) =>
      $.command.run({ command, args: '', origin: { kind: 'user' }, presentation: {} } as never)

    for (const name of ['soft-landing:pause', 'soft-landing:land', 'soft-landing:about']) {
      expect(await run(name)).toEqual({})
    }
    for (const name of ['other-tools:pause', 'pause', 'soft-pause', 'soft-landing:soft-pause']) {
      expect(await run(name)).toEqual({ text: 'skill ran' })
    }
    expect(passedOn).toEqual(['other-tools:pause', 'pause', 'soft-pause', 'soft-landing:soft-pause'])

    surfaces = []
    passedOn = []
    expect(await run('soft-landing:pause')).toEqual({ text: 'skill ran' })
    expect(passedOn).toEqual(['soft-landing:pause'])
  })
})

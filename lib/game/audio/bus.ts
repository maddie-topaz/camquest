// The sound bus. Anything (a React screen, a machine's emitted cue, a
// Phaser scene) raises a cue here; the audio layer is the one subscriber.
// A DOM event keeps every producer decoupled from Howler and lets the
// existing data-sfx attributes and tests observe cues without audio.

export const SFX_EVENT = 'camquest:sfx'

export type CueEvent = { cue: string; detail?: Record<string, unknown> }

export const emitCue = (cue: string, detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<CueEvent>(SFX_EVENT, { detail: { cue, detail } }))
}

export const subscribeCues = (listener: (event: CueEvent) => void) => {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => listener((event as CustomEvent<CueEvent>).detail)
  window.addEventListener(SFX_EVENT, handler)
  return () => window.removeEventListener(SFX_EVENT, handler)
}

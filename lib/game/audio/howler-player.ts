// Howler-backed AudioPlayer. One Howl per cue, created lazily on first
// play and kept, so repeated cues don't refetch. Loaded only in the
// browser (see audio-provider).

import { Howl, Howler } from 'howler'
import { resolveSound } from '../content/audio'
import type { AudioPlayer } from '../machines/audio'

export const createHowlerPlayer = (): AudioPlayer => {
  const howls = new Map<string, Howl>()

  const howlFor = (file: string) => {
    let howl = howls.get(file)
    if (!howl) {
      howl = new Howl({ src: [file], preload: true })
      howls.set(file, howl)
    }
    return howl
  }

  return {
    play: (cue, detail) => {
      const sound = resolveSound(cue, detail)
      if (!sound) return
      const howl = howlFor(sound.file)
      const id = howl.play()
      howl.volume(sound.volume, id)
      howl.rate(sound.rate, id)
    },
    setVolume: (volume) => {
      Howler.volume(volume)
    },
    unlock: async () => {
      const ctx = Howler.ctx as AudioContext | undefined
      if (!ctx) return true
      if (ctx.state === 'suspended') {
        try { await ctx.resume() } catch { /* still blocked */ }
      }
      return ctx.state === 'running'
    },
  }
}

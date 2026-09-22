'use client'

import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useActorRef, useSelector } from '@xstate/react'
import { Volume2, VolumeX } from 'lucide-react'
import { subscribeCues } from '@/lib/game/audio/bus'
import { audioMachine, type AudioPlayer } from '@/lib/game/machines/audio'

// Mounts the audio machine once for the app, feeds it every cue from the
// sound bus, and unlocks playback on the first user gesture. Howler is
// imported lazily so it never runs during server rendering.
//
// The mute preference is the one thing kept in localStorage: it's a
// per-device convenience, not game state, and it never leaves this browser.
const MUTE_KEY = 'camquest:muted'

const readMuted = () => {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}
const writeMuted = (muted: boolean) => {
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* private mode etc. */ }
}

type AudioContextValue = { muted: boolean; unlocked: boolean; toggleMute: () => void }

const AudioReactContext = createContext<AudioContextValue | null>(null)

export function AudioProvider({ children }: { children: React.ReactNode }) {
  // The machine needs a player at creation, before Howler has loaded, so
  // it gets a stand-in that forwards to the real one once it exists.
  const real = useRef<AudioPlayer | null>(null)
  const player = useMemo<AudioPlayer>(() => ({
    play: (cue, detail) => real.current?.play(cue, detail),
    setVolume: (volume) => real.current?.setVolume(volume),
    unlock: () => real.current?.unlock() ?? Promise.resolve(false),
  }), [])

  const actor = useActorRef(audioMachine, { input: { player, muted: readMuted() } })
  const muted = useSelector(actor, (snapshot) => snapshot.context.muted)
  const unlocked = useSelector(actor, (snapshot) => !snapshot.matches('locked'))

  useEffect(() => {
    let cancelled = false
    void import('@/lib/game/audio/howler-player').then(({ createHowlerPlayer }) => {
      if (cancelled) return
      real.current = createHowlerPlayer()
      real.current.setVolume(actor.getSnapshot().context.muted ? 0 : actor.getSnapshot().context.volume)
    })
    return () => { cancelled = true }
  }, [actor])

  // Unlock on the first gesture. Some browsers need a second try, so keep
  // listening until the context actually reports running.
  useEffect(() => {
    if (unlocked) return
    const attempt = () => { void player.unlock().then((ok) => { if (ok) actor.send({ type: 'UNLOCKED' }) }) }
    window.addEventListener('pointerdown', attempt)
    window.addEventListener('keydown', attempt)
    return () => { window.removeEventListener('pointerdown', attempt); window.removeEventListener('keydown', attempt) }
  }, [actor, player, unlocked])

  useEffect(() => subscribeCues(({ cue, detail }) => actor.send({ type: 'CUE', cue, detail })), [actor])

  const value = useMemo<AudioContextValue>(() => ({
    muted,
    unlocked,
    toggleMute: () => { writeMuted(!muted); actor.send({ type: 'TOGGLE_MUTE' }) },
  }), [actor, muted, unlocked])

  return <AudioReactContext.Provider value={value}>{children}</AudioReactContext.Provider>
}

export const useAudio = () => {
  const context = useContext(AudioReactContext)
  if (!context) throw new Error('useAudio must be used inside AudioProvider')
  return context
}

export function AudioToggle() {
  const { muted, toggleMute } = useAudio()
  return (
    <button type="button" className="audio-toggle" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute sound' : 'Mute sound'} title={muted ? 'Sound off' : 'Sound on'}>
      {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    </button>
  )
}

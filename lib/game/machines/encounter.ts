// One mini-game's lifecycle, independent of Phaser. The scene module and
// the game runtime are injected actors, so the machine (and its tests)
// never touch a canvas:
//
//   loading   fetching the scene module (and Phaser itself) on demand
//   playing   the game is mounted in the container; it ends by sending
//             RESULT back through the runtime actor
//   finished  result emitted, game torn down (final)
//   failed    load or runtime error; RETRY reloads
//
// Phaser mounts only while `playing` and is destroyed on the way out,
// which is the "Phaser inside React only during an encounter" rule.

import { assign, emit, fromCallback, fromPromise, setup } from 'xstate'
import type { EncounterResult } from '../content/encounters'

// What a scene module exports: a way to start the game in a container
// and a way to stop it. `onComplete` is called exactly once.
export type EncounterRuntime = {
  mount: (container: HTMLElement, onComplete: (result: EncounterResult) => void) => Promise<() => void> | (() => void)
}

export type EncounterMachineInput = {
  encounterId: string
  // Resolved when the game mounts, because the React ref that holds the
  // container is only populated after the actor is created.
  getContainer: () => HTMLElement | null
  load: (encounterId: string) => Promise<EncounterRuntime>
}

export type EncounterContext = {
  encounterId: string
  getContainer: EncounterMachineInput['getContainer']
  load: EncounterMachineInput['load']
  runtime: EncounterRuntime | null
  result: EncounterResult | null
  error: unknown
}

export type EncounterEvent = { type: 'RESULT'; result: EncounterResult } | { type: 'RETRY' } | { type: 'ABORT' }

export type EncounterEmitted = { type: 'result'; result: EncounterResult }

// Runs the mounted game until it reports a result. Cleanup (unmount,
// destroy Phaser) happens when this actor stops, whatever the reason.
const runGame = fromCallback<EncounterEvent, { runtime: EncounterRuntime; container: HTMLElement }>(({ input, sendBack }) => {
  let unmount: (() => void) | null = null
  let stopped = false
  Promise.resolve(input.runtime.mount(input.container, (result) => sendBack({ type: 'RESULT', result })))
    .then((cleanup) => {
      if (stopped) cleanup()
      else unmount = cleanup
    })
    .catch(() => sendBack({ type: 'ABORT' }))
  return () => {
    stopped = true
    unmount?.()
  }
})

export const encounterMachine = setup({
  types: {
    context: {} as EncounterContext,
    events: {} as EncounterEvent,
    input: {} as EncounterMachineInput,
    emitted: {} as EncounterEmitted,
  },
  actors: {
    loadRuntime: fromPromise(({ input }: { input: { load: EncounterMachineInput['load']; encounterId: string } }) => input.load(input.encounterId)),
    runGame,
  },
  guards: {
    hasContainer: ({ context }) => Boolean(context.getContainer()),
  },
}).createMachine({
  id: 'encounter',
  context: ({ input }) => ({ ...input, runtime: null, result: null, error: null }),
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'loadRuntime',
        input: ({ context }) => ({ load: context.load, encounterId: context.encounterId }),
        onDone: [
          { guard: 'hasContainer', target: 'playing', actions: assign({ runtime: ({ event }) => event.output }) },
          { target: 'failed', actions: assign({ error: () => new Error('No container to mount the encounter in') }) },
        ],
        onError: { target: 'failed', actions: assign({ error: ({ event }) => event.error }) },
      },
    },
    playing: {
      invoke: {
        src: 'runGame',
        input: ({ context }) => ({ runtime: context.runtime!, container: context.getContainer()! }),
      },
      on: {
        RESULT: {
          target: 'finished',
          actions: [
            assign({ result: ({ event }) => event.result }),
            emit(({ event }) => ({ type: 'result' as const, result: event.result })),
          ],
        },
        ABORT: { target: 'failed', actions: assign({ error: () => new Error('The encounter could not start') }) },
      },
    },
    finished: { type: 'final' },
    failed: {
      on: { RETRY: 'loading' },
    },
  },
})

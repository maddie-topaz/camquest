// The player's session with their save. Loads the view, then runs
// commands one at a time in the order they were asked for, so a fast
// sequence (unlock a passcode, then save progress) can never interleave
// or land out of order. Each command's result is emitted with the id it
// was queued under, which is how the React provider turns a queued
// command back into a promise.
//
//   loading → ready ⇄ syncing
//           → failed → RETRY → loading

import { assign, emit, fromPromise, setup } from 'xstate'
import type { Command } from '../types'
import type { SaveView } from '../view'

type Job =
  | { id: string; kind: 'command'; command: Command }
  | { id: string; kind: 'admin'; body: Record<string, unknown> }

export type PlayerMachineInput = {
  load: () => Promise<SaveView>
  run: (command: Command) => Promise<SaveView>
  admin: (body: Record<string, unknown>) => Promise<SaveView>
}

export type PlayerContext = PlayerMachineInput & {
  view: SaveView | null
  error: unknown
  queue: Job[]
}

export type PlayerEvent =
  | { type: 'LOAD' }
  | { type: 'RETRY' }
  | { type: 'COMMAND'; id: string; command: Command }
  | { type: 'ADMIN'; id: string; body: Record<string, unknown> }

export type PlayerEmitted =
  | { type: 'job.done'; id: string; view: SaveView }
  | { type: 'job.failed'; id: string; error: unknown }

export const playerMachine = setup({
  types: {
    context: {} as PlayerContext,
    events: {} as PlayerEvent,
    input: {} as PlayerMachineInput,
    emitted: {} as PlayerEmitted,
  },
  actors: {
    load: fromPromise(({ input }: { input: { load: () => Promise<SaveView> } }) => input.load()),
    runJob: fromPromise(async ({ input }: { input: { job: Job; run: PlayerMachineInput['run']; admin: PlayerMachineInput['admin'] } }) =>
      input.job.kind === 'command' ? input.run(input.job.command) : input.admin(input.job.body),
    ),
  },
  guards: {
    hasQueuedJob: ({ context }) => context.queue.length > 0,
  },
  actions: {
    enqueue: assign({
      queue: ({ context, event }) => {
        if (event.type === 'COMMAND') return [...context.queue, { id: event.id, kind: 'command' as const, command: event.command }]
        if (event.type === 'ADMIN') return [...context.queue, { id: event.id, kind: 'admin' as const, body: event.body }]
        return context.queue
      },
    }),
    dequeue: assign({ queue: ({ context }) => context.queue.slice(1) }),
  },
}).createMachine({
  id: 'player',
  context: ({ input }) => ({ ...input, view: null, error: null, queue: [] }),
  initial: 'loading',
  // Commands can be queued in any state; they run once the save is ready.
  on: {
    COMMAND: { actions: 'enqueue' },
    ADMIN: { actions: 'enqueue' },
  },
  states: {
    loading: {
      invoke: {
        src: 'load',
        input: ({ context }) => ({ load: context.load }),
        onDone: { target: 'ready', actions: assign({ view: ({ event }) => event.output, error: null }) },
        onError: { target: 'failed', actions: assign({ error: ({ event }) => event.error }) },
      },
    },
    failed: {
      on: { RETRY: 'loading', LOAD: 'loading' },
    },
    ready: {
      always: { guard: 'hasQueuedJob', target: 'syncing' },
      on: {
        LOAD: 'loading',
        COMMAND: { actions: 'enqueue', target: 'syncing' },
        ADMIN: { actions: 'enqueue', target: 'syncing' },
      },
    },
    syncing: {
      invoke: {
        src: 'runJob',
        input: ({ context }) => ({ job: context.queue[0], run: context.run, admin: context.admin }),
        onDone: {
          target: 'ready',
          actions: [
            assign({ view: ({ event }) => event.output, error: null }),
            emit(({ context, event }) => ({ type: 'job.done' as const, id: context.queue[0].id, view: event.output })),
            'dequeue',
          ],
        },
        // A rejected or failed command doesn't poison the session: the
        // view stays as it was and the next job runs.
        onError: {
          target: 'ready',
          actions: [
            emit(({ context, event }) => ({ type: 'job.failed' as const, id: context.queue[0].id, error: event.error })),
            'dequeue',
          ],
        },
      },
    },
  },
})

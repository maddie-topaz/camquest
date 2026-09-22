import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { getQuest } from '../content/quests'
import { questMachine, questSelectors, type QuestEmitted } from '../machines/quest'
import { completed, created, granted, saveFrom } from './helpers'

const gambit = getQuest('cams-gambit')!

const start = (overrides: Partial<Parameters<typeof questMachine.provide>[0]> = {}, input?: Partial<{ saved: NonNullable<ReturnType<typeof saveFrom>['quests'][string]>; completed: boolean; slug: string }>) => {
  const save = saveFrom([created()])
  const emitted: QuestEmitted[] = []
  const actor = createActor(questMachine.provide(overrides), {
    input: { quest: getQuest(input?.slug ?? 'cams-gambit')!, save, saved: input?.saved, completed: input?.completed ?? false },
  })
  actor.on('progress', (e) => emitted.push(e))
  actor.on('complete', (e) => emitted.push(e))
  actor.start()
  return { actor, emitted }
}

describe('questMachine', () => {
  it('starts gated on a passcode step and rejects a wrong code', () => {
    const { actor } = start()
    expect(actor.getSnapshot().matches({ step: 'gated' })).toBe(true)
    actor.send({ type: 'TYPE_PASSCODE', value: 'nope' })
    actor.send({ type: 'SUBMIT_PASSCODE' })
    expect(actor.getSnapshot().context.passcodeError).toBe(true)
    expect(actor.getSnapshot().matches({ step: 'gated' })).toBe(true)
  })

  it('unlocks with the right code (any case), persists, and opens the step', () => {
    const { actor, emitted } = start()
    actor.send({ type: 'TYPE_PASSCODE', value: ' insertcoin ' })
    actor.send({ type: 'SUBMIT_PASSCODE' })
    expect(actor.getSnapshot().matches({ step: { open: 'choosing' } })).toBe(true)
    expect(emitted.at(-1)).toMatchObject({ type: 'progress', progress: { step: 0, unlockedSteps: ['load-cartridge'] } })
  })

  it('mystery: select → lock choice → continue, committing the answer', () => {
    const { actor, emitted } = start()
    actor.send({ type: 'TYPE_PASSCODE', value: 'INSERTCOIN' })
    actor.send({ type: 'SUBMIT_PASSCODE' })
    const snap = () => actor.getSnapshot()
    expect(questSelectors.primaryDisabled(snap())).toBe(true)
    actor.send({ type: 'SELECT', value: 'Moon Cartridge' })
    expect(questSelectors.primaryLabel(snap())).toBe('Lock choice')
    actor.send({ type: 'REVEAL' })
    expect(questSelectors.isRevealed(snap())).toBe(true)
    expect(questSelectors.selectedCard(snap())?.outcome).toContain('Planet Royale')
    expect(questSelectors.primaryLabel(snap())).toBe('Continue')
    actor.send({ type: 'NEXT' })
    expect(snap().context.stepIndex).toBe(1)
    expect(snap().context.answers['load-cartridge']).toBe('Moon Cartridge')
    expect(snap().matches({ step: 'gated' })).toBe(true)
    expect(emitted.at(-1)).toMatchObject({ type: 'progress', progress: { step: 1 } })
  })

  it('restores saved progress, including an already-revealed mystery answer', () => {
    const { actor } = start({}, { saved: { step: 0, answers: { 'load-cartridge': 'Sun Cartridge' }, unlockedSteps: ['load-cartridge'], completions: 0 } })
    expect(actor.getSnapshot().matches({ step: { open: 'revealed' } })).toBe(true)
    expect(actor.getSnapshot().context.answer).toBe('Sun Cartridge')
  })

  it('a completed quest replays from the top', () => {
    const { actor } = start({}, { saved: { step: 3, answers: { x: 'y' }, unlockedSteps: ['a'], completions: 1 }, completed: true })
    expect(actor.getSnapshot().context.stepIndex).toBe(0)
    expect(actor.getSnapshot().context.answers).toEqual({})
  })

  it('finishing the last step emits complete with every answer and ends', () => {
    const saved = { step: gambit.steps.length - 1, answers: { 'load-cartridge': 'Sun Cartridge' }, unlockedSteps: gambit.steps.map((s) => s.id), completions: 0 }
    const { actor, emitted } = start({}, { saved })
    actor.send({ type: 'SELECT', value: 'Glass Garden' })
    actor.send({ type: 'REVEAL' })
    actor.send({ type: 'NEXT' })
    expect(actor.getSnapshot().matches('completing')).toBe(true)
    expect(emitted.at(-1)).toMatchObject({ type: 'complete', answers: { 'load-cartridge': 'Sun Cartridge', 'final-stage': 'Glass Garden' } })
    actor.send({ type: 'COMPLETED' })
    expect(actor.getSnapshot().status).toBe('done')
  })

  it('is locked when the save does not meet the quest requirements', () => {
    const save = saveFrom([created()])
    const actor = createActor(questMachine, { input: { quest: getQuest('unknown-signal')!, save, completed: false } }).start()
    expect(actor.getSnapshot().matches('locked')).toBe(true)
    expect(actor.getSnapshot().context.missing).toMatchObject({ questsCompleted: ['cams-gambit'] })
  })

  it('opens once the requirements are met', () => {
    const save = saveFrom([created(), granted('vip-wristband'), completed('cams-gambit'), { type: 'quest.unlocked', slug: 'unknown-signal', reason: 't' }])
    const actor = createActor(questMachine, { input: { quest: { ...getQuest('unknown-signal')!, steps: gambit.steps }, save, completed: false } }).start()
    expect(actor.getSnapshot().matches('locked')).toBe(false)
  })
})

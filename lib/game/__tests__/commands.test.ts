import { describe, expect, it } from 'vitest'
import { handleCommand } from '../commands'
import { applyEvent } from '../reducer'
import type { GameEvent, NewGameEvent, SaveFile } from '../types'
import { completed, created, granted, saveFrom } from './helpers'

const commit = (save: SaveFile, events: NewGameEvent[]) =>
  events.reduce((state, event, index) => applyEvent(state, { seq: state.seq + 1, key: event.key ?? `k:${state.seq + index}`, at: '2026-02-01T00:00:00.000Z', payload: event.payload } as GameEvent), save)

describe('quest.complete', () => {
  it('records the completion, pays rewards, unlocks the next quest, and earns achievements', () => {
    const save = saveFrom([created(), granted('vip-wristband')])
    const result = handleCommand(save, { type: 'quest.complete', slug: 'cams-gambit', answers: { 'load-cartridge': 'Sun Cartridge' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const types = result.events.map((e) => e.payload.type)
    expect(types).toEqual(expect.arrayContaining(['quest.completed', 'xp.gained', 'trait.changed', 'quest.unlocked', 'achievement.unlocked']))

    const next = commit(save, result.events)
    expect(next.quests['cams-gambit'].completions).toBe(1)
    expect(next.player.xp).toBe(250)
    expect(next.player.traits.chaos).toBe(6)
    expect(next.world.unlockedQuests).toContain('unknown-signal')
    expect(next.player.achievements['first-quest']).toBeDefined()
  })

  it('keys first-completion rewards so they can never be granted twice', () => {
    const save = saveFrom([created()])
    const result = handleCommand(save, { type: 'quest.complete', slug: 'cams-gambit', answers: {} })
    if (!result.ok) throw new Error('expected ok')
    const xp = result.events.find((e) => e.payload.type === 'xp.gained')
    expect(xp?.key).toBe('quest:cams-gambit:xp')
  })

  it('rejects completing a locked or already-complete quest', () => {
    expect(handleCommand(saveFrom([created()]), { type: 'quest.complete', slug: 'unknown-signal', answers: {} })).toMatchObject({ ok: false, rejection: { code: 'locked', missing: { unlock: true, items: ['vip-wristband'], questsCompleted: ['cams-gambit'] } } })
    expect(handleCommand(saveFrom([created(), completed('cams-gambit')]), { type: 'quest.complete', slug: 'cams-gambit', answers: {} })).toMatchObject({ ok: false, rejection: { code: 'already-completed' } })
  })
})

describe('quest.start / quest.progress', () => {
  it('refuses coming-soon and locked quests', () => {
    expect(handleCommand(saveFrom([created()]), { type: 'quest.start', slug: 'unknown-signal' })).toMatchObject({ ok: false })
    expect(handleCommand(saveFrom([created()]), { type: 'quest.progress', slug: 'unknown-signal', step: 1, answers: {}, unlockedSteps: [] })).toMatchObject({ ok: false, rejection: { code: 'locked' } })
  })

  it('starting twice is a no-op, progress is bounds-checked', () => {
    const started = saveFrom([created(), { type: 'quest.started', slug: 'cams-gambit' }])
    expect(handleCommand(started, { type: 'quest.start', slug: 'cams-gambit' })).toEqual({ ok: true, events: [] })
    expect(handleCommand(started, { type: 'quest.progress', slug: 'cams-gambit', step: 99, answers: {}, unlockedSteps: [] })).toMatchObject({ ok: false, rejection: { code: 'bad-step' } })
  })
})

describe('item.consume', () => {
  it('is idempotent by operationId and enforces inventory rules', () => {
    const save = saveFrom([created(), granted('cowbell', 1)])
    const result = handleCommand(save, { type: 'item.consume', itemId: 'cowbell', quantity: 1, reason: 'test', operationId: 'op-1' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.events[0].key).toBe('consume:op-1')
    expect(handleCommand(save, { type: 'item.consume', itemId: 'cowbell', quantity: 2, reason: 'test', operationId: 'op-2' })).toMatchObject({ ok: false, rejection: { code: 'insufficient' } })
    expect(handleCommand(save, { type: 'item.consume', itemId: 'kitanas-blessing', quantity: 1, reason: 'test', operationId: 'op-3' })).toMatchObject({ ok: false, rejection: { code: 'not-consumable' } })
  })
})

describe('grants.accept', () => {
  it('accepts only keys that are actually pending', () => {
    const save = saveFrom([created(), granted('cowbell', 1, 'starter_loadout', 'starter:cowbell')])
    const result = handleCommand(save, { type: 'grants.accept', grantKeys: ['starter:cowbell', 'made-up'] })
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.events[0].payload).toEqual({ type: 'grants.accepted', grantKeys: ['starter:cowbell'] })
    expect(handleCommand(save, { type: 'grants.accept', grantKeys: ['made-up'] })).toEqual({ ok: true, events: [] })
  })
})

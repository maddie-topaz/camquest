'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useGame } from '@/app/game-provider'
import { achievements } from '@/lib/game/content/achievements'
import { items } from '@/lib/game/content/items'
import { quests } from '@/lib/game/content/quests'
import { traits } from '@/lib/game/content/traits'
import { devToolsEnabled } from '@/lib/game/dev/enabled'
import { scenarios } from '@/lib/game/dev/scenarios'
import type { Command, GameEvent } from '@/lib/game/types'
import type { SaveView } from '@/lib/game/view'
import { resettableSystems } from '@/lib/game/types'

// The control room. A debugging frontend over the existing engine: every
// button either dispatches a Command (ENGINE — rule-checked, exactly what
// gameplay does) or posts an admin action (FORCE — raw events, no rules).
// Nothing here holds game state of its own; it renders the save view and
// reads results back from the same provider the game uses.

type Mode = 'engine' | 'force'

// ---------------------------------------------------------------------------
// Plumbing: one hook that runs an action and reports on it
// ---------------------------------------------------------------------------

const useRunner = () => {
  const { dispatch, admin } = useGame()
  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useState<{ at: number; text: string; ok: boolean }[]>([])
  const note = useCallback((text: string, ok: boolean) => setLog((current) => [{ at: Date.now(), text, ok }, ...current].slice(0, 8)), [])
  const run = useCallback(
    async (label: string, work: () => Promise<SaveView>) => {
      setBusy(label)
      try {
        await work()
        note(label, true)
      } catch (error) {
        note(`${label}: ${error instanceof Error ? error.message : 'failed'}`, false)
      } finally {
        setBusy(null)
      }
    },
    [note],
  )
  const engine = useCallback((label: string, command: Command) => run(label, () => dispatch(command)), [dispatch, run])
  const force = useCallback((label: string, body: Record<string, unknown>) => run(label, () => admin(body)), [admin, run])
  return { busy, log, engine, force }
}

type Runner = ReturnType<typeof useRunner>

function Btn({ mode, label, onClick, busy, danger, disabled, title }: { mode: Mode; label: string; onClick: () => void; busy: string | null; danger?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className={`dev-btn is-${mode} ${danger ? 'is-danger' : ''}`} onClick={onClick} disabled={disabled || busy === label} title={title ?? (mode === 'engine' ? 'Engine: rule-checked command' : 'Force: raw event, bypasses rules')}>
      <span className="dev-badge">{mode === 'engine' ? 'ENGINE' : 'FORCE'}</span>{busy === label ? '…' : label}
    </button>
  )
}

function Section({ id, title, blurb, children }: { id: string; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="dev-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="dev-section-head"><h2 id={`${id}-title`}>{title}</h2><p>{blurb}</p></div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function PlayerSection({ view, r }: { view: SaveView; r: Runner }) {
  const [name, setName] = useState(view.save.player.name)
  const [xp, setXp] = useState('100')
  useEffect(() => setName(view.save.player.name), [view.save.player.name])
  return (
    <Section id="player" title="Player" blurb="Profile, XP and traits. Traits are clamped to their defined range by the reducer.">
      <div className="dev-grid">
        <div className="dev-row">
          <label>Name <input className="dev-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <Btn mode="force" label="Rename" busy={r.busy} onClick={() => r.force('Rename', { action: 'rename', name })} />
        </div>
        <div className="dev-row">
          <span>Level {view.level.level} · {view.save.player.xp} XP ({view.level.xp - view.level.floor}/{view.level.ceiling - view.level.floor} to next)</span>
          <label>Δ XP <input className="dev-input is-short" value={xp} onChange={(e) => setXp(e.target.value)} /></label>
          <Btn mode="force" label="Add XP" busy={r.busy} onClick={() => r.force('Add XP', { action: 'xp', amount: Number(xp) })} />
        </div>
        {traits.map((trait) => {
          const value = view.save.player.traits[trait.id] ?? trait.initial
          return (
            <div className="dev-row" key={trait.id}>
              <span title={trait.description}>{trait.name} <strong>{value}</strong> <small>/{trait.max}</small></span>
              <Btn mode="force" label={`${trait.name} −1`} busy={r.busy} onClick={() => r.force(`${trait.name} −1`, { action: 'trait', trait: trait.id, delta: -1 })} disabled={value <= trait.min} />
              <Btn mode="force" label={`${trait.name} +1`} busy={r.busy} onClick={() => r.force(`${trait.name} +1`, { action: 'trait', trait: trait.id, delta: 1 })} disabled={value >= trait.max} />
              <Btn mode="force" label={`${trait.name} reset`} busy={r.busy} onClick={() => r.force(`${trait.name} reset`, { action: 'set-trait', trait: trait.id, value: trait.initial })} disabled={value === trait.initial} />
            </div>
          )
        })}
        <div className="dev-row dev-wrap">
          <span>Achievements</span>
          {achievements.map((a) => {
            const on = Boolean(view.save.player.achievements[a.id])
            return <Btn key={a.id} mode="force" label={`${on ? '✓' : '○'} ${a.name}`} busy={r.busy} title={a.description} onClick={() => r.force(`${on ? 'Revoke' : 'Unlock'} ${a.name}`, { action: 'achievement', achievementId: a.id, unlocked: !on })} />
          })}
        </div>
      </div>
    </Section>
  )
}

function InventorySection({ view, r }: { view: SaveView; r: Runner }) {
  const pendingKeys = view.pendingGrants.map((g) => g.key)
  return (
    <Section id="inventory" title="Inventory" blurb="Grant and remove are raw; Consume goes through the engine and respects the consumable rule. Accept is the same command the START reveal sends.">
      <div className="dev-grid">
        <div className="dev-row">
          <span>{view.pendingGrants.length} grant{view.pendingGrants.length === 1 ? '' : 's'} pending accept</span>
          <Btn mode="engine" label="Accept all pending" busy={r.busy} onClick={() => r.engine('Accept all pending', { type: 'grants.accept', grantKeys: pendingKeys })} disabled={!pendingKeys.length} />
          <Btn mode="force" label="Re-arm reveal" busy={r.busy} onClick={() => r.force('Re-arm reveal', { action: 'rearm' })} />
        </div>
        {items.map((item) => {
          const qty = view.save.player.inventory[item.id]?.quantity ?? 0
          const pending = view.pendingGrants.filter((g) => g.itemId === item.id).length
          return (
            <div className="dev-row" key={item.id}>
              <span><code>{item.id}</code> <strong>×{qty}</strong>{pending ? <small> ({pending} pending)</small> : null}{item.consumable ? <small> consumable</small> : null}</span>
              <Btn mode="force" label={`Grant ${item.id}`} busy={r.busy} onClick={() => r.force(`Grant ${item.id}`, { action: 'grant', itemId: item.id, quantity: 1, reason: 'dev' })} />
              <Btn mode="force" label={`Remove ${item.id}`} busy={r.busy} onClick={() => r.force(`Remove ${item.id}`, { action: 'remove-item', itemId: item.id, quantity: 1 })} disabled={qty === 0} />
              <Btn mode="engine" label={`Consume ${item.id}`} busy={r.busy} onClick={() => r.engine(`Consume ${item.id}`, { type: 'item.consume', itemId: item.id, quantity: 1, reason: 'dev', operationId: crypto.randomUUID() })} disabled={!item.consumable || qty === 0} />
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function QuestsSection({ view, r }: { view: SaveView; r: Runner }) {
  const [jump, setJump] = useState<Record<string, number>>({})
  return (
    <Section id="quests" title="Quests" blurb="Start and Complete are the real commands (Complete pays rewards, needs requirements met). Everything else forces the save: jumping to a step unlocks the passcodes before it.">
      {quests.map((quest) => {
        const state = view.quests[quest.slug]
        const saved = view.save.quests[quest.slug]
        const target = jump[quest.slug] ?? saved?.step ?? 0
        const passcodes = [
          ...(quest.startPasscode ? [{ id: 'start', label: 'Start', code: quest.startPasscode }] : []),
          ...quest.steps.flatMap((s, i) => (s.passcode ? [{ id: s.id, label: `Round ${i + 1}`, code: s.passcode }] : [])),
        ]
        return (
          <div className="dev-quest" key={quest.slug}>
            <div className="dev-row">
              <span><strong>{quest.title}</strong> <code>{quest.slug}</code> <em className={`status-pill is-${state?.status}`}>{state?.status ?? '…'}</em>{quest.status === 'coming-soon' && <small> (coming-soon flag)</small>}</span>
              {state && Object.keys(state.missing).length > 0 && <small>missing {JSON.stringify(state.missing)}</small>}
              <small>{saved ? `step ${saved.step + 1}/${quest.steps.length} · ${Object.keys(saved.answers).length} answers · ${saved.completions} completion${saved.completions === 1 ? '' : 's'}` : 'no progress'}</small>
            </div>
            <div className="dev-row dev-wrap">
              <Btn mode="engine" label={`Start ${quest.slug}`} busy={r.busy} onClick={() => r.engine(`Start ${quest.slug}`, { type: 'quest.start', slug: quest.slug })} />
              <Btn mode="engine" label={`Complete ${quest.slug} (rewards)`} busy={r.busy} onClick={() => r.engine(`Complete ${quest.slug} (rewards)`, { type: 'quest.complete', slug: quest.slug, answers: saved?.answers ?? {} })} />
              <Btn mode="force" label={`Mark ${quest.slug} complete`} busy={r.busy} title="quest.completed with no rewards" onClick={() => r.force(`Mark ${quest.slug} complete`, { action: 'mark-complete', slug: quest.slug })} />
              {view.save.world.unlockedQuests.includes(quest.slug)
                ? <Btn mode="force" label={`Relock ${quest.slug}`} busy={r.busy} onClick={() => r.force(`Relock ${quest.slug}`, { action: 'relock-quest', slug: quest.slug })} />
                : <Btn mode="force" label={`Unlock ${quest.slug}`} busy={r.busy} onClick={() => r.force(`Unlock ${quest.slug}`, { action: 'unlock-quest', slug: quest.slug })} />}
              <Btn mode="force" label={`Reset ${quest.slug}`} busy={r.busy} danger onClick={() => r.force(`Reset ${quest.slug}`, { action: 'reset-quest', slug: quest.slug })} />
            </div>
            {quest.steps.length > 0 && (
              <div className="dev-row dev-wrap">
                <label>Jump to
                  <select className="dev-select" value={target} onChange={(e) => setJump((c) => ({ ...c, [quest.slug]: Number(e.target.value) }))}>
                    {quest.steps.map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.title} ({s.type}{s.passcode ? ', passcode' : ''})</option>)}
                  </select>
                </label>
                <Btn mode="force" label={`Jump ${quest.slug}`} busy={r.busy} onClick={() => r.force(`Jump ${quest.slug}`, { action: 'jump-quest', slug: quest.slug, step: target })} />
                {quest.steps.map((s) => {
                  const done = Boolean(saved?.answers[s.id]) || Boolean(saved?.unlockedSteps.includes(s.id))
                  return <Btn key={s.id} mode="force" label={`Reset step ${s.id}`} busy={r.busy} onClick={() => r.force(`Reset step ${s.id}`, { action: 'reset-step', slug: quest.slug, stepId: s.id })} disabled={!done} />
                })}
              </div>
            )}
            {passcodes.length > 0 && (
              <div className="dev-row dev-wrap dev-passcodes">
                {passcodes.map((p) => <span key={p.id}><small>{p.label}</small> <code className="passcode-value">{p.code}</code></span>)}
              </div>
            )}
          </div>
        )
      })}
    </Section>
  )
}

function WorldSection({ view, r }: { view: SaveView; r: Runner }) {
  const [location, setLocation] = useState('')
  const [secret, setSecret] = useState('')
  const flagList = (kind: 'location' | 'secret', ids: string[], draft: string, setDraft: (v: string) => void) => (
    <div className="dev-row dev-wrap">
      <span>{kind === 'location' ? 'Discovered locations' : 'Secrets'} ({ids.length})</span>
      {ids.map((id) => <Btn key={id} mode="force" label={`✕ ${id}`} busy={r.busy} onClick={() => r.force(`Forget ${kind} ${id}`, { action: 'flag', kind, id, on: false })} />)}
      <input className="dev-input" placeholder={`new ${kind} id`} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Btn mode="force" label={`Add ${kind}`} busy={r.busy} onClick={() => { r.force(`Add ${kind} ${draft}`, { action: 'flag', kind, id: draft, on: true }); setDraft('') }} disabled={!draft.trim()} />
    </div>
  )
  return (
    <Section id="world" title="World flags" blurb="Quest unlocks only matter for quests whose requirements include `unlock: true`. Locations and secrets are free-form ids until content defines them.">
      <div className="dev-grid">
        <div className="dev-row dev-wrap">
          <span>Unlocked quests</span>
          {quests.map((q) => {
            const on = view.save.world.unlockedQuests.includes(q.slug)
            return <Btn key={q.slug} mode="force" label={`${on ? '✓' : '○'} ${q.slug}`} busy={r.busy} onClick={() => r.force(`${on ? 'Relock' : 'Unlock'} ${q.slug}`, { action: on ? 'relock-quest' : 'unlock-quest', slug: q.slug })} />
          })}
        </div>
        {flagList('location', view.save.world.discoveredLocations, location, setLocation)}
        {flagList('secret', view.save.world.secrets, secret, setSecret)}
      </div>
    </Section>
  )
}

function ScenariosSection({ r }: { r: Runner }) {
  const [slug, setSlug] = useState(quests[0]?.slug ?? '')
  const [step, setStep] = useState(0)
  const quest = quests.find((q) => q.slug === slug)
  const load = (id: string, name: string) => {
    if (!window.confirm(`Load "${name}"? This wipes the current save.`)) return
    void r.force(`Scenario: ${name}`, { action: 'scenario', id, params: { slug, step } })
  }
  return (
    <Section id="scenarios" title="Scenarios" blurb="Known states, each built from a wiped save: bootstrap, then the recipe's events. Every load replaces the current save.">
      <div className="dev-grid">
        <div className="dev-row">
          <label>Quest <select className="dev-select" value={slug} onChange={(e) => { setSlug(e.target.value); setStep(0) }}>{quests.map((q) => <option key={q.slug} value={q.slug}>{q.title}</option>)}</select></label>
          <label>Step <select className="dev-select" value={step} onChange={(e) => setStep(Number(e.target.value))}>{(quest?.steps ?? []).map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.title}</option>)}</select></label>
        </div>
        {scenarios.map((s) => (
          <div className="dev-row" key={s.id}>
            <span><strong>{s.name}</strong> <small>{s.description}</small></span>
            <Btn mode="force" label={`Load ${s.name}`} busy={r.busy} danger onClick={() => load(s.id, s.name)} />
          </div>
        ))}
      </div>
    </Section>
  )
}

function SaveStateSection({ view }: { view: SaveView }) {
  const [events, setEvents] = useState<GameEvent[] | null>(null)
  const refresh = useCallback(() => {
    fetch('/api/game/admin?limit=60').then((res) => res.json()).then((data) => setEvents(data.events ?? [])).catch(() => setEvents([]))
  }, [])
  useEffect(() => { refresh() }, [refresh, view.save.seq])
  const raw = useMemo(() => JSON.stringify(view.save, null, 2), [view.save])
  return (
    <Section id="save" title="Save state" blurb="The raw save file (a fold over the event log) and the most recent events, newest first.">
      <details className="dev-details" open>
        <summary>Raw save · seq {view.save.seq} · updated {new Date(view.save.updatedAt).toLocaleString()}</summary>
        <pre className="dev-pre">{raw}</pre>
      </details>
      <details className="dev-details">
        <summary>Event log <button type="button" className="dev-link" onClick={(e) => { e.preventDefault(); refresh() }}><RefreshCw /> refresh</button></summary>
        <table className="dev-table">
          <tbody>
            {(events ?? []).map((event) => {
              const { type, ...rest } = event.payload
              return <tr key={event.seq}><td>{event.seq}</td><td>{event.at.slice(11, 19)}</td><td><code>{type}</code></td><td><small>{JSON.stringify(rest)}</small></td><td><small>{event.key}</small></td></tr>
            })}
          </tbody>
        </table>
      </details>
    </Section>
  )
}

function ResetSection({ r }: { r: Runner }) {
  const [confirm, setConfirm] = useState('')
  return (
    <Section id="reset" title="Reset" blurb="Per-system resets append a system.reset event (auditable, replayable). Wipe deletes the whole log and bootstraps a fresh player: the one operation that isn't append-only.">
      <div className="dev-grid">
        <div className="dev-row dev-wrap">
          {resettableSystems.map((system) => <Btn key={system} mode="force" label={`Reset ${system}`} busy={r.busy} danger onClick={() => r.force(`Reset ${system}`, { action: 'reset-system', system })} />)}
        </div>
        <div className="dev-row">
          <label>Type <code>wipe</code> to enable <input className="dev-input is-short" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <Btn mode="force" label="Wipe save" busy={r.busy} danger disabled={confirm !== 'wipe'} onClick={() => { setConfirm(''); void r.force('Wipe save', { action: 'wipe' }) }} />
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------

const sections = ['player', 'inventory', 'quests', 'world', 'scenarios', 'save', 'reset']

export function DevTools() {
  const { view, error } = useGame()
  const r = useRunner()

  if (!devToolsEnabled) {
    return <main className="dev-page"><h1>Developer tools</h1><p>Not available in this build. Set <code>NEXT_PUBLIC_CAMQUEST_DEV_TOOLS=1</code> to enable.</p></main>
  }

  return (
    <main className="dev-page">
      <header className="dev-header">
        <Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link>
        <p className="eyebrow">Control room</p>
        <h1>Developer tools</h1>
        <p className="dev-legend"><span className="dev-badge is-engine">ENGINE</span> rule-checked command, exactly what gameplay does &nbsp; <span className="dev-badge is-force">FORCE</span> raw event appended to the log, bypasses rules</p>
        <nav className="dev-nav">{sections.map((id) => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
        {r.log.length > 0 && <ul className="dev-log" aria-live="polite">{r.log.map((entry) => <li key={entry.at} className={entry.ok ? 'is-ok' : 'is-error'}>{entry.ok ? '✓' : '✗'} {entry.text}</li>)}</ul>}
      </header>
      {error ? <p className="dev-error">Save failed to load: {error instanceof Error ? error.message : String(error)}</p> : null}
      {!view ? <p>Loading save…</p> : (
        <>
          <PlayerSection view={view} r={r} />
          <InventorySection view={view} r={r} />
          <QuestsSection view={view} r={r} />
          <WorldSection view={view} r={r} />
          <ScenariosSection r={r} />
          <SaveStateSection view={view} />
          <ResetSection r={r} />
        </>
      )}
    </main>
  )
}

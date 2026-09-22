'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Archive as ArchiveIcon, ArrowLeft, ArrowRight, Backpack, Beef, Bell, BookOpen, Cat, Check, CircleDot, Dice5, Gamepad2, Joystick, Link as LinkIcon, Lock, Martini, Moon, Origami, Palmtree, Sparkles, Sun, Ticket, Trophy, UserRound, Zap, type LucideIcon } from 'lucide-react'
import { quests, getQuest, type QuestDefinition, type ChallengeStep } from '@/lib/game/content/quests'
import { GameProvider, useGame } from '@/app/game-provider'
import { CommandRejectedError, type QuestView } from '@/lib/game/client'
import { useActorRef, useSelector } from '@xstate/react'
import { questMachine, questSelectors, START_UNLOCK_ID } from '@/lib/game/machines/quest'
import { startMachine, startSelectors } from '@/lib/game/machines/start'
import { EncounterStage } from '@/app/encounter-stage'
import { AudioProvider, AudioToggle } from '@/app/audio-provider'
import { DevTools } from '@/app/dev-tools'
import { emitCue } from '@/lib/game/audio/bus'
import { getEncounter, type EncounterResult } from '@/lib/game/content/encounters'
import { traits as traitDefinitions } from '@/lib/game/content/traits'
import type { Requirements } from '@/lib/game/types'

const choiceIcons: Record<string, LucideIcon> = { Sun, Moon, CircleDot, Joystick, Origami, Sparkles, Link: LinkIcon, Dice5, Martini, Palmtree }
const inventoryIcons: Record<string, LucideIcon> = { Ticket, Bell, Cat, Beef, Sparkles }
const achievementIcons: Record<string, LucideIcon> = { Trophy, Cat, Backpack, Zap, Sparkles }

// Every sound in the game is a cue on the sound bus; the audio layer
// (app/audio-provider) is the only thing that turns cues into audio.
const emitGameSoundCue = emitCue

function Shell({ children, minimal = false }: { children: React.ReactNode; minimal?: boolean }) { return <div className="min-h-screen bg-[#0d0b1b] text-[#f7f0ff]"><div className="stars" /><AudioToggle />{!minimal && <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6" aria-label="Site header" />}{children}</div> }
// Turns a missing-requirements object into copy for a locked quest card.
function describeRequirements(missing: Requirements) {
  const parts: string[] = []
  if (missing.unlock) parts.push('a signal you haven\'t found yet')
  for (const slug of missing.questsCompleted ?? []) parts.push(`completing ${getQuest(slug)?.title ?? slug}`)
  for (const itemId of missing.items ?? []) parts.push(`holding the ${itemId.replace(/-/g, ' ')}`)
  for (const [trait, min] of Object.entries(missing.traits ?? {})) parts.push(`${traitDefinitions.find((t) => t.id === trait)?.name ?? trait} ${min}+`)
  if (missing.level) parts.push(`level ${missing.level}`)
  for (const id of missing.achievements ?? []) parts.push(`the ${id.replace(/-/g, ' ')} achievement`)
  return parts.length ? `Requires ${parts.join(', ')}.` : 'Locked.'
}

function Portal() {
  const navigate = useNavigate()
  const game = useGame()
  const acceptButton = useRef<HTMLButtonElement>(null)

  // The reveal ceremony is a state machine (lib/game/machines/start);
  // this component only renders its state and forwards its emitted sound
  // cues and the final "enter" to the outside world.
  const actor = useActorRef(startMachine, {
    input: {
      load: game.load,
      accept: (grantKeys) => game.dispatch({ type: 'grants.accept', grantKeys }),
    },
  })
  const phase = useSelector(actor, (snapshot) =>
    snapshot.matches('idle') ? 'idle'
      : snapshot.matches('booting') || snapshot.matches('deciding') ? 'transition'
      : snapshot.matches('revealing') ? 'revealing'
      : snapshot.matches('ready') ? 'ready'
      : snapshot.matches('accepting') ? 'accepting'
      : snapshot.matches('error') ? 'error'
      : 'leaving')
  const pendingItems = useSelector(actor, (snapshot) => snapshot.context.items)
  const isFirstGrant = startSelectors.isFirstGrant(pendingItems)

  useEffect(() => {
    const cues = actor.on('cue', (event) => emitGameSoundCue(event.cue, event.detail))
    const enter = actor.on('enter', () => navigate('/quest-log'))
    return () => { cues.unsubscribe(); enter.unsubscribe() }
  }, [actor, navigate])

  useEffect(() => {
    if (phase !== 'revealing') return
    // Per-card flourishes, timed to the CSS reveal.
    const timers = pendingItems.map((item, index) => window.setTimeout(() => emitGameSoundCue('item-acquired', { itemId: item.itemId, index }), 900 + index * 650))
    return () => timers.forEach(window.clearTimeout)
  }, [phase, pendingItems])

  useEffect(() => {
    if (phase === 'ready') acceptButton.current?.focus()
  }, [phase])

  const startGame = () => actor.send({ type: 'START' })
  const acceptItems = () => actor.send({ type: 'ACCEPT' })

  return <Shell minimal><main className={`arcade-home ${phase !== 'idle' ? 'is-starting' : ''}`} data-start-phase={phase}><section className="portal-hero"><div className="arcade-machine" aria-label="Camquest arcade machine"><button type="button" className="arcade-screen" onClick={startGame} aria-label="Start Camquest"><span className="screen-scanlines" aria-hidden="true" /><span className="pixel-sprite sprite-heart" aria-hidden="true">♥</span><span className="screen-stars">✦  ·  ✦  ·  ✦</span><strong>CAM⚡QUEST</strong><span className="screen-subtitle">READY UP. ADVENTURE CALLS.</span><span className="screen-prompt">[ START GAME ]</span></button><div className="arcade-controls" aria-label="Two-player arcade controls"><div className="player-controls" aria-label="Player one buttons"><div className="arcade-buttons"><button type="button" aria-label="Player one pink button"><span /></button><button type="button" aria-label="Player one gold button"><span /></button></div></div><div className="player-controls player-two" aria-label="Player two buttons"><div className="arcade-buttons"><button type="button" aria-label="Player two cyan button"><span /></button><button type="button" aria-label="Player two violet button"><span /></button></div></div></div></div></section>
    {phase !== 'idle' && <div className={`inventory-reveal-overlay phase-${phase}`} role="dialog" aria-modal="true" aria-label="Starting inventory" data-sfx="inventory-sequence">
      <span className="reveal-scanlines" aria-hidden="true" />
      {phase === 'transition' && <div className="inventory-boot" role="status" aria-live="polite"><span className="boot-rune">✦</span><p>Initialising player inventory...</p><div><i /><i /><i /><i /><i /><i /><i /><i /></div><small>Synchronising field pack // Player 02</small></div>}
      {phase === 'error' && <div className="inventory-boot inventory-boot-error"><span className="boot-rune">!</span><p>Inventory signal lost</p><small>The field pack could not be synchronised.</small><button className="portal-button" onClick={() => actor.send({ type: 'RETRY' })}>Retry link</button></div>}
      {(phase === 'revealing' || phase === 'ready' || phase === 'accepting' || phase === 'leaving') && <section className="starter-inventory-panel">
        <span className="fantasy-corner corner-one" aria-hidden="true">✦</span><span className="fantasy-corner corner-two" aria-hidden="true">✦</span>
        <div className="starter-heading">
          <p>{isFirstGrant ? 'System grant // New player cache' : 'Incoming transfer // Field pack update'}</p>
          <h1 id="inventory-reveal-title">{isFirstGrant ? 'Starting inventory loaded' : 'New items received'}</h1>
          <span>{isFirstGrant ? 'These objects are now bound to Player 02.' : 'Someone left these for Player 02.'}</span>
        </div>
        <div className="starter-pack-rail"><Backpack aria-hidden="true" /><span>Field pack</span><small>{pendingItems.length} {pendingItems.length === 1 ? 'object' : 'objects'} received</small></div>
        <div className="starter-item-grid">
          {pendingItems.map((item, index) => {
            const Icon = inventoryIcons[item.icon] || Sparkles
            return <article className="starter-item" key={item.itemId} style={{ '--reveal-delay': `${.8 + index * .65}s`, '--item-color': item.color, '--item-tilt': item.tilt } as React.CSSProperties} data-sfx="item-acquired">
              <div className="starter-item-object"><span className="item-burst" aria-hidden="true" /><Icon aria-hidden="true" /><b>×{item.quantity}</b></div>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
            </article>
          })}
        </div>
        <button ref={acceptButton} className="accept-items-button" disabled={phase !== 'ready'} onClick={acceptItems} data-sfx="inventory-accepted">
          {phase === 'ready' ? 'Accept items' : phase === 'accepting' ? 'Binding items...' : 'Loading items...'} <ArrowRight aria-hidden="true" />
        </button>
      </section>}
    </div>}
  </main></Shell>
}
const lobbyDestinations = [
  { to: '/quest-log', icon: Gamepad2, title: 'Quest log', description: "See your current quests.", linkLabel: 'Enter quest log' },
  { to: '/archive', icon: ArchiveIcon, title: 'Archive', description: "See completed quests.", linkLabel: 'Open archive' },
  { to: '/profile', icon: UserRound, title: 'Player profile', description: 'Check your stats and collected loot.', linkLabel: 'View player profile' },
]
function Lobby() { return <Shell><main className="relative z-10 mx-auto max-w-6xl px-5 pb-16"><div className="page-title"><p className="eyebrow">Cam⚡Quest</p><h1>Game lobby</h1></div><div className="quest-grid">{lobbyDestinations.map((dest) => { const Icon = dest.icon; return <Link key={dest.to} className="quest-card" to={dest.to}><div className="card-top"><span className="quest-symbol"><Icon aria-hidden="true" /></span></div><h3>{dest.title}</h3><p>{dest.description}</p><span className="card-link">{dest.linkLabel} <ArrowRight /></span></Link> })}</div></main></Shell> }
function QuestLog() { const { view } = useGame(); return <Shell><main className="relative z-10 mx-auto max-w-6xl px-5 pb-16"><Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link><div className="page-title"><p className="eyebrow">Cam⚡Quest</p><h1>Quest log</h1></div><div className="quest-grid">{quests.map((quest) => <QuestCard key={quest.id} quest={quest} questView={view?.quests[quest.slug]} />)}</div></main></Shell> }
function QuestCard({ quest, questView }: { quest: QuestDefinition; questView?: QuestView }) {
  // Status comes from the save via the rules engine; 'coming-soon' is the
  // one authoring flag that overrides it.
  const comingSoon = quest.status === 'coming-soon'
  const status = questView?.status ?? 'available'
  const locked = comingSoon || status === 'locked'
  const completed = status === 'completed'
  const pill = completed ? 'Completed' : status === 'locked' ? 'Locked' : comingSoon ? 'Coming soon' : status === 'in-progress' ? 'In progress' : 'Available'
  return (
    <article className={`quest-card ${locked ? 'is-locked' : ''}`}>
      <div className="card-top">
        <span className="quest-symbol">{locked ? <Lock aria-hidden="true" /> : quest.symbol}</span>
        <span className="status-pill">{pill}</span>
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.description}</p>
      {status === 'locked' && questView ? (
        <span className="card-link muted">{describeRequirements(questView.missing)}</span>
      ) : comingSoon ? (
        <span className="card-link muted">Still being written</span>
      ) : completed ? (
        <Link className="card-link" to={`/quest/${quest.slug}/complete`}>View result <ArrowRight /></Link>
      ) : (
        <Link className="card-link" to={`/quest/${quest.slug}`}>{status === 'in-progress' ? 'Continue quest' : 'Start quest'} <ArrowRight /></Link>
      )}
    </article>
  )
}
function Archive() {
  const { view } = useGame()
  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-16">
        <Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link>
        <div className="page-title">
          <p className="eyebrow">The archive</p>
          <h1>Completed quests</h1>
        </div>
        <div className="archive-list">
          {quests.map((a) => {
            const questView = view?.quests[a.slug]
            const completed = questView?.status === 'completed'
            const completedDate = questView?.completedAt && new Date(questView.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
            return (
              <div className="archive-row" key={a.id}>
                <span className="archive-symbol">{a.symbol}</span>
                <div className="archive-row-body">
                  <h2>{a.title}</h2>
                  <div className="archive-row-meta">
                    <p>{completed ? (completedDate ? `Completed ${completedDate}` : 'Completed') : a.status === 'coming-soon' ? 'The ink is still drying.' : 'Waiting to be discovered.'}</p>
                    {completed && (
                      <Link className="card-link" to={`/quest/${a.slug}/complete`}>
                        View result <Check className="text-[#f0b8d2]" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </Shell>
  )
}
function Profile() {
  const { view, error } = useGame()
  const save = view?.save
  const questStates = view ? Object.values(view.quests) : []
  const totalQuests = quests.length
  const clearedQuests = questStates.filter((state) => state.status === 'completed').length
  const availableQuests = quests.filter((quest) => quest.status !== 'coming-soon').length
  const decisionsMade = save ? Object.values(save.quests).reduce((total, quest) => total + Object.keys(quest.answers).length, 0) : 0
  const checkpointsFound = save ? Object.values(save.quests).reduce((total, quest) => total + quest.unlockedSteps.filter((step) => step !== startUnlockId).length, 0) : 0
  const completionRate = availableQuests ? Math.round((clearedQuests / availableQuests) * 100) : 0
  const level = view?.level ?? { level: 1, xp: 0, floor: 0, ceiling: 100, fraction: 0 }
  const playerName = save?.player.name || 'Player Two'
  const inventory = view?.inventory ?? null
  const inventoryError = Boolean(error)

  // Achievements are defined in lib/game/content/achievements and unlocked
  // by the rules engine; the profile only renders them.
  const achievements = (view?.achievements ?? []).map((achievement) => ({
    id: achievement.id,
    name: achievement.name,
    detail: achievement.description,
    icon: achievementIcons[achievement.icon] || Trophy,
    unlocked: Boolean(achievement.unlockedAt),
  }))
  const traitRows = traitDefinitions.map((trait) => ({ ...trait, value: save?.player.traits[trait.id] ?? trait.initial }))
  const unlockedItems = inventory?.filter((item) => item.quantity > 0).length || 0
  const unlockedAchievements = achievements.filter((item) => item.unlocked).length
  const latestClear = questStates.map((state) => state.completedAt).filter(Boolean).sort().at(-1)

  return (
    <Shell>
      <main className="profile-page relative z-10 mx-auto max-w-6xl px-5 pb-20">
        <Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link>
        <section className="profile-hero">
          <div className="player-avatar" aria-hidden="true"><span>C</span><i /></div>
          <div className="player-identity">
            <p className="eyebrow">Player profile // Slot 02</p>
            <h1>{playerName}</h1>
            <p><span className="online-dot" /> Ready for quest</p>
          </div>
          <div className="player-level">
            <span>Level</span>
            <strong>{String(level.level).padStart(2, '0')}</strong>
            <small>{level.xp - level.floor} / {level.ceiling - level.floor} XP</small>
            <div className="level-meter"><i style={{ width: `${Math.round(level.fraction * 100)}%` }} /></div>
          </div>
        </section>

        <section aria-labelledby="player-stats-title" className="profile-section">
          <div className="profile-section-heading">
            <div><p className="eyebrow">Run data</p><h2 id="player-stats-title">Player stats</h2></div>
            {latestClear && <span>Last clear {new Date(latestClear).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </div>
          <div className="stats-grid">
            <article className="stat-card"><Trophy aria-hidden="true" /><span>Quests cleared</span><strong>{clearedQuests}<small> / {totalQuests}</small></strong></article>
            <article className="stat-card"><Zap aria-hidden="true" /><span>Decisions made</span><strong>{decisionsMade}</strong></article>
            <article className="stat-card"><CircleDot aria-hidden="true" /><span>Checkpoints found</span><strong>{checkpointsFound}</strong></article>
            <article className="stat-card"><Gamepad2 aria-hidden="true" /><span>Completion</span><strong>{completionRate}<small>%</small></strong></article>
          </div>
        </section>

        <section aria-labelledby="traits-title" className="profile-section">
          <div className="profile-section-heading">
            <div><p className="eyebrow">Calibration</p><h2 id="traits-title">Traits</h2></div>
            <span>Shaped by every choice</span>
          </div>
          <div className="trait-list">
            {traitRows.map((trait) => (
              <div className="trait-row" key={trait.id} title={trait.description}>
                <span>{trait.name}</span>
                <div className="trait-meter" role="meter" aria-valuemin={trait.min} aria-valuemax={trait.max} aria-valuenow={trait.value} aria-label={trait.name}><i style={{ width: `${((trait.value - trait.min) / (trait.max - trait.min)) * 100}%` }} /></div>
                <strong>{trait.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="inventory-title" className="profile-section inventory-section">
          <div className="profile-section-heading">
            <div><p className="eyebrow">Collected loot</p><h2 id="inventory-title">Inventory</h2></div>
            <span>{inventory ? `${unlockedItems} / ${inventory.length} items found` : 'Syncing pack…'}</span>
          </div>
          {inventory && <div className="field-pack">
            <div className="field-pack-bar"><span><Backpack aria-hidden="true" /> Field pack</span><small>{inventory.length} slots</small></div>
            <div className="item-grid">
              {inventory.map((item) => {
                const Icon = inventoryIcons[item.icon] || Sparkles
                const unlocked = item.quantity > 0
                return <article
                  className={`item-slot ${unlocked ? 'is-unlocked' : 'is-locked'}`}
                  key={item.id}
                  style={{ '--item-color': item.color, '--item-tilt': item.tilt } as React.CSSProperties}
                >
                  <div className="item-well">
                    {unlocked ? <Icon aria-hidden="true" /> : <span aria-hidden="true">?</span>}
                    {unlocked && <b>×{item.quantity}</b>}
                  </div>
                  <h3>{unlocked ? item.name : 'Unknown object'}</h3>
                  <p>{unlocked ? item.description : item.unlockHint}</p>
                </article>
              })}
            </div>
          </div>}
          {!inventory && !inventoryError && <div className="inventory-sync" role="status"><div className="loading-spinner"><span /><span /><span /><span /></div><p>Syncing field pack…</p></div>}
          {inventoryError && <div className="inventory-sync is-error"><Backpack aria-hidden="true" /><p>Field pack connection lost.</p></div>}
        </section>

        <section aria-labelledby="achievements-title" className="profile-section achievements-section">
          <div className="profile-section-heading">
            <div><p className="eyebrow">Milestones</p><h2 id="achievements-title">Achievements</h2></div>
            <span>{unlockedAchievements} / {achievements.length} unlocked</span>
          </div>
          <div className="inventory-grid achievements-grid">
            {achievements.map((item) => {
              const Icon = item.icon
              return <article className={`inventory-slot achievement-card ${item.unlocked ? 'is-unlocked' : 'is-locked'}`} key={item.id}>
                <div className="inventory-icon"><Icon aria-hidden="true" /></div>
                <div><h3>{item.name}</h3><p>{item.detail}</p></div>
                <span>{item.unlocked ? 'Unlocked' : 'Locked'}</span>
              </article>
            })}
          </div>
        </section>
      </main>
    </Shell>
  )
}
const startUnlockId = START_UNLOCK_ID
function Intro({ quest }: { quest: QuestDefinition }) {
  const navigate = useNavigate()
  const { view, dispatch } = useGame()
  const paragraphs = (quest.introduction || '').split('\n\n')
  const [startPasscodeInput, setStartPasscodeInput] = useState('')
  const [startPasscodeError, setStartPasscodeError] = useState(false)
  const saved = view?.save.quests[quest.slug]
  const startUnlocked = !quest.startPasscode || Boolean(saved?.unlockedSteps.includes(startUnlockId))

  const unlockStart = async () => {
    const target = quest.startPasscode?.trim().toUpperCase()
    if (target && startPasscodeInput.trim().toUpperCase() === target) {
      setStartPasscodeError(false)
      emitGameSoundCue('checkpoint-unlocked')
      try {
        await dispatch({ type: 'quest.start', slug: quest.slug })
        await dispatch({ type: 'quest.progress', slug: quest.slug, step: saved?.step ?? 0, answers: saved?.answers ?? {}, unlockedSteps: [...(saved?.unlockedSteps ?? []), startUnlockId] })
      } catch (error) {
        console.error('Failed to unlock quest start', error)
        setStartPasscodeError(true)
      }
    } else {
      setStartPasscodeError(true)
      emitGameSoundCue('checkpoint-denied')
    }
  }

  return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link><div className="intro-panel transmission-panel">
    <span className="big-symbol transmission-line" style={{ animationDelay: '.1s' }}>{quest.symbol}</span>
    <p className="eyebrow transmission-line" style={{ animationDelay: '.25s' }}>A mysterious challenger has appeared...</p>
    <h1 className="transmission-line" style={{ animationDelay: '.4s' }}>{quest.title}</h1>
    {quest.subtitle && <p className="intro-subtitle transmission-line" style={{ animationDelay: '.55s' }}>{quest.subtitle}</p>}
    <div className="story-text transmission-line" style={{ animationDelay: '.7s' }}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {startUnlocked ? (
      <button className="portal-button transmission-line" style={{ animationDelay: '1s' }} onClick={() => navigate(`/quest/${quest.slug}/play`)}>{quest.ctaLabel || 'Begin quest'} <ArrowRight /></button>
    ) : (
      <div className="riddle-box passcode-gate transmission-line" style={{ animationDelay: '1s' }}>
        <p className="eyebrow">Checkpoint synchronization required</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void unlockStart()
          }}
        >
          <input
            id="start-passcode"
            aria-label="Passcode"
            value={startPasscodeInput}
            onChange={(e) => {
              setStartPasscodeInput(e.target.value)
              setStartPasscodeError(false)
            }}
            placeholder="Enter code"
            autoComplete="off"
          />
          {startPasscodeError && <p className="passcode-error">That code doesn't match. Try again.</p>}
          <button type="submit" className="portal-button mt-4">Sync <ArrowRight /></button>
        </form>
      </div>
    )}
  </div></main></Shell>
}
function Challenge({ quest }: { quest: QuestDefinition }) {
  const { view } = useGame()
  if (!view) return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><div className="inventory-sync" role="status"><div className="loading-spinner"><span /><span /><span /><span /></div><p>Loading save…</p></div></main></Shell>
  // Keyed on the slug so switching quests starts a fresh machine.
  return <ChallengeRun key={quest.slug} quest={quest} view={view} />
}

function ChallengeRun({ quest, view }: { quest: QuestDefinition; view: NonNullable<ReturnType<typeof useGame>['view']> }) {
  const navigate = useNavigate()
  const { dispatch } = useGame()

  // Quest play is a state machine (lib/game/machines/quest). It owns which
  // step we're on and what's answered; this component renders it and
  // turns its emitted `progress` / `complete` events into commands.
  const actor = useActorRef(questMachine, {
    input: {
      quest: quest,
      save: view.save,
      saved: view.save.quests[quest.slug],
      completed: view.quests[quest.slug]?.status === 'completed',
    },
  })
  const snapshot = useSelector(actor, (state) => state)
  const { stepIndex, answer, passcodeInput, passcodeError, missing } = snapshot.context
  const step = questSelectors.step(snapshot)

  useEffect(() => {
    void dispatch({ type: 'quest.start', slug: quest.slug }).catch((error) => console.error('Failed to start quest', error))
    const progress = actor.on('progress', (event) => {
      void dispatch({ type: 'quest.progress', slug: quest.slug, ...event.progress })
        .catch((error) => console.error('Failed to save quest progress', error))
    })
    const cues = actor.on('cue', (event) => emitGameSoundCue(event.cue, event.detail))
    const complete = actor.on('complete', (event) => {
      // The engine records the completion, pays out rewards, and unlocks
      // whatever this quest unlocks, all in one transaction.
      dispatch({ type: 'quest.complete', slug: quest.slug, answers: event.answers })
        .then(() => actor.send({ type: 'COMPLETED' }))
        .catch((error) => {
          if (error instanceof CommandRejectedError) console.warn('Completion not recorded:', error.rejection.message)
          else console.error('Failed to save quest completion', error)
          actor.send({ type: 'COMPLETION_FAILED' })
        })
      navigate(`/quest/${quest.slug}/complete`)
    })
    return () => { progress.unsubscribe(); cues.unsubscribe(); complete.unsubscribe() }
  }, [actor, quest.slug, dispatch, navigate])

  if (snapshot.matches('locked')) {
    return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><Link to="/quest-log" className="back-link"><ArrowLeft /> Back to quest log</Link><div className="challenge-panel"><p className="eyebrow">Signal locked</p><h1>{quest.title}</h1><p className="challenge-prompt">{describeRequirements(missing)}</p></div></main></Shell>
  }
  if (!step) return null

  // The mini-game reported back: record it (rewards are paid server-side)
  // then let the machine turn the step over.
  const onEncounterResult = useCallback((result: EncounterResult) => {
    if (step?.type !== 'encounter') return
    dispatch({ type: 'encounter.complete', questSlug: quest.slug, stepId: step.id, encounterId: step.encounterId, score: result.score, reward: result.reward, operationId: crypto.randomUUID() })
      .catch((error) => {
        if (error instanceof CommandRejectedError) console.warn('Encounter not recorded:', error.rejection.message)
        else console.error('Failed to record encounter', error)
      })
      .finally(() => actor.send({ type: 'ENCOUNTER_RESULT', score: result.score, reward: result.reward }))
  }, [actor, quest.slug, dispatch, step])

  const isGated = questSelectors.isGated(snapshot)
  const revealed = questSelectors.isRevealed(snapshot)
  const selectedCard = questSelectors.selectedCard(snapshot)
  const showingOutcome = step.type === 'mystery' && revealed && Boolean(selectedCard)
  const primaryLabel = questSelectors.primaryLabel(snapshot)
  const primaryDisabled = questSelectors.primaryDisabled(snapshot)
  const primaryAction = () => actor.send({ type: step.type === 'mystery' && !revealed ? 'REVEAL' : 'NEXT' })
  const OutcomeIcon = selectedCard && ((selectedCard.icon && choiceIcons[selectedCard.icon]) || Sparkles)

  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
        <div className="progress-line">
          <span>Round {stepIndex + 1} of {quest.steps.length}</span>
          <div><i style={{ width: `${((stepIndex + 1) / quest.steps.length) * 100}%` }} /></div>
        </div>
        <div className="challenge-panel">
          <p className="eyebrow">{step.type} challenge</p>
          <h1>{step.title}</h1>
          <div className="challenge-prompt">{step.prompt.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {isGated ? (
            <div className="riddle-box passcode-gate">
              <p className="eyebrow">Checkpoint synchronization required</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  actor.send({ type: 'SUBMIT_PASSCODE' })
                }}
              >
                <input
                  id="passcode"
                  aria-label="Passcode"
                  value={passcodeInput}
                  onChange={(e) => actor.send({ type: 'TYPE_PASSCODE', value: e.target.value })}
                  placeholder="Enter code"
                  autoComplete="off"
                />
                {passcodeError && <p className="passcode-error">That code doesn't match. Try again.</p>}
                <button type="submit" className="portal-button mt-4">Sync <ArrowRight /></button>
              </form>
            </div>
          ) : showingOutcome && selectedCard ? (
            <div className="reveal-box outcome-reveal">
              <span className="mystery-mark">{OutcomeIcon && <OutcomeIcon aria-hidden="true" />}</span>
              <strong>{selectedCard.label}</strong>
              <p>{selectedCard.outcome}</p>
            </div>
          ) : step.type === 'encounter' && revealed ? (
            <EncounterResultCard encounterId={step.encounterId} score={Number(answer)} />
          ) : step.type === 'encounter' ? (
            <EncounterStage encounterId={step.encounterId} onResult={onEncounterResult} />
          ) : (
            <ChallengeBody
              step={step}
              answer={answer}
              setAnswer={(value) => actor.send({ type: 'TYPE_ANSWER', value })}
              selectAnswer={(value) => actor.send({ type: 'SELECT', value })}
              revealed={revealed}
              setRevealed={() => actor.send({ type: 'REVEAL' })}
            />
          )}
          {!isGated && questSelectors.showsPrimary(snapshot) && (
            <button className="portal-button mt-8" disabled={primaryDisabled} onClick={primaryAction}>{primaryLabel} <ArrowRight /></button>
          )}
        </div>
      </main>
    </Shell>
  )
}
function EncounterResultCard({ encounterId, score }: { encounterId: string; score: number }) {
  const encounter = getEncounter(encounterId)
  const { view } = useGame()
  const record = view?.encounters.find((entry) => entry.id === encounterId)
  return (
    <div className="reveal-box outcome-reveal encounter-result">
      <span className="mystery-mark"><Zap aria-hidden="true" /></span>
      <strong>{encounter?.rank?.({ score }) ?? 'Locked'}</strong>
      <p>{score} / {encounter?.maxScore ?? '?'}{record && record.bestScore > score ? ` · best ${record.bestScore}` : record && record.plays > 1 ? ' · new best' : ''}</p>
    </div>
  )
}
function ChallengeBody({ step, answer, setAnswer, selectAnswer, revealed, setRevealed }: { step: ChallengeStep; answer: string; setAnswer: (v: string) => void; selectAnswer: (v: string) => void; revealed: boolean; setRevealed: (v: boolean) => void }) {
  if (step.type === 'choice') return <div className="option-grid">{step.options.map((option) => <button key={option} className={`choice ${answer === option ? 'selected' : ''}`} aria-pressed={answer === option} onClick={() => selectAnswer(option)}>{option}<span>{answer === option ? 'Selected' : 'Choose'}</span></button>)}</div>
  if (step.type === 'mystery') return <div className="option-grid mystery-grid">{step.cards.map((card) => { const selected = answer === card.label; const Icon = (card.icon && choiceIcons[card.icon]) || Sparkles; return <button key={card.label} className={`mystery-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => selectAnswer(card.label)}><span className="mystery-mark"><Icon aria-hidden="true" /></span><strong>{card.label}</strong></button> })}</div>
  if (step.type === 'riddle') return <div className="riddle-box"><p>{step.clue}</p><label htmlFor="answer">Your answer</label><input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type what you think..." /></div>
  if (step.type === 'reveal') return <div className="reveal-box"><Sparkles /><p>{step.message}</p></div>
  return <div className="confirm-box"><BookOpen /><p>{step.type === 'activity' ? step.detail : step.prompt}</p>{step.type === 'confirm' && <button className="text-button" onClick={() => setRevealed(true)}>{step.button}</button>}</div>
}
function Completion({ quest }: { quest: QuestDefinition }) {
  // The save is the only source of truth for a finished quest's choices.
  // `undefined` means the save is still loading; `null` means it loaded
  // but this quest has never been completed.
  const { view, error } = useGame()
  const questView = view?.quests[quest.slug]
  const answers: Record<string, string> | null | undefined = !view && !error ? undefined : questView && questView.completions > 0 ? view!.save.quests[quest.slug].answers : null

  const loading = answers === undefined

  const outcomes = useMemo(() => quest.steps.flatMap((step) => {
    if (step.type !== 'mystery') return []
    const selected = step.cards.find((card) => card.label === answers?.[step.id])
    return selected?.outcome ? [{ choice: selected.label, outcome: selected.outcome, icon: selected.icon && choiceIcons[selected.icon], tags: selected.tags }] : []
  }), [quest.steps, answers])

  const summaryRows = useMemo(() => quest.steps.flatMap((step) => {
    if (step.type !== 'mystery' || !step.summaryLabel) return []
    const selected = step.cards.find((card) => card.label === answers?.[step.id])
    const value = selected?.summaryValue || selected?.label
    return value ? [{ label: step.summaryLabel, value }] : []
  }), [quest.steps, answers])

  const diceBasedCount = useMemo(() => outcomes.filter((result) => result.tags?.includes('dice-based')).length, [outcomes])

  return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><div className="completion-panel"><div className="completion-star">✦</div><p className="eyebrow">Quest complete</p><h1>{quest.completionTitle || 'Quest complete'}</h1><p className="challenge-prompt">{quest.completionMessage}</p>{quest.reward && <div className="final-note glitch-text">{quest.reward}</div>}{loading ? <div className="loading-block" role="status" aria-live="polite"><div className="loading-spinner"><span /><span /><span /><span /></div><p className="loading-label">Loading your Saturday…</p></div> : outcomes.length > 0 && <>
    <div className="outcome-list">{outcomes.map((result) => { const Icon = result.icon; return <div className="outcome-stop" key={result.choice}><span className="outcome-icon">{Icon ? <Icon aria-hidden="true" /> : <Sparkles aria-hidden="true" />}</span><div><span className="outcome-label">{result.choice}</span><strong>{result.outcome}</strong></div></div> })}</div>
    <p className="run-summary-heading">Run summary</p>
    <div className="run-summary">
      {quest.companionName && <div className="run-summary-row"><span>Player 2</span><strong>{quest.companionName}</strong></div>}
      <div className="run-summary-row"><span>Quest</span><strong>{quest.title}</strong></div>
      <div className="run-summary-row"><span>Status</span><strong>Cleared</strong></div>
      {summaryRows.map((row) => <div className="run-summary-row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}
    </div>
    <p className="run-summary-heading">Game stats</p>
    <div className="run-summary">
      <div className="run-summary-row"><span>Decisions survived</span><strong>{outcomes.length}</strong></div>
      <div className="run-summary-row"><span>Dice-based decisions</span><strong>{diceBasedCount}</strong></div>
      {quest.funStats?.map((stat) => <div className="run-summary-row" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}
    </div>
  </>}<div className="flex flex-wrap justify-center gap-3 mt-8"><Link className="portal-button" to="/lobby">Return to lobby</Link><Link className="secondary-button" to="/archive">View archive</Link></div></div></main></Shell>
}
function BrowserUrlSync() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const nextUrl = `${location.pathname}${location.search}${location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextUrl !== currentUrl) window.history.pushState({}, '', nextUrl)
  }, [location])

  useEffect(() => {
    const syncFromBrowser = () => navigate(`${window.location.pathname}${window.location.search}${window.location.hash}`, { replace: true })
    window.addEventListener('popstate', syncFromBrowser)
    return () => window.removeEventListener('popstate', syncFromBrowser)
  }, [navigate])

  return null
}

function AppRoutes() { return <Routes><Route path="/" element={<Portal />} /><Route path="/lobby" element={<Lobby />} /><Route path="/quest-log" element={<QuestLog />} /><Route path="/quests" element={<Navigate to="/quest-log" replace />} /><Route path="/archive" element={<Archive />} /><Route path="/profile" element={<Profile />} /><Route path="/dev" element={<Shell><DevTools /></Shell>} /><Route path="/reset" element={<Navigate to="/dev" replace />} /><Route path="/quest/:slug" element={<QuestIntroRoute />} /><Route path="/quest/:slug/play" element={<ChallengeRoute />} /><Route path="/quest/:slug/complete" element={<CompletionRoute />} /></Routes> }

function App({ initialPath = '/' }: { initialPath?: string }) {
  // Keep one router mounted for the lifetime of the app so the CRT boot
  // sequence is not restarted when hydration completes.
  return <AudioProvider><GameProvider><MemoryRouter initialEntries={[initialPath]}><BrowserUrlSync /><AppRoutes /></MemoryRouter></GameProvider></AudioProvider>
}
function RouteQuest({ children }: { children: (a: QuestDefinition) => React.ReactNode }) { const { slug } = useParams(); const quest = useMemo(() => getQuest(slug || ''), [slug]); if (!quest || quest.status === 'coming-soon') return <Portal />; return <>{children(quest)}</> }
const QuestIntroRoute = () => <RouteQuest>{(a) => <Intro quest={a} />}</RouteQuest>; const ChallengeRoute = () => <RouteQuest>{(a) => <Challenge quest={a} />}</RouteQuest>; const CompletionRoute = () => <RouteQuest>{(a) => <Completion quest={a} />}</RouteQuest>
export default App

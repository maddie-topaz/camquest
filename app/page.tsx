'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Archive as ArchiveIcon, ArrowLeft, ArrowRight, BookOpen, Check, CircleDot, Dice5, Gamepad2, Joystick, Link as LinkIcon, Lock, Martini, Moon, Origami, Palmtree, RotateCcw, Sparkles, Sun, type LucideIcon } from 'lucide-react'
import { adventures, getAdventure, getProgress, resetAdventureProgress, saveProgress, type Adventure, type AdventureProgress, type ChallengeStep } from '@/lib/adventures'

const choiceIcons: Record<string, LucideIcon> = { Sun, Moon, CircleDot, Joystick, Origami, Sparkles, Link: LinkIcon, Dice5, Martini, Palmtree }

function Shell({ children, minimal = false }: { children: React.ReactNode; minimal?: boolean }) { return <div className="min-h-screen bg-[#0d0b1b] text-[#f7f0ff]"><div className="stars" />{!minimal && <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6" aria-label="Site header" />}{children}</div> }
function useStoredProgress() { const [progress, setProgress] = useState<Record<string, AdventureProgress>>({}); useEffect(() => setProgress(getProgress()), []); return progress }
function useCompletedSlugs() {
  // Local progress only knows what this device has done. The database is
  // shared across devices, so a quest either of us finished elsewhere still
  // needs to show as completed here.
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(new Set())
  const [completedAt, setCompletedAt] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    fetch('/api/quests/completions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.slugs)) setCompletedSlugs(new Set(data.slugs))
        if (data?.completedAt) setCompletedAt(data.completedAt)
      })
      .catch((error) => console.error('Failed to load quest completions', error))
    return () => {
      cancelled = true
    }
  }, [])
  return { completedSlugs, completedAt }
}
function Portal() { return <Shell minimal><main className="arcade-home"><section className="portal-hero"><div className="arcade-machine" aria-label="Camquest arcade machine"><Link className="arcade-screen" to="/lobby" aria-label="Start Camquest and open the lobby"><span className="screen-scanlines" aria-hidden="true" /><span className="pixel-sprite sprite-heart" aria-hidden="true">♥</span><span className="screen-stars">✦  ·  ✦  ·  ✦</span><strong>CAM⚡QUEST</strong><span className="screen-subtitle">READY UP. ADVENTURE CALLS.</span><span className="screen-prompt">[ PRESS START ]</span></Link><div className="arcade-controls" aria-label="Two-player arcade controls"><div className="player-controls" aria-label="Player one buttons"><div className="arcade-buttons"><button type="button" aria-label="Player one pink button"><span /></button><button type="button" aria-label="Player one gold button"><span /></button></div></div><div className="player-controls player-two" aria-label="Player two buttons"><div className="arcade-buttons"><button type="button" aria-label="Player two cyan button"><span /></button><button type="button" aria-label="Player two violet button"><span /></button></div></div></div></div></section></main></Shell> }
const lobbyDestinations = [
  { to: '/quest-log', icon: Gamepad2, title: 'Quest log', description: "See your current quests.", linkLabel: 'Enter quest log' },
  { to: '/archive', icon: ArchiveIcon, title: 'Archive', description: "See completed quests.", linkLabel: 'Open archive' },
]
function Lobby() { return <Shell><main className="relative z-10 mx-auto max-w-6xl px-5 pb-16"><div className="page-title"><p className="eyebrow">Cam⚡Quest</p><h1>Game lobby</h1></div><div className="quest-grid">{lobbyDestinations.map((dest) => { const Icon = dest.icon; return <Link key={dest.to} className="quest-card" to={dest.to}><div className="card-top"><span className="quest-symbol"><Icon aria-hidden="true" /></span></div><h3>{dest.title}</h3><p>{dest.description}</p><span className="card-link">{dest.linkLabel} <ArrowRight /></span></Link> })}</div></main></Shell> }
function QuestLog() { const progress = useStoredProgress(); const { completedSlugs } = useCompletedSlugs(); return <Shell><main className="relative z-10 mx-auto max-w-6xl px-5 pb-16"><Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link><div className="page-title"><p className="eyebrow">Cam⚡Quest</p><h1>Quest log</h1></div><div className="quest-grid">{adventures.map((adventure) => <QuestCard key={adventure.id} adventure={adventure} progress={progress[adventure.slug]} serverCompleted={completedSlugs.has(adventure.slug)} />)}</div></main></Shell> }
function QuestCard({ adventure, progress, serverCompleted }: { adventure: Adventure; progress?: AdventureProgress; serverCompleted?: boolean }) {
  const locked = adventure.status !== 'available' && adventure.status !== 'completed'
  const completed = Boolean(progress?.completed) || serverCompleted || adventure.status === 'completed'
  return (
    <article className={`quest-card ${locked ? 'is-locked' : ''}`}>
      <div className="card-top">
        <span className="quest-symbol">{locked ? <Lock aria-hidden="true" /> : adventure.symbol}</span>
        <span className="status-pill">{completed ? 'Completed' : locked ? 'Coming soon' : 'Available'}</span>
      </div>
      <h3>{adventure.title}</h3>
      <p>{adventure.description}</p>
      {locked ? (
        <span className="card-link muted">Still being written</span>
      ) : completed ? (
        <Link className="card-link" to={`/quest/${adventure.slug}/complete`}>View result <ArrowRight /></Link>
      ) : (
        <Link className="card-link" to={`/quest/${adventure.slug}`}>{progress ? 'Continue quest' : 'Start quest'} <ArrowRight /></Link>
      )}
    </article>
  )
}
function Archive() {
  const progress = useStoredProgress()
  const { completedSlugs, completedAt } = useCompletedSlugs()
  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-16">
        <Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link>
        <div className="page-title">
          <p className="eyebrow">The archive</p>
          <h1>Completed quests</h1>
        </div>
        <div className="archive-list">
          {adventures.map((a) => {
            const completed = Boolean(progress[a.slug]?.completed) || completedSlugs.has(a.slug)
            const completedDate = completedAt[a.slug] && new Date(completedAt[a.slug]).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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
function ResetDebug() {
  // Undocumented debug route: not linked from anywhere in the UI. Resets
  // are per-quest only, on purpose — no "wipe everything" button here.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [resultBySlug, setResultBySlug] = useState<Record<string, 'ok' | 'error'>>({})

  const resetQuest = async (slug: string) => {
    setPendingSlug(slug)
    setResultBySlug((current) => { const next = { ...current }; delete next[slug]; return next })
    resetAdventureProgress(slug)
    try {
      const res = await fetch(`/api/quests/${slug}/completion`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Request failed')
      setResultBySlug((current) => ({ ...current, [slug]: 'ok' }))
    } catch (error) {
      console.error('Failed to reset quest', error)
      setResultBySlug((current) => ({ ...current, [slug]: 'error' }))
    } finally {
      setPendingSlug(null)
    }
  }

  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-16">
        <div className="page-title">
          <p className="eyebrow">Debug</p>
          <h1>Reset a quest</h1>
          <p>Clears this device's local progress and every stored completion for one quest. Each quest resets on its own — there's no reset-everything button here.</p>
        </div>
        <div className="archive-list">
          {adventures.map((a) => (
            <div className="archive-row" key={a.id}>
              <span className="archive-symbol">{a.symbol}</span>
              <div>
                <h2>{a.title}</h2>
                <p>
                  {pendingSlug === a.slug ? 'Resetting…' : resultBySlug[a.slug] === 'ok' ? 'Reset. Fresh start.' : resultBySlug[a.slug] === 'error' ? 'Something went wrong clearing the database.' : a.slug}
                </p>
              </div>
              <button className="reset-button" disabled={pendingSlug === a.slug} onClick={() => resetQuest(a.slug)}>
                <RotateCcw /> Reset this quest
              </button>
            </div>
          ))}
        </div>
        {adventures.map((a) => {
          const passcodeEntries = [
            ...(a.startPasscode ? [{ id: 'start', roundNumber: 'Start', title: 'Begin quest', passcode: a.startPasscode }] : []),
            ...a.steps.map((s, index) => ({ id: s.id, roundNumber: String(index + 1), title: s.title, passcode: s.passcode })).filter((s) => s.passcode),
          ]
          if (!passcodeEntries.length) return null
          return (
            <div key={a.id} className="page-title">
              <p className="eyebrow">{a.title}</p>
              <h2>Round passcodes</h2>
              <div className="archive-list">
                {passcodeEntries.map((s) => (
                  <div className="archive-row" key={s.id}>
                    <span className="archive-symbol">{s.roundNumber}</span>
                    <div>
                      <h2>{s.title}</h2>
                      <p className="passcode-value">{s.passcode}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </main>
    </Shell>
  )
}
const startUnlockId = '__start__'
function Intro({ adventure }: { adventure: Adventure }) {
  const navigate = useNavigate()
  const paragraphs = (adventure.introduction || '').split('\n\n')
  const [startUnlocked, setStartUnlocked] = useState(!adventure.startPasscode)
  const [startPasscodeInput, setStartPasscodeInput] = useState('')
  const [startPasscodeError, setStartPasscodeError] = useState(false)

  useEffect(() => {
    if (!adventure.startPasscode) return
    const unlockedSteps = getProgress()[adventure.slug]?.unlockedSteps || []
    setStartUnlocked(unlockedSteps.includes(startUnlockId))
  }, [adventure.slug, adventure.startPasscode])

  const unlockStart = () => {
    const target = adventure.startPasscode?.trim().toUpperCase()
    if (target && startPasscodeInput.trim().toUpperCase() === target) {
      const current = getProgress()[adventure.slug]
      const nextUnlocked = [...(current?.unlockedSteps || []), startUnlockId]
      saveProgress(adventure.slug, current?.step ?? 0, current?.completed ?? false, current?.answers, nextUnlocked)
      setStartUnlocked(true)
      setStartPasscodeError(false)
    } else {
      setStartPasscodeError(true)
    }
  }

  return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><Link to="/lobby" className="back-link"><ArrowLeft /> Back to lobby</Link><div className="intro-panel transmission-panel">
    <span className="big-symbol transmission-line" style={{ animationDelay: '.1s' }}>{adventure.symbol}</span>
    <p className="eyebrow transmission-line" style={{ animationDelay: '.25s' }}>A mysterious challenger has appeared...</p>
    <h1 className="transmission-line" style={{ animationDelay: '.4s' }}>{adventure.title}</h1>
    {adventure.subtitle && <p className="intro-subtitle transmission-line" style={{ animationDelay: '.55s' }}>{adventure.subtitle}</p>}
    <div className="story-text transmission-line" style={{ animationDelay: '.7s' }}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {startUnlocked ? (
      <button className="portal-button transmission-line" style={{ animationDelay: '1s' }} onClick={() => navigate(`/quest/${adventure.slug}/play`)}>{adventure.ctaLabel || 'Begin quest'} <ArrowRight /></button>
    ) : (
      <div className="riddle-box passcode-gate transmission-line" style={{ animationDelay: '1s' }}>
        <p className="eyebrow">Checkpoint synchronization required</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            unlockStart()
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
function Challenge({ adventure }: { adventure: Adventure }) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [answer, setAnswer] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState(false)
  const [unlockedSteps, setUnlockedSteps] = useState<string[]>([])
  const [passcodeInput, setPasscodeInput] = useState('')
  const [passcodeError, setPasscodeError] = useState(false)
  const step = adventure.steps[stepIndex]

  useEffect(() => {
    const saved = getProgress()[adventure.slug]
    const initialStep = saved?.completed ? 0 : Math.min(saved?.step || 0, Math.max(0, adventure.steps.length - 1))
    const initialAnswers = saved?.completed ? {} : saved?.answers || {}
    const restoredAnswer = initialAnswers[adventure.steps[initialStep]?.id] || ''
    setStepIndex(initialStep)
    setAnswers(initialAnswers)
    setAnswer(restoredAnswer)
    setRevealed(Boolean(restoredAnswer))
    setUnlockedSteps(saved?.completed ? [] : saved?.unlockedSteps || [])
    setHydrated(true)
  }, [adventure.slug, adventure.steps])

  useEffect(() => {
    if (hydrated) saveProgress(adventure.slug, stepIndex, false, answers, unlockedSteps)
  }, [adventure.slug, answers, hydrated, stepIndex, unlockedSteps])

  const selectAnswer = (value: string) => {
    setAnswer(value)
    setAnswers((current) => ({ ...current, [step.id]: value }))
  }

  const unlockStep = () => {
    const target = step.passcode?.trim().toUpperCase()
    if (target && passcodeInput.trim().toUpperCase() === target) {
      setUnlockedSteps((current) => (current.includes(step.id) ? current : [...current, step.id]))
      setPasscodeInput('')
      setPasscodeError(false)
    } else {
      setPasscodeError(true)
    }
  }

  const next = () => {
    const nextAnswers = answer ? { ...answers, [step.id]: answer } : answers
    if (stepIndex >= adventure.steps.length - 1) {
      // The finished answers now live in the database (see the POST below);
      // no need to keep a duplicate copy in localStorage. Just mark it done.
      saveProgress(adventure.slug, adventure.steps.length, true, {})
      void fetch('/api/quests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: adventure.slug, answers: nextAnswers }),
      }).catch((error) => console.error('Failed to save quest completion', error))
      navigate(`/quest/${adventure.slug}/complete`)
      return
    }

    const nextIndex = stepIndex + 1
    const restoredAnswer = nextAnswers[adventure.steps[nextIndex].id] || ''
    saveProgress(adventure.slug, nextIndex, false, nextAnswers, unlockedSteps)
    setAnswers(nextAnswers)
    setStepIndex(nextIndex)
    setAnswer(restoredAnswer)
    setRevealed(Boolean(restoredAnswer))
    setPasscodeInput('')
    setPasscodeError(false)
  }

  const isLocked = Boolean(step.passcode) && !unlockedSteps.includes(step.id)
  const hasOutcomeReveal = step.type === 'mystery'
  const selectedCard = step.type === 'mystery' ? step.cards.find((card) => card.label === answer) : undefined
  const showingOutcome = hasOutcomeReveal && revealed && Boolean(selectedCard)
  const isLastStep = stepIndex === adventure.steps.length - 1
  const needsSelection = step.type === 'choice' || step.type === 'mystery'
  const riddleIsIncorrect = step.type === 'riddle' && answer.trim().toLowerCase() !== step.answer

  const primaryAction = () => {
    if (hasOutcomeReveal && !revealed) {
      setRevealed(true)
      return
    }
    next()
  }
  const primaryLabel = hasOutcomeReveal && !revealed ? 'Lock choice' : isLastStep ? 'Finish quest' : 'Continue'
  const primaryDisabled = showingOutcome ? false : (needsSelection && !answer) || riddleIsIncorrect
  const OutcomeIcon = selectedCard && ((selectedCard.icon && choiceIcons[selectedCard.icon]) || Sparkles)

  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
        <div className="progress-line">
          <span>Round {stepIndex + 1} of {adventure.steps.length}</span>
          <div><i style={{ width: `${((stepIndex + 1) / adventure.steps.length) * 100}%` }} /></div>
        </div>
        <div className="challenge-panel">
          <p className="eyebrow">{step.type} challenge</p>
          <h1>{step.title}</h1>
          <div className="challenge-prompt">{step.prompt.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {isLocked ? (
            <div className="riddle-box passcode-gate">
              <p className="eyebrow">Checkpoint synchronization required</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  unlockStep()
                }}
              >
                <input
                  id="passcode"
                  aria-label="Passcode"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value)
                    setPasscodeError(false)
                  }}
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
          ) : (
            <ChallengeBody step={step} answer={answer} setAnswer={setAnswer} selectAnswer={selectAnswer} revealed={revealed} setRevealed={setRevealed} />
          )}
          {!isLocked && (
            <button className="portal-button mt-8" disabled={primaryDisabled} onClick={primaryAction}>{primaryLabel} <ArrowRight /></button>
          )}
        </div>
      </main>
    </Shell>
  )
}
function ChallengeBody({ step, answer, setAnswer, selectAnswer, revealed, setRevealed }: { step: ChallengeStep; answer: string; setAnswer: (v: string) => void; selectAnswer: (v: string) => void; revealed: boolean; setRevealed: (v: boolean) => void }) {
  if (step.type === 'choice') return <div className="option-grid">{step.options.map((option) => <button key={option} className={`choice ${answer === option ? 'selected' : ''}`} aria-pressed={answer === option} onClick={() => selectAnswer(option)}>{option}<span>{answer === option ? 'Selected' : 'Choose'}</span></button>)}</div>
  if (step.type === 'mystery') return <div className="option-grid mystery-grid">{step.cards.map((card) => { const selected = answer === card.label; const Icon = (card.icon && choiceIcons[card.icon]) || Sparkles; return <button key={card.label} className={`mystery-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => selectAnswer(card.label)}><span className="mystery-mark"><Icon aria-hidden="true" /></span><strong>{card.label}</strong></button> })}</div>
  if (step.type === 'riddle') return <div className="riddle-box"><p>{step.clue}</p><label htmlFor="answer">Your answer</label><input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type what you think..." /></div>
  if (step.type === 'reveal') return <div className="reveal-box"><Sparkles /><p>{step.message}</p></div>
  return <div className="confirm-box"><BookOpen /><p>{step.type === 'activity' ? step.detail : step.prompt}</p>{step.type === 'confirm' && <button className="text-button" onClick={() => setRevealed(true)}>{step.button}</button>}</div>
}
function Completion({ adventure }: { adventure: Adventure }) {
  // The database is the only source of truth for a finished quest's
  // choices now. `undefined` means "still fetching" (shows the loading
  // spinner); `null` means the fetch finished but found nothing.
  const [answers, setAnswers] = useState<Record<string, string> | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setAnswers(undefined)
    fetch(`/api/quests/${adventure.slug}/completion`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setAnswers(data?.completion?.answers ?? null)
      })
      .catch((error) => {
        console.error('Failed to load stored completion', error)
        if (!cancelled) setAnswers(null)
      })
    return () => {
      cancelled = true
    }
  }, [adventure.slug])

  const loading = answers === undefined

  const outcomes = useMemo(() => adventure.steps.flatMap((step) => {
    if (step.type !== 'mystery') return []
    const selected = step.cards.find((card) => card.label === answers?.[step.id])
    return selected?.outcome ? [{ choice: selected.label, outcome: selected.outcome, icon: selected.icon && choiceIcons[selected.icon], tags: selected.tags }] : []
  }), [adventure.steps, answers])

  const summaryRows = useMemo(() => adventure.steps.flatMap((step) => {
    if (step.type !== 'mystery' || !step.summaryLabel) return []
    const selected = step.cards.find((card) => card.label === answers?.[step.id])
    const value = selected?.summaryValue || selected?.label
    return value ? [{ label: step.summaryLabel, value }] : []
  }), [adventure.steps, answers])

  const diceBasedCount = useMemo(() => outcomes.filter((result) => result.tags?.includes('dice-based')).length, [outcomes])

  return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><div className="completion-panel"><div className="completion-star">✦</div><p className="eyebrow">Quest complete</p><h1>{adventure.completionTitle || 'Quest complete'}</h1><p className="challenge-prompt">{adventure.completionMessage}</p>{adventure.reward && <div className="final-note glitch-text">{adventure.reward}</div>}{loading ? <div className="loading-block" role="status" aria-live="polite"><div className="loading-spinner"><span /><span /><span /><span /></div><p className="loading-label">Loading your Saturday…</p></div> : outcomes.length > 0 && <>
    <div className="outcome-list">{outcomes.map((result) => { const Icon = result.icon; return <div className="outcome-stop" key={result.choice}><span className="outcome-icon">{Icon ? <Icon aria-hidden="true" /> : <Sparkles aria-hidden="true" />}</span><div><span className="outcome-label">{result.choice}</span><strong>{result.outcome}</strong></div></div> })}</div>
    <p className="run-summary-heading">Run summary</p>
    <div className="run-summary">
      {adventure.companionName && <div className="run-summary-row"><span>Player 2</span><strong>{adventure.companionName}</strong></div>}
      <div className="run-summary-row"><span>Quest</span><strong>{adventure.title}</strong></div>
      <div className="run-summary-row"><span>Status</span><strong>Cleared</strong></div>
      {summaryRows.map((row) => <div className="run-summary-row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}
    </div>
    <p className="run-summary-heading">Game stats</p>
    <div className="run-summary">
      <div className="run-summary-row"><span>Decisions survived</span><strong>{outcomes.length}</strong></div>
      <div className="run-summary-row"><span>Dice-based decisions</span><strong>{diceBasedCount}</strong></div>
      {adventure.funStats?.map((stat) => <div className="run-summary-row" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}
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

function AppRoutes() { return <Routes><Route path="/" element={<Portal />} /><Route path="/lobby" element={<Lobby />} /><Route path="/quest-log" element={<QuestLog />} /><Route path="/quests" element={<Navigate to="/quest-log" replace />} /><Route path="/archive" element={<Archive />} /><Route path="/reset" element={<ResetDebug />} /><Route path="/quest/:slug" element={<QuestIntroRoute />} /><Route path="/quest/:slug/play" element={<ChallengeRoute />} /><Route path="/quest/:slug/complete" element={<CompletionRoute />} /></Routes> }

function App({ initialPath = '/' }: { initialPath?: string }) {
  // Keep one router mounted for the lifetime of the app so the CRT boot
  // sequence is not restarted when hydration completes.
  return <MemoryRouter initialEntries={[initialPath]}><BrowserUrlSync /><AppRoutes /></MemoryRouter>
}
function RouteAdventure({ children }: { children: (a: Adventure) => React.ReactNode }) { const { slug } = useParams(); const adventure = useMemo(() => getAdventure(slug || ''), [slug]); if (!adventure || adventure.status === 'coming-soon') return <Portal />; return <>{children(adventure)}</> }
const QuestIntroRoute = () => <RouteAdventure>{(a) => <Intro adventure={a} />}</RouteAdventure>; const ChallengeRoute = () => <RouteAdventure>{(a) => <Challenge adventure={a} />}</RouteAdventure>; const CompletionRoute = () => <RouteAdventure>{(a) => <Completion adventure={a} />}</RouteAdventure>
export default App

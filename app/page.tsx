'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Lock, RotateCcw, Sparkles } from 'lucide-react'
import { adventures, getAdventure, getProgress, resetAdventureProgress, resetProgress, saveProgress, siteConfig, type Adventure, type AdventureProgress, type ChallengeStep } from '@/lib/adventures'

function Shell({ children, minimal = false }: { children: React.ReactNode; minimal?: boolean }) { return <div className="min-h-screen bg-[#0d0b1b] text-[#f7f0ff]"><div className="stars" />{!minimal && <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6" aria-label="Site header" />}{children}{!minimal && <footer className="relative z-10 mx-auto flex max-w-6xl justify-between px-5 py-8 text-xs text-[#77718f]"><span>Made for {siteConfig.companion}, with intent.</span><span>✦ v. 01</span></footer>}</div> }
function useStoredProgress() { const [progress, setProgress] = useState<Record<string, AdventureProgress>>({}); useEffect(() => setProgress(getProgress()), []); return progress }
function Portal() { return <Shell minimal><main className="arcade-home"><section className="portal-hero"><div className="arcade-machine" aria-label="Camquest arcade machine"><Link className="arcade-screen" to="/quest-log" aria-label="Start Camquest and open the quest log"><span className="screen-scanlines" aria-hidden="true" /><span className="pixel-sprite sprite-heart" aria-hidden="true">♥</span><span className="screen-stars">✦  ·  ✦  ·  ✦</span><strong>CAM⚡QUEST</strong><span className="screen-subtitle">READY UP. ADVENTURE CALLS.</span><span className="screen-prompt">[ PRESS START ]</span></Link><div className="arcade-controls" aria-label="Two-player arcade controls"><div className="player-controls" aria-label="Player one buttons"><div className="arcade-buttons"><button type="button" aria-label="Player one pink button"><span /></button><button type="button" aria-label="Player one gold button"><span /></button></div></div><div className="player-controls player-two" aria-label="Player two buttons"><div className="arcade-buttons"><button type="button" aria-label="Player two cyan button"><span /></button><button type="button" aria-label="Player two violet button"><span /></button></div></div></div></div></section></main></Shell> }
function QuestLog() { const progress = useStoredProgress(); return <Shell><main className="relative z-10 mx-auto max-w-6xl px-5 pb-16"><div className="page-title"><p className="eyebrow">Cam⚡Quest</p><h1>Quest log</h1></div><div className="quest-grid">{adventures.map((adventure) => <QuestCard key={adventure.id} adventure={adventure} progress={progress[adventure.slug]} />)}</div></main></Shell> }
function QuestCard({ adventure, progress }: { adventure: Adventure; progress?: AdventureProgress }) {
  const locked = adventure.status !== 'available' && adventure.status !== 'completed'
  const completed = Boolean(progress?.completed) || adventure.status === 'completed'
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
        <div className="flex flex-wrap items-center gap-3">
          <Link className="card-link" to={`/quest/${adventure.slug}/complete`}>View result <ArrowRight /></Link>
          <Link className="card-link muted" to={`/quest/${adventure.slug}`}>Replay quest</Link>
        </div>
      ) : (
        <Link className="card-link" to={`/quest/${adventure.slug}`}>{progress ? 'Continue quest' : 'Open chapter'} <ArrowRight /></Link>
      )}
    </article>
  )
}
function Archive() {
  const progress = useStoredProgress()
  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-16">
        <div className="page-title">
          <p className="eyebrow">The archive</p>
          <h1>Stories already carried</h1>
          <p>Every completed chapter stays here, like a pressed flower in the margins.</p>
        </div>
        <div className="archive-list">
          {adventures.map((a) => {
            const completed = Boolean(progress[a.slug]?.completed)
            return (
              <div className="archive-row" key={a.id}>
                <span className="archive-symbol">{a.symbol}</span>
                <div>
                  <h2>{a.title}</h2>
                  <p>{completed ? 'Completed and safely tucked away.' : a.status === 'coming-soon' ? 'The ink is still drying.' : 'Waiting to be discovered.'}</p>
                </div>
                {completed && (
                  <Link className="card-link" to={`/quest/${a.slug}/complete`}>
                    View result <Check className="text-[#f0b8d2]" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <button className="reset-button" onClick={() => { resetProgress(); window.location.reload() }}><RotateCcw /> Reset all progress</button>
      </main>
    </Shell>
  )
}
function Intro({ adventure }: { adventure: Adventure }) { const navigate = useNavigate(); return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><Link to="/" className="back-link"><ArrowLeft /> Back to portal</Link><div className="intro-panel"><span className="big-symbol">{adventure.symbol}</span><p className="eyebrow">A new chapter</p><h1>{adventure.title}</h1><p className="intro-subtitle">{adventure.subtitle}</p><div className="intro-meta"><span><Clock3 /> {adventure.duration}</span>{adventure.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><p className="story-text">{adventure.introduction}</p><button className="portal-button" onClick={() => navigate(`/quest/${adventure.slug}/play`)}>Begin quest <ArrowRight /></button></div></main></Shell> }
function Challenge({ adventure }: { adventure: Adventure }) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [answer, setAnswer] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState(false)
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
    setHydrated(true)
  }, [adventure.slug, adventure.steps])

  useEffect(() => {
    if (hydrated) saveProgress(adventure.slug, stepIndex, false, answers)
  }, [adventure.slug, answers, hydrated, stepIndex])

  const selectAnswer = (value: string) => {
    setAnswer(value)
    setRevealed(true)
    setAnswers((current) => ({ ...current, [step.id]: value }))
  }

  const next = () => {
    const nextAnswers = answer ? { ...answers, [step.id]: answer } : answers
    if (stepIndex >= adventure.steps.length - 1) {
      saveProgress(adventure.slug, adventure.steps.length, true, nextAnswers)
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
    saveProgress(adventure.slug, nextIndex, false, nextAnswers)
    setAnswers(nextAnswers)
    setStepIndex(nextIndex)
    setAnswer(restoredAnswer)
    setRevealed(Boolean(restoredAnswer))
  }

  const restart = () => {
    resetAdventureProgress(adventure.slug)
    setAnswers({})
    setAnswer('')
    setRevealed(false)
    setStepIndex(0)
  }

  const needsSelection = step.type === 'choice' || step.type === 'mystery'
  const riddleIsIncorrect = step.type === 'riddle' && answer.trim().toLowerCase() !== step.answer
  return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><div className="progress-line"><span>Round {stepIndex + 1} of {adventure.steps.length}</span><div><i style={{ width: `${((stepIndex + 1) / adventure.steps.length) * 100}%` }} /></div></div><button type="button" onClick={restart} className="text-button mt-2 inline-flex items-center gap-1 text-xs opacity-70 transition hover:opacity-100"><RotateCcw className="h-3 w-3" /> Start over</button><div className="challenge-panel"><p className="eyebrow">{step.type} challenge</p><h1>{step.title}</h1><p className="challenge-prompt">{step.prompt}</p><ChallengeBody step={step} answer={answer} setAnswer={setAnswer} selectAnswer={selectAnswer} revealed={revealed} setRevealed={setRevealed} /><button className="portal-button mt-8" disabled={(needsSelection && !answer) || riddleIsIncorrect} onClick={next}>{stepIndex === adventure.steps.length - 1 ? 'Reveal Saturday' : 'Lock choice'} <ArrowRight /></button></div></main></Shell>
}
function ChallengeBody({ step, answer, setAnswer, selectAnswer, revealed, setRevealed }: { step: ChallengeStep; answer: string; setAnswer: (v: string) => void; selectAnswer: (v: string) => void; revealed: boolean; setRevealed: (v: boolean) => void }) {
  if (step.type === 'choice') return <div className="option-grid">{step.options.map((option) => <button key={option} className={`choice ${answer === option ? 'selected' : ''}`} aria-pressed={answer === option} onClick={() => selectAnswer(option)}>{option}<span>{answer === option ? 'Selected' : 'Choose'}</span></button>)}</div>
  if (step.type === 'mystery') return <div className="option-grid mystery-grid">{step.cards.map((card) => { const selected = answer === card.label; return <button key={card.label} className={`mystery-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => selectAnswer(card.label)}><span className="mystery-mark">{selected ? '✓' : '?'}</span><strong>{selected && revealed ? card.reveal : card.label}</strong>{selected && step.concealUntilComplete && <small>Meaning hidden until the final reveal</small>}</button> })}</div>
  if (step.type === 'riddle') return <div className="riddle-box"><p>{step.clue}</p><label htmlFor="answer">Your answer</label><input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type what you think..." /></div>
  if (step.type === 'reveal') return <div className="reveal-box"><Sparkles /><p>{step.message}</p></div>
  return <div className="confirm-box"><BookOpen /><p>{step.type === 'activity' ? step.detail : step.prompt}</p>{step.type === 'confirm' && <button className="text-button" onClick={() => setRevealed(true)}>{step.button}</button>}</div>
}
function Completion({ adventure }: { adventure: Adventure }) {
  const navigate = useNavigate()
  const progress = useStoredProgress()[adventure.slug]
  const [dbAnswers, setDbAnswers] = useState<Record<string, string> | null>(null)

  // Pull the stored result back out of the database so the choices still show
  // even if this browser's local progress was cleared.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/quests/${adventure.slug}/completion`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.completion?.answers) setDbAnswers(data.completion.answers)
      })
      .catch((error) => console.error('Failed to load stored completion', error))
    return () => {
      cancelled = true
    }
  }, [adventure.slug])

  const answers = dbAnswers ?? progress?.answers

  const outcomes = useMemo(() => adventure.steps.flatMap((step) => {
    if (step.type !== 'mystery') return []
    const selected = step.cards.find((card) => card.label === answers?.[step.id])
    return selected?.outcome ? [{ choice: selected.label, outcome: selected.outcome }] : []
  }), [adventure.steps, answers])

  const redo = () => {
    resetAdventureProgress(adventure.slug)
    navigate(`/quest/${adventure.slug}/play`)
  }

  return <Shell><main className="relative z-10 mx-auto max-w-3xl px-5 pb-20"><div className="completion-panel"><div className="completion-star">✦</div><p className="eyebrow">Quest complete</p><h1>Saturday unlocked.</h1><p className="challenge-prompt">{adventure.completionMessage}</p>{outcomes.length > 0 ? <div className="outcome-list">{outcomes.map((result, index) => <div className="outcome-stop" key={result.choice}><span>Stop {String(index + 1).padStart(2, '0')} · {result.choice}</span><strong>{result.outcome}</strong></div>)}</div> : <div className="final-note">{adventure.reward}</div>}{outcomes.length > 0 && adventure.reward && <div className="route-status">{adventure.reward}</div>}<div className="flex flex-wrap justify-center gap-3"><Link className="portal-button" to="/">Return to portal</Link><Link className="secondary-button" to="/archive">View archive</Link><button type="button" className="secondary-button" onClick={redo}><RotateCcw /> Redo this quest</button></div></div></main></Shell>
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

function AppRoutes() { return <Routes><Route path="/" element={<Portal />} /><Route path="/quest-log" element={<QuestLog />} /><Route path="/quests" element={<Navigate to="/quest-log" replace />} /><Route path="/archive" element={<Archive />} /><Route path="/quest/:slug" element={<QuestIntroRoute />} /><Route path="/quest/:slug/play" element={<ChallengeRoute />} /><Route path="/quest/:slug/complete" element={<CompletionRoute />} /></Routes> }

function App({ initialPath = '/' }: { initialPath?: string }) {
  // Keep one router mounted for the lifetime of the app so the CRT boot
  // sequence is not restarted when hydration completes.
  return <MemoryRouter initialEntries={[initialPath]}><BrowserUrlSync /><AppRoutes /></MemoryRouter>
}
function RouteAdventure({ children }: { children: (a: Adventure) => React.ReactNode }) { const { slug } = useParams(); const adventure = useMemo(() => getAdventure(slug || ''), [slug]); if (!adventure || adventure.status === 'coming-soon') return <Portal />; return <>{children(adventure)}</> }
const QuestIntroRoute = () => <RouteAdventure>{(a) => <Intro adventure={a} />}</RouteAdventure>; const ChallengeRoute = () => <RouteAdventure>{(a) => <Challenge adventure={a} />}</RouteAdventure>; const CompletionRoute = () => <RouteAdventure>{(a) => <Completion adventure={a} />}</RouteAdventure>
export default App

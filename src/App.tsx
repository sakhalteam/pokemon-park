import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchMany } from './api'
import { ROSTER, PARK_CAPACITY, PARK_WIDTH, PARK_HEIGHT } from './roster'
import type { PokemonData, ParkPokemon, TimeOfDay } from './types'
import Park from './Park'
import PokemonCard from './PokemonCard'

/* ── helpers ─────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomPos() {
  const pad = 80
  return {
    x: pad + Math.random() * (PARK_WIDTH - pad * 2),
    y: pad + Math.random() * (PARK_HEIGHT - pad * 2),
  }
}

function makeParkPokemon(data: PokemonData, pinned = false): ParkPokemon {
  const pos = randomPos()
  const target = randomPos()
  return {
    id: data.id,
    data,
    ...pos,
    targetX: target.x,
    targetY: target.y,
    facingLeft: target.x < pos.x,
    state: 'idle',
    idleTimer: 1000 + Math.random() * 2000,
    pinned,
  }
}

/* ── HomeBtn ─────────────────────────────────────────── */

function HomeBtn() {
  return (
    <a
      href="https://sakhalteam.github.io/"
      className="home-btn"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        width="18" height="18">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M9 21V12h6v9" />
      </svg>
      sakhalteam
    </a>
  )
}

/* ── App ─────────────────────────────────────────────── */

export default function App() {
  const [allData, setAllData] = useState<Map<number, PokemonData>>(new Map())
  const [parkPokemon, setParkPokemon] = useState<ParkPokemon[]>([])
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const loadedRef = useRef(false)

  // Initial data fetch
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    async function load() {
      const ids = ROSTER.map(([id]) => id)
      const dataMap = new Map<number, PokemonData>()
      const batchSize = 8

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize)
        const results = await fetchMany(batch)
        results.forEach(d => dataMap.set(d.id, d))
        setLoadProgress(Math.min(100, Math.round(((i + batch.length) / ids.length) * 100)))
      }

      setAllData(dataMap)

      // Pick initial park inhabitants
      const shuffled = shuffle(Array.from(dataMap.values()))
      const initial = shuffled.slice(0, PARK_CAPACITY).map(d => makeParkPokemon(d))
      setParkPokemon(initial)
      setLoading(false)
    }

    load()
  }, [])

  // Shuffle park (day/night cycle)
  const cycleDayNight = useCallback(() => {
    const next: TimeOfDay = timeOfDay === 'day' ? 'night' : 'day'
    setTimeOfDay(next)

    setParkPokemon(prev => {
      const pinned = prev.filter(p => p.pinned)
      const pinnedIds = new Set(pinned.map(p => p.id))
      const available = Array.from(allData.values()).filter(d => !pinnedIds.has(d.id))
      const shuffled = shuffle(available)
      const newOnes = shuffled.slice(0, PARK_CAPACITY - pinned.length).map(d => makeParkPokemon(d))
      return [...pinned.map(p => ({ ...p, ...randomPos(), state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000 })), ...newOnes]
    })
  }, [timeOfDay, allData])

  // Toggle pin
  const togglePin = useCallback((id: number) => {
    setParkPokemon(prev => prev.map(p =>
      p.id === id ? { ...p, pinned: !p.pinned } : p
    ))
  }, [])

  const focusedPokemon = focusedId !== null ? parkPokemon.find(p => p.id === focusedId) : null

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-pokeball" />
        <p className="loading-text">Waking up the park residents...</p>
        <div className="loading-bar-track">
          <div className="loading-bar-fill" style={{ width: `${loadProgress}%` }} />
        </div>
        <p className="loading-pct">{loadProgress}%</p>
      </div>
    )
  }

  return (
    <div className={`app ${timeOfDay}`}>
      <HomeBtn />

      <header className="park-header">
        <h1>Pokemon Park</h1>
        <div className="header-controls">
          <button
            className="cycle-btn"
            onClick={cycleDayNight}
            title={timeOfDay === 'day' ? 'Skip to night' : 'Skip to day'}
          >
            {timeOfDay === 'day' ? '🌙' : '☀️'}
            <span>{timeOfDay === 'day' ? 'Night' : 'Day'}</span>
          </button>
        </div>
      </header>

      <Park
        pokemon={parkPokemon}
        setPokemon={setParkPokemon}
        onClickPokemon={setFocusedId}
        timeOfDay={timeOfDay}
      />

      {focusedPokemon && (
        <PokemonCard
          pokemon={focusedPokemon}
          onClose={() => setFocusedId(null)}
          onTogglePin={() => togglePin(focusedPokemon.id)}
        />
      )}
    </div>
  )
}

import { useRef, useEffect, useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { PARK_WIDTH, PARK_HEIGHT } from './roster'
import type { ParkPokemon, TimeOfDay, Gathering, FlowerParticle } from './types'

interface Props {
  pokemon: ParkPokemon[]
  setPokemon: Dispatch<SetStateAction<ParkPokemon[]>>
  onClickPokemon: (id: number) => void
  timeOfDay: TimeOfDay
}

const SPEED = 0.4
const GATHER_RADIUS = 100
const GATHER_CIRCLE_RADIUS = 50
const FLOWER_EMOJIS = ['🌸', '🌼', '🌺', '🌷', '🌻', '✨', '💫', '🎶']

let gatheringIdCounter = 0
let flowerIdCounter = 0

function randomTarget() {
  const pad = 80
  return {
    targetX: pad + Math.random() * (PARK_WIDTH - pad * 2),
    targetY: pad + Math.random() * (PARK_HEIGHT - pad * 2),
  }
}

function spawnFlowers(cx: number, cy: number, count: number): FlowerParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: ++flowerIdCounter,
    x: cx + (Math.random() - 0.5) * 120,
    y: cy + (Math.random() - 0.5) * 120,
    emoji: FLOWER_EMOJIS[Math.floor(Math.random() * FLOWER_EMOJIS.length)],
    delay: i * 0.15 + Math.random() * 0.3,
    duration: 1.5 + Math.random() * 1,
  }))
}

/** Recalculate circle positions for all pokemon in a gathering */
function recalcCircle(
  gatheringPokemonIds: number[],
  cx: number,
  cy: number,
  prev: ParkPokemon[],
  gId: number,
): ParkPokemon[] {
  const angleStep = (Math.PI * 2) / gatheringPokemonIds.length
  const idSet = new Set(gatheringPokemonIds)
  return prev.map(p => {
    if (!idSet.has(p.id)) return p
    const idx = gatheringPokemonIds.indexOf(p.id)
    const angle = angleStep * idx - Math.PI / 2
    return {
      ...p,
      state: 'gathering' as const,
      gatheringId: gId,
      targetX: cx + Math.cos(angle) * GATHER_CIRCLE_RADIUS,
      targetY: cy + Math.sin(angle) * GATHER_CIRCLE_RADIUS,
    }
  })
}

export default function Park({ pokemon, setPokemon, onClickPokemon, timeOfDay }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const scrollStart = useRef({ x: 0, y: 0 })
  const animRef = useRef<number>(0)

  const [heldId, setHeldId] = useState<number | null>(null)
  const heldRef = useRef<number | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const hasDragged = useRef(false)

  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const gatheringsRef = useRef<Gathering[]>([])
  const gatheringIntervals = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())

  useEffect(() => { heldRef.current = heldId }, [heldId])
  useEffect(() => { gatheringsRef.current = gatherings }, [gatherings])

  // Cleanup intervals on unmount
  useEffect(() => {
    const intervals = gatheringIntervals.current
    return () => intervals.forEach(i => clearInterval(i))
  }, [])

  /** Add a pokemon to an existing gathering (recalculate circle) */
  const joinGathering = useCallback((gId: number, pokemonId: number) => {
    setGatherings(gs => gs.map(g => {
      if (g.id !== gId || g.pokemonIds.includes(pokemonId)) return g
      const newIds = [...g.pokemonIds, pokemonId]
      return { ...g, pokemonIds: newIds, flowers: [...g.flowers, ...spawnFlowers(g.centerX, g.centerY, 4)] }
    }))
    setPokemon(prev => {
      const g = gatheringsRef.current.find(g => g.id === gId)
      if (!g) return prev
      const newIds = g.pokemonIds.includes(pokemonId) ? g.pokemonIds : [...g.pokemonIds, pokemonId]
      return recalcCircle(newIds, g.centerX, g.centerY, prev, gId)
    })
  }, [setPokemon])

  /** Start a brand new gathering */
  const startGathering = useCallback((pokemonIds: number[], cx: number, cy: number) => {
    const gId = ++gatheringIdCounter
    const newGathering: Gathering = {
      id: gId,
      centerX: cx,
      centerY: cy,
      pokemonIds: pokemonIds,
      startTime: Date.now(),
      flowers: spawnFlowers(cx, cy, 8),
    }
    setGatherings(g => [...g, newGathering])

    const flowerInterval = setInterval(() => {
      setGatherings(gs => {
        const g = gs.find(g => g.id === gId)
        if (!g) { clearInterval(flowerInterval); return gs }
        // Cap flowers at 30 to avoid unbounded growth
        const trimmed = g.flowers.length > 30 ? g.flowers.slice(-20) : g.flowers
        return gs.map(g => g.id === gId ? { ...g, flowers: [...trimmed, ...spawnFlowers(g.centerX, g.centerY, 2)] } : g)
      })
    }, 3000)
    gatheringIntervals.current.set(gId, flowerInterval)

    setPokemon(prev => recalcCircle(pokemonIds, cx, cy, prev, gId))
  }, [setPokemon])

  /** Remove a single pokemon from a gathering. Dissolve if < 2 remain. */
  const leaveGathering = useCallback((gId: number, pokemonId: number) => {
    setGatherings(gs => {
      return gs.map(g => {
        if (g.id !== gId) return g
        const remaining = g.pokemonIds.filter(id => id !== pokemonId)
        if (remaining.length < 2) {
          // Dissolve gathering
          const interval = gatheringIntervals.current.get(gId)
          if (interval) { clearInterval(interval); gatheringIntervals.current.delete(gId) }
          return null as unknown as Gathering
        }
        return { ...g, pokemonIds: remaining }
      }).filter(Boolean)
    })

    setPokemon(prev => {
      const g = gatheringsRef.current.find(g => g.id === gId)
      if (!g) return prev
      const remaining = g.pokemonIds.filter(id => id !== pokemonId)

      if (remaining.length < 2) {
        // Free everyone
        return prev.map(p =>
          p.gatheringId === gId
            ? { ...p, state: 'idle' as const, idleTimer: 500 + Math.random() * 1000, gatheringId: undefined }
            : p
        )
      }

      // Recalculate circle for remaining pokemon
      const updated = recalcCircle(remaining, g.centerX, g.centerY, prev, gId)
      // Free the leaving pokemon
      return updated.map(p =>
        p.id === pokemonId
          ? { ...p, state: 'idle' as const, gatheringId: undefined, idleTimer: 500 }
          : p
      )
    })
  }, [setPokemon])

  // === Pan handlers ===
  const onBgPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.park-sprite')) return
    if ((e.target as HTMLElement).closest('.gathering-flower')) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    const el = containerRef.current!
    scrollStart.current = { x: el.scrollLeft, y: el.scrollTop }
    el.setPointerCapture(e.pointerId)
  }, [])

  const onBgPointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      const el = containerRef.current!
      el.scrollLeft = scrollStart.current.x - dx
      el.scrollTop = scrollStart.current.y - dy
      return
    }

    if (heldRef.current !== null) {
      hasDragged.current = true
      const el = containerRef.current!
      const rect = el.getBoundingClientRect()
      const parkX = e.clientX - rect.left + el.scrollLeft - dragOffset.current.x
      const parkY = e.clientY - rect.top + el.scrollTop - dragOffset.current.y
      const clampedX = Math.max(20, Math.min(PARK_WIDTH - 20, parkX))
      const clampedY = Math.max(20, Math.min(PARK_HEIGHT - 20, parkY))

      setPokemon(prev => prev.map(p =>
        p.id === heldRef.current
          ? { ...p, x: clampedX, y: clampedY, targetX: clampedX, targetY: clampedY }
          : p
      ))
    }
  }, [setPokemon])

  const onBgPointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanning.current) {
      isPanning.current = false
      containerRef.current?.releasePointerCapture(e.pointerId)
      return
    }

    if (heldRef.current !== null) {
      const droppedId = heldRef.current
      setHeldId(null)

      if (!hasDragged.current) {
        onClickPokemon(droppedId)
        setPokemon(prev => prev.map(p =>
          p.id === droppedId ? { ...p, state: 'idle' as const, idleTimer: 2000 } : p
        ))
        return
      }

      setPokemon(prev => {
        const dropped = prev.find(p => p.id === droppedId)
        if (!dropped) return prev

        // Check if dropped near an existing gathering → join it
        for (const g of gatheringsRef.current) {
          if (Math.hypot(dropped.x - g.centerX, dropped.y - g.centerY) < GATHER_RADIUS) {
            joinGathering(g.id, droppedId)
            return prev // joinGathering handles the state update
          }
        }

        // Check for nearby free pokemon to start a new gathering
        const nearby = prev.filter(p =>
          p.id !== droppedId &&
          p.state !== 'held' &&
          p.state !== 'gathering' &&
          Math.hypot(p.x - dropped.x, p.y - dropped.y) < GATHER_RADIUS
        )

        if (nearby.length > 0) {
          const gatherGroup = [dropped, ...nearby]
          const cx = gatherGroup.reduce((s, p) => s + p.x, 0) / gatherGroup.length
          const cy = gatherGroup.reduce((s, p) => s + p.y, 0) / gatherGroup.length
          startGathering(gatherGroup.map(p => p.id), cx, cy)
          return prev // startGathering handles the state update
        }

        // No nearby — just drop and idle
        return prev.map(p =>
          p.id === droppedId
            ? { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000 }
            : p
        )
      })
    }
  }, [onClickPokemon, setPokemon, joinGathering, startGathering])

  // === Sprite pointer handlers ===
  const onSpritePointerDown = useCallback((e: React.PointerEvent, pId: number) => {
    e.stopPropagation()
    e.preventDefault()
    hasDragged.current = false

    // If this pokemon is in a gathering, remove just this one
    setPokemon(prev => {
      const p = prev.find(pk => pk.id === pId)
      if (p?.gatheringId) {
        leaveGathering(p.gatheringId, pId)
      }
      return prev
    })

    const el = containerRef.current!
    const rect = el.getBoundingClientRect()

    setPokemon(prev => {
      const p = prev.find(pk => pk.id === pId)
      if (p) {
        const spriteScreenX = p.x - el.scrollLeft + rect.left
        const spriteScreenY = p.y - el.scrollTop + rect.top
        dragOffset.current = {
          x: e.clientX - spriteScreenX,
          y: e.clientY - spriteScreenY,
        }
      }
      return prev.map(pk =>
        pk.id === pId ? { ...pk, state: 'held' as const, gatheringId: undefined } : pk
      )
    })

    setHeldId(pId)
    el.setPointerCapture(e.pointerId)
  }, [setPokemon, leaveGathering])

  // === Animation loop ===
  useEffect(() => {
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = now - lastTime
      lastTime = now

      setPokemon(prev => {
        let updated = prev.map(p => {
          if (p.state === 'held') return p

          // Gathering: walk to circle position
          if (p.state === 'gathering') {
            const dx = p.targetX - p.x
            const dy = p.targetY - p.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 2) return { ...p, x: p.targetX, y: p.targetY }
            const step = Math.min(SPEED * 1.5 * (dt / 16), dist)
            return {
              ...p,
              x: p.x + (dx / dist) * step,
              y: p.y + (dy / dist) * step,
              facingLeft: dx < 0,
            }
          }

          if (p.state === 'idle') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }
            const t = randomTarget()
            return { ...p, ...t, state: 'walking' as const, facingLeft: t.targetX < p.x }
          }

          // Walking
          const dx = p.targetX - p.x
          const dy = p.targetY - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 4) {
            return {
              ...p,
              x: p.targetX,
              y: p.targetY,
              state: 'idle' as const,
              idleTimer: 2000 + Math.random() * 4000,
            }
          }

          const step = Math.min(SPEED * (dt / 16), dist)
          return {
            ...p,
            x: p.x + (dx / dist) * step,
            y: p.y + (dy / dist) * step,
            facingLeft: dx < 0,
          }
        })

        // Check if any walking/idle pokemon wandered near a gathering → suck them in
        for (const g of gatheringsRef.current) {
          for (const p of updated) {
            if (p.state !== 'walking' && p.state !== 'idle') continue
            if (p.gatheringId) continue
            const dist = Math.hypot(p.x - g.centerX, p.y - g.centerY)
            if (dist < GATHER_RADIUS * 0.7) {
              // Suck them in!
              const newIds = [...g.pokemonIds, p.id]
              // Update gathering state (we'll let the next render pick it up)
              setGatherings(gs => gs.map(gg =>
                gg.id === g.id
                  ? { ...gg, pokemonIds: newIds, flowers: [...gg.flowers, ...spawnFlowers(gg.centerX, gg.centerY, 3)] }
                  : gg
              ))
              const angleStep = (Math.PI * 2) / newIds.length
              updated = updated.map(pk => {
                if (pk.id === p.id) {
                  const idx = newIds.indexOf(pk.id)
                  const angle = angleStep * idx - Math.PI / 2
                  return {
                    ...pk,
                    state: 'gathering' as const,
                    gatheringId: g.id,
                    targetX: g.centerX + Math.cos(angle) * GATHER_CIRCLE_RADIUS,
                    targetY: g.centerY + Math.sin(angle) * GATHER_CIRCLE_RADIUS,
                  }
                }
                // Also recalc existing members' positions
                if (pk.gatheringId === g.id) {
                  const idx = newIds.indexOf(pk.id)
                  const angle = angleStep * idx - Math.PI / 2
                  return {
                    ...pk,
                    targetX: g.centerX + Math.cos(angle) * GATHER_CIRCLE_RADIUS,
                    targetY: g.centerY + Math.sin(angle) * GATHER_CIRCLE_RADIUS,
                  }
                }
                return pk
              })
              break // one join per tick to keep it clean
            }
          }
        }

        return updated
      })

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [setPokemon])

  // Center viewport on load
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollLeft = (PARK_WIDTH - el.clientWidth) / 2
    el.scrollTop = (PARK_HEIGHT - el.clientHeight) / 2
  }, [])

  return (
    <div
      ref={containerRef}
      className={`park-viewport ${timeOfDay}`}
      onPointerDown={onBgPointerDown}
      onPointerMove={onBgPointerMove}
      onPointerUp={onBgPointerUp}
      style={{ touchAction: 'none' }}
    >
      <div className="park-world" style={{ width: PARK_WIDTH, height: PARK_HEIGHT }}>
        {/* Decorative elements */}
        <div className="park-deco tree" style={{ left: 200, top: 300 }}>🌳</div>
        <div className="park-deco tree" style={{ left: 1800, top: 200 }}>🌲</div>
        <div className="park-deco tree" style={{ left: 600, top: 1200 }}>🌳</div>
        <div className="park-deco tree" style={{ left: 1400, top: 900 }}>🌲</div>
        <div className="park-deco tree" style={{ left: 2100, top: 1100 }}>🌳</div>
        <div className="park-deco tree" style={{ left: 400, top: 700 }}>🌲</div>
        <div className="park-deco bench" style={{ left: 1000, top: 600 }}>🪑</div>
        <div className="park-deco bench" style={{ left: 1600, top: 1300 }}>🪑</div>
        <div className="park-deco pond" style={{ left: 1100, top: 900 }}>💧</div>
        <div className="park-deco flower" style={{ left: 300, top: 1000 }}>🌸</div>
        <div className="park-deco flower" style={{ left: 900, top: 400 }}>🌼</div>
        <div className="park-deco flower" style={{ left: 2000, top: 700 }}>🌷</div>
        <div className="park-deco flower" style={{ left: 700, top: 200 }}>🌻</div>

        {/* Gathering flower particles */}
        {gatherings.map(g => (
          g.flowers.map(f => (
            <div
              key={f.id}
              className="gathering-flower"
              style={{
                left: f.x,
                top: f.y,
                animationDelay: `${f.delay}s`,
                animationDuration: `${f.duration}s`,
              }}
            >
              {f.emoji}
            </div>
          ))
        ))}

        {/* Gathering circle indicators */}
        {gatherings.map(g => (
          <div
            key={`ring-${g.id}`}
            className="gathering-ring"
            style={{
              left: g.centerX,
              top: g.centerY,
            }}
          />
        ))}

        {/* Pokemon sprites */}
        {pokemon.map(p => (
          <div
            key={p.id}
            className={`park-sprite ${p.state} ${p.pinned ? 'pinned' : ''}`}
            style={{
              left: p.x,
              top: p.y,
              transform: `translate(-50%, -50%) scaleX(${p.facingLeft ? -1 : 1})`,
              zIndex: p.state === 'held' ? 50 : 10,
            }}
            onPointerDown={(e) => onSpritePointerDown(e, p.id)}
          >
            <span
              className="sprite-name"
              style={p.facingLeft ? { transform: 'translateX(-50%) scaleX(-1)' } : undefined}
            >
              {p.data.name}
            </span>
            {p.pinned && <span className="pin-badge">📌</span>}
            <img
              src={p.data.spriteUrl}
              alt={p.data.name}
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

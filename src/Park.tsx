import { useRef, useEffect, useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { PARK_WIDTH, PARK_HEIGHT } from './roster'
import type { ParkPokemon, TimeOfDay, Gathering, FlowerParticle } from './types'

interface Props {
  pokemon: ParkPokemon[]
  setPokemon: Dispatch<SetStateAction<ParkPokemon[]>>
  onClickPokemon: (id: number) => void
  timeOfDay: TimeOfDay
}

const SPEED = 0.4 // px per frame (~24px/sec)
const GATHER_RADIUS = 100 // drop within this distance to start a gathering
const GATHER_CIRCLE_RADIUS = 50 // how far apart they stand in the circle
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

export default function Park({ pokemon, setPokemon, onClickPokemon, timeOfDay }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const scrollStart = useRef({ x: 0, y: 0 })
  const animRef = useRef<number>(0)

  // Drag state
  const [heldId, setHeldId] = useState<number | null>(null)
  const heldRef = useRef<number | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const hasDragged = useRef(false)

  // Gatherings
  const [gatherings, setGatherings] = useState<Gathering[]>([])

  // Keep heldRef in sync
  useEffect(() => { heldRef.current = heldId }, [heldId])

  // === Pan: mouse/touch drag on background ===
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

    // Dragging a pokemon
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

    // Drop a held pokemon
    if (heldRef.current !== null) {
      const droppedId = heldRef.current
      setHeldId(null)

      if (!hasDragged.current) {
        // It was a click, not a drag — open card
        onClickPokemon(droppedId)
        setPokemon(prev => prev.map(p =>
          p.id === droppedId ? { ...p, state: 'idle' as const, idleTimer: 2000 } : p
        ))
        return
      }

      // Check for nearby pokemon to form a gathering
      setPokemon(prev => {
        const dropped = prev.find(p => p.id === droppedId)
        if (!dropped) return prev

        // Find nearby non-held, non-gathering pokemon
        const nearby = prev.filter(p =>
          p.id !== droppedId &&
          p.state !== 'held' &&
          Math.hypot(p.x - dropped.x, p.y - dropped.y) < GATHER_RADIUS
        )

        if (nearby.length > 0) {
          // Start a gathering!
          const gatherGroup = [dropped, ...nearby]
          const gId = ++gatheringIdCounter

          // Calculate center of the group
          const cx = gatherGroup.reduce((s, p) => s + p.x, 0) / gatherGroup.length
          const cy = gatherGroup.reduce((s, p) => s + p.y, 0) / gatherGroup.length

          // Arrange in a circle
          const angleStep = (Math.PI * 2) / gatherGroup.length
          const updatedIds = new Set(gatherGroup.map(p => p.id))

          // Spawn gathering with flowers
          const newGathering: Gathering = {
            id: gId,
            centerX: cx,
            centerY: cy,
            pokemonIds: gatherGroup.map(p => p.id),
            startTime: Date.now(),
            flowers: spawnFlowers(cx, cy, 12),
          }

          setGatherings(g => [...g, newGathering])

          // Continuously spawn more flowers
          const flowerInterval = setInterval(() => {
            setGatherings(gs => gs.map(g =>
              g.id === gId
                ? { ...g, flowers: [...g.flowers, ...spawnFlowers(g.centerX, g.centerY, 4)] }
                : g
            ))
          }, 2000)

          // Store interval for cleanup
          gatheringIntervals.current.set(gId, flowerInterval)

          return prev.map(p => {
            if (!updatedIds.has(p.id)) return p
            const idx = gatherGroup.findIndex(gp => gp.id === p.id)
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

        // No nearby pokemon — just drop and idle
        return prev.map(p =>
          p.id === droppedId
            ? { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000 }
            : p
        )
      })
    }
  }, [onClickPokemon, setPokemon])

  // Interval refs for gathering flower spawns
  const gatheringIntervals = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())

  // Cleanup gathering intervals on unmount
  useEffect(() => {
    const intervals = gatheringIntervals.current
    return () => intervals.forEach(i => clearInterval(i))
  }, [])

  // === Sprite pointer handlers ===
  const onSpritePointerDown = useCallback((e: React.PointerEvent, pId: number) => {
    e.stopPropagation()
    e.preventDefault()
    hasDragged.current = false

    // If this pokemon is in a gathering, break it up
    setPokemon(prev => {
      const p = prev.find(pk => pk.id === pId)
      if (p?.gatheringId) {
        const gId = p.gatheringId
        // Clear interval
        const interval = gatheringIntervals.current.get(gId)
        if (interval) { clearInterval(interval); gatheringIntervals.current.delete(gId) }
        // Remove gathering
        setGatherings(gs => gs.filter(g => g.id !== gId))
        // Free all pokemon from this gathering
        return prev.map(pk =>
          pk.gatheringId === gId
            ? { ...pk, state: 'idle' as const, idleTimer: 500 + Math.random() * 1000, gatheringId: undefined }
            : pk
        )
      }
      return prev
    })

    const el = containerRef.current!
    const rect = el.getBoundingClientRect()

    // Calculate offset from pointer to sprite center
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
        pk.id === pId ? { ...pk, state: 'held' as const } : pk
      )
    })

    setHeldId(pId)
    el.setPointerCapture(e.pointerId)
  }, [setPokemon])

  // === Animation loop ===
  useEffect(() => {
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = now - lastTime
      lastTime = now

      setPokemon(prev => prev.map(p => {
        // Held pokemon don't move on their own
        if (p.state === 'held') return p

        // Gathering pokemon walk to their circle position then dance
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
      }))

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
            className={`park-sprite ${p.state} ${p.pinned ? 'pinned' : ''} ${p.state === 'held' ? 'held' : ''} ${p.state === 'gathering' ? 'gathering' : ''}`}
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

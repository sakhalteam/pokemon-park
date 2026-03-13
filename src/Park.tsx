import { useRef, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import { PARK_WIDTH, PARK_HEIGHT } from './roster'
import type { ParkPokemon, TimeOfDay } from './types'

interface Props {
  pokemon: ParkPokemon[]
  setPokemon: Dispatch<SetStateAction<ParkPokemon[]>>
  onClickPokemon: (id: number) => void
  timeOfDay: TimeOfDay
}

const SPEED = 0.4 // px per frame (~24px/sec)

function randomTarget() {
  const pad = 80
  return {
    targetX: pad + Math.random() * (PARK_WIDTH - pad * 2),
    targetY: pad + Math.random() * (PARK_HEIGHT - pad * 2),
  }
}

export default function Park({ pokemon, setPokemon, onClickPokemon, timeOfDay }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const scrollStart = useRef({ x: 0, y: 0 })
  const animRef = useRef<number>(0)
  const clickedRef = useRef(false)

  // Pan: mouse/touch drag
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only pan from the park background, not from sprites
    if ((e.target as HTMLElement).closest('.park-sprite')) return
    isDragging.current = true
    clickedRef.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    const el = containerRef.current!
    scrollStart.current = { x: el.scrollLeft, y: el.scrollTop }
    el.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) clickedRef.current = false
    const el = containerRef.current!
    el.scrollLeft = scrollStart.current.x - dx
    el.scrollTop = scrollStart.current.y - dy
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false
    containerRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  // Animation loop for wandering
  useEffect(() => {
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = now - lastTime
      lastTime = now

      setPokemon(prev => prev.map(p => {
        if (p.state === 'idle') {
          const remaining = p.idleTimer - dt
          if (remaining > 0) return { ...p, idleTimer: remaining }
          // Start walking to a new target
          const t = randomTarget()
          return { ...p, ...t, state: 'walking' as const, facingLeft: t.targetX < p.x }
        }

        // Walking
        const dx = p.targetX - p.x
        const dy = p.targetY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 4) {
          // Arrived — go idle
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

  // Center the viewport on load
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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

        {pokemon.map(p => (
          <div
            key={p.id}
            className={`park-sprite ${p.state} ${p.pinned ? 'pinned' : ''}`}
            style={{
              left: p.x,
              top: p.y,
              transform: `translate(-50%, -50%) scaleX(${p.facingLeft ? -1 : 1})`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              onClickPokemon(p.id)
            }}
          >
            <span className="sprite-name">{p.data.name}</span>
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

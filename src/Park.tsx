import { useRef, useEffect, useCallback, useState, useMemo, type Dispatch, type SetStateAction } from 'react'
import { PARK_WIDTH, PARK_HEIGHT } from './roster'
import { PARK_OBJECTS } from './parkObjects'
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
const NIGHT_PARTICLE_EMOJIS = ['✨', '⭐', '🌙', '💫', '🪷', '🌟']
const LANTERN_ATTRACT_CHANCE = 0.08 // chance per idle tick to redirect toward a lantern
const SMELL_DURATION = 3000 + Math.random() * 2000
const SIT_DURATION = 8000 + Math.random() * 6000
const EAT_DURATION = 8000 + Math.random() * 5000 // eating takes 8-13s
const FOOD_RESPAWN_DELAY = 15000 // 15s before food reappears elsewhere
const DROP_INTERACT_RADIUS = 70 // radius for drop-on-object interactions
const INTERACT_CHANCE = 0.4 // 40% chance to interact when walking past

let gatheringIdCounter = 0
let flowerIdCounter = 0

function randomTarget() {
  const pad = 80
  return {
    targetX: pad + Math.random() * (PARK_WIDTH - pad * 2),
    targetY: pad + Math.random() * (PARK_HEIGHT - pad * 2),
  }
}

function spawnFlowers(cx: number, cy: number, count: number, isNight = false): FlowerParticle[] {
  const emojis = isNight ? NIGHT_PARTICLE_EMOJIS : FLOWER_EMOJIS
  return Array.from({ length: count }, (_, i) => ({
    id: ++flowerIdCounter,
    x: cx + (Math.random() - 0.5) * 120,
    y: cy + (Math.random() - 0.5) * 120,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    delay: i * 0.15 + Math.random() * 0.3,
    duration: isNight ? 2 + Math.random() * 1.5 : 1.5 + Math.random() * 1,
  }))
}

function recalcCircle(
  pokemonIds: number[], cx: number, cy: number, prev: ParkPokemon[], gId: number,
): ParkPokemon[] {
  const angleStep = (Math.PI * 2) / pokemonIds.length
  const idSet = new Set(pokemonIds)
  return prev.map(p => {
    if (!idSet.has(p.id)) return p
    const idx = pokemonIds.indexOf(p.id)
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

  // Gathering drag state
  const heldGatheringRef = useRef<number | null>(null)
  const gatherDragStart = useRef<{ cx: number; cy: number; positions: Map<number, { x: number; y: number }> } | null>(null)

  // Food items that have been eaten (hidden until respawn)
  const [hiddenFood, setHiddenFood] = useState<Set<string>>(new Set())

  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const gatheringsRef = useRef<Gathering[]>([])
  const gatheringIntervals = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())

  // Track which objects are currently being interacted with to prevent dogpiling
  const occupiedObjects = useRef<Set<string>>(new Set())

  useEffect(() => { heldRef.current = heldId }, [heldId])
  useEffect(() => { gatheringsRef.current = gatherings }, [gatherings])
  useEffect(() => {
    const intervals = gatheringIntervals.current
    return () => intervals.forEach(i => clearInterval(i))
  }, [])

  // Keep occupiedObjects in sync
  useEffect(() => {
    const occ = new Set<string>()
    for (const p of pokemon) {
      if (p.interactingWith) occ.add(p.interactingWith)
    }
    occupiedObjects.current = occ
  }, [pokemon])

  // Interactive park objects
  const interactiveFlowers = useMemo(() => PARK_OBJECTS.filter(o => o.type === 'flower' && o.interactive), [])
  const interactiveBenches = useMemo(() => PARK_OBJECTS.filter(o => o.type === 'bench' && o.interactive), [])
  const interactiveFood = useMemo(() => PARK_OBJECTS.filter(o => (o.type === 'mushroom' || o.type === 'berry') && o.interactive), [])
  const lanterns = useMemo(() => PARK_OBJECTS.filter(o => o.type === 'lamp'), [])
  const timeOfDayRef = useRef(timeOfDay)
  useEffect(() => { timeOfDayRef.current = timeOfDay }, [timeOfDay])

  // === Gathering helpers ===
  const joinGathering = useCallback((gId: number, pokemonId: number) => {
    setGatherings(gs => gs.map(g => {
      if (g.id !== gId || g.pokemonIds.includes(pokemonId)) return g
      const newIds = [...g.pokemonIds, pokemonId]
      return { ...g, pokemonIds: newIds, flowers: [...g.flowers, ...spawnFlowers(g.centerX, g.centerY, g.isNight ? 3 : 5, g.isNight)] }
    }))
    setPokemon(prev => {
      const g = gatheringsRef.current.find(g => g.id === gId)
      if (!g) return prev
      const newIds = g.pokemonIds.includes(pokemonId) ? g.pokemonIds : [...g.pokemonIds, pokemonId]
      return recalcCircle(newIds, g.centerX, g.centerY, prev, gId)
    })
  }, [setPokemon])

  const startGathering = useCallback((pokemonIds: number[], cx: number, cy: number, night = false) => {
    const gId = ++gatheringIdCounter
    const newGathering: Gathering = {
      id: gId, centerX: cx, centerY: cy,
      pokemonIds, startTime: Date.now(),
      flowers: spawnFlowers(cx, cy, night ? 8 : 12, night),
      isNight: night,
    }
    setGatherings(g => [...g, newGathering])

    const flowerInterval = setInterval(() => {
      setGatherings(gs => {
        const g = gs.find(g => g.id === gId)
        if (!g) { clearInterval(flowerInterval); return gs }
        const trimmed = g.flowers.length > (night ? 30 : 40) ? g.flowers.slice(-20) : g.flowers
        return gs.map(g => g.id === gId ? { ...g, flowers: [...trimmed, ...spawnFlowers(g.centerX, g.centerY, night ? 3 : 4, night)] } : g)
      })
    }, night ? 2500 : 2000)
    gatheringIntervals.current.set(gId, flowerInterval)
    setPokemon(prev => recalcCircle(pokemonIds, cx, cy, prev, gId))
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
      const el = containerRef.current!
      el.scrollLeft = scrollStart.current.x - (e.clientX - panStart.current.x)
      el.scrollTop = scrollStart.current.y - (e.clientY - panStart.current.y)
      return
    }
    if (heldRef.current !== null) {
      hasDragged.current = true
      const el = containerRef.current!
      const rect = el.getBoundingClientRect()
      const parkX = e.clientX - rect.left + el.scrollLeft - dragOffset.current.x
      const parkY = e.clientY - rect.top + el.scrollTop - dragOffset.current.y

      // Dragging a whole gathering
      if (heldGatheringRef.current !== null && gatherDragStart.current) {
        const cx = Math.max(100, Math.min(PARK_WIDTH - 100, parkX))
        const cy = Math.max(100, Math.min(PARK_HEIGHT - 100, parkY))
        const gId = heldGatheringRef.current
        const offsets = gatherDragStart.current.positions
        setGatherings(gs => gs.map(g =>
          g.id === gId ? { ...g, centerX: cx, centerY: cy } : g
        ))
        setPokemon(prev => prev.map(p => {
          if (p.gatheringId !== gId) return p
          const off = offsets.get(p.id)
          if (!off) return p
          return { ...p, x: cx + off.x, y: cy + off.y, targetX: cx + off.x, targetY: cy + off.y }
        }))
        return
      }

      setPokemon(prev => prev.map(p =>
        p.id === heldRef.current
          ? { ...p, x: Math.max(20, Math.min(PARK_WIDTH - 20, parkX)), y: Math.max(20, Math.min(PARK_HEIGHT - 20, parkY)), targetX: parkX, targetY: parkY }
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

      // Dropping a gathering — just release it in place
      if (heldGatheringRef.current !== null) {
        heldGatheringRef.current = null
        gatherDragStart.current = null
        return
      }

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

        // Check if dropped on a bench
        for (const bench of interactiveBenches) {
          if (occupiedObjects.current.has(bench.id)) continue
          if (Math.hypot(dropped.x - bench.x, dropped.y - bench.y) < DROP_INTERACT_RADIUS) {
            return prev.map(p =>
              p.id === droppedId ? {
                ...p, state: 'sitting' as const,
                idleTimer: SIT_DURATION,
                interactingWith: bench.id,
                x: bench.x, y: bench.y - 8,
                targetX: bench.x, targetY: bench.y - 8,
              } : p
            )
          }
        }

        // Check if dropped on food (mushroom/berry)
        for (const food of interactiveFood) {
          if (hiddenFood.has(food.id)) continue
          if (occupiedObjects.current.has(food.id)) continue
          if (Math.hypot(dropped.x - food.x, dropped.y - food.y) < DROP_INTERACT_RADIUS) {
            return prev.map(p =>
              p.id === droppedId ? {
                ...p, state: 'eating' as const,
                idleTimer: EAT_DURATION,
                interactingWith: food.id,
                x: food.x + (Math.random() - 0.5) * 20,
                y: food.y + 10,
                targetX: food.x, targetY: food.y + 10,
              } : p
            )
          }
        }

        // Check if dropped near an existing gathering
        for (const g of gatheringsRef.current) {
          if (Math.hypot(dropped.x - g.centerX, dropped.y - g.centerY) < GATHER_RADIUS) {
            joinGathering(g.id, droppedId)
            return prev
          }
        }

        // Check if dropped near other pokemon to start a new gathering
        const nearby = prev.filter(p =>
          p.id !== droppedId && p.state !== 'held' && p.state !== 'gathering' &&
          Math.hypot(p.x - dropped.x, p.y - dropped.y) < GATHER_RADIUS
        )
        if (nearby.length > 0) {
          const group = [dropped, ...nearby]
          const cx = group.reduce((s, p) => s + p.x, 0) / group.length
          const cy = group.reduce((s, p) => s + p.y, 0) / group.length
          startGathering(group.map(p => p.id), cx, cy, timeOfDay === 'night')
          return prev
        }
        return prev.map(p =>
          p.id === droppedId ? { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000 } : p
        )
      })
    }
  }, [onClickPokemon, setPokemon, joinGathering, startGathering, interactiveBenches, interactiveFood, hiddenFood])

  // === Sprite pointer handlers ===
  const onSpritePointerDown = useCallback((e: React.PointerEvent, pId: number) => {
    e.stopPropagation()
    e.preventDefault()
    hasDragged.current = false

    const el = containerRef.current!
    const rect = el.getBoundingClientRect()

    // Check if this pokemon is in a gathering — if so, drag the whole group
    const p = pokemon.find(pk => pk.id === pId)
    if (p?.gatheringId) {
      const g = gatheringsRef.current.find(gg => gg.id === p.gatheringId)
      if (g) {
        heldGatheringRef.current = g.id
        dragOffset.current = {
          x: e.clientX - (g.centerX - el.scrollLeft + rect.left),
          y: e.clientY - (g.centerY - el.scrollTop + rect.top),
        }
        // Store original positions relative to center
        const positions = new Map<number, { x: number; y: number }>()
        for (const pk of pokemon) {
          if (pk.gatheringId === g.id) {
            positions.set(pk.id, { x: pk.x - g.centerX, y: pk.y - g.centerY })
          }
        }
        gatherDragStart.current = { cx: g.centerX, cy: g.centerY, positions }
        setHeldId(pId) // use the clicked one as the "anchor" for held state
        el.setPointerCapture(e.pointerId)
        return
      }
    }

    // If eating/smelling/sitting, clear the interaction
    setPokemon(prev => {
      const pk = prev.find(p => p.id === pId)
      if (pk) {
        dragOffset.current = {
          x: e.clientX - (pk.x - el.scrollLeft + rect.left),
          y: e.clientY - (pk.y - el.scrollTop + rect.top),
        }
      }
      return prev.map(pk =>
        pk.id === pId ? { ...pk, state: 'held' as const, gatheringId: undefined, interactingWith: undefined } : pk
      )
    })
    heldGatheringRef.current = null
    gatherDragStart.current = null
    setHeldId(pId)
    el.setPointerCapture(e.pointerId)
  }, [pokemon, setPokemon])

  // === Animation loop ===
  useEffect(() => {
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = now - lastTime
      lastTime = now

      setPokemon(prev => {
        let updated = prev.map(p => {
          if (p.state === 'held') return p

          if (p.state === 'gathering') {
            const dx = p.targetX - p.x
            const dy = p.targetY - p.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 2) return { ...p, x: p.targetX, y: p.targetY }
            const step = Math.min(SPEED * 1.5 * (dt / 16), dist)
            return { ...p, x: p.x + (dx / dist) * step, y: p.y + (dy / dist) * step, facingLeft: dx < 0 }
          }

          // Smelling a flower — timer countdown
          if (p.state === 'smelling') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }
            return { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000, interactingWith: undefined }
          }

          // Sitting on a bench — timer countdown
          if (p.state === 'sitting') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }
            return { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000, interactingWith: undefined }
          }

          // Eating food — timer countdown, hide food when done
          if (p.state === 'eating') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }
            // Food is consumed — hide it and schedule respawn
            if (p.interactingWith) {
              const foodId = p.interactingWith
              setHiddenFood(h => new Set(h).add(foodId))
              setTimeout(() => {
                setHiddenFood(h => {
                  const next = new Set(h)
                  next.delete(foodId)
                  return next
                })
              }, FOOD_RESPAWN_DELAY)
            }
            return { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000, interactingWith: undefined }
          }

          if (p.state === 'idle') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }

            // At night, pokemon are sometimes drawn toward lanterns
            if (timeOfDayRef.current === 'night' && Math.random() < LANTERN_ATTRACT_CHANCE) {
              // Pick a random lantern and head toward it
              const lamp = lanterns[Math.floor(Math.random() * lanterns.length)]
              if (lamp) {
                const jitter = 30
                const tx = lamp.x + (Math.random() - 0.5) * jitter
                const ty = lamp.y + (Math.random() - 0.5) * jitter
                return { ...p, targetX: tx, targetY: ty, state: 'walking' as const, facingLeft: tx < p.x }
              }
            }

            const t = randomTarget()
            return { ...p, ...t, state: 'walking' as const, facingLeft: t.targetX < p.x }
          }

          // Walking
          const dx = p.targetX - p.x
          const dy = p.targetY - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 4) {
            return { ...p, x: p.targetX, y: p.targetY, state: 'idle' as const, idleTimer: 2000 + Math.random() * 4000 }
          }

          const step = Math.min(SPEED * (dt / 16), dist)
          const newX = p.x + (dx / dist) * step
          const newY = p.y + (dy / dist) * step
          const newP = { ...p, x: newX, y: newY, facingLeft: dx < 0 }

          // Check for flower interactions while walking
          if (Math.random() < 0.01) { // throttle checks
            for (const flower of interactiveFlowers) {
              if (occupiedObjects.current.has(flower.id)) continue
              const d = Math.hypot(newX - flower.x, newY - flower.y)
              if (d < flower.radius && Math.random() < INTERACT_CHANCE) {
                return {
                  ...newP,
                  state: 'smelling' as const,
                  idleTimer: SMELL_DURATION,
                  interactingWith: flower.id,
                  // Move to the flower
                  x: flower.x + (Math.random() - 0.5) * 20,
                  y: flower.y + 10,
                }
              }
            }

            // Check for bench interactions
            for (const bench of interactiveBenches) {
              if (occupiedObjects.current.has(bench.id)) continue
              const d = Math.hypot(newX - bench.x, newY - bench.y)
              if (d < bench.radius && Math.random() < INTERACT_CHANCE * 0.5) {
                return {
                  ...newP,
                  state: 'sitting' as const,
                  idleTimer: SIT_DURATION,
                  interactingWith: bench.id,
                  x: bench.x,
                  y: bench.y - 8,
                }
              }
            }
          }

          return newP
        })

        // At night, pokemon near same lantern form night gatherings
        if (timeOfDayRef.current === 'night') {
          for (const lamp of lanterns) {
            const nearLamp = updated.filter(p =>
              (p.state === 'idle' || p.state === 'walking') && !p.gatheringId &&
              Math.hypot(p.x - lamp.x, p.y - lamp.y) < GATHER_CIRCLE_RADIUS * 1.5
            )
            if (nearLamp.length >= 2) {
              const ids = nearLamp.map(p => p.id)
              const gId = ++gatheringIdCounter
              const newGathering: Gathering = {
                id: gId, centerX: lamp.x, centerY: lamp.y,
                pokemonIds: ids, startTime: Date.now(),
                flowers: spawnFlowers(lamp.x, lamp.y, 8, true),
                isNight: true,
              }
              setGatherings(gs => [...gs, newGathering])
              const flowerInterval = setInterval(() => {
                setGatherings(gs => {
                  const g = gs.find(g => g.id === gId)
                  if (!g) { clearInterval(flowerInterval); return gs }
                  const trimmed = g.flowers.length > 30 ? g.flowers.slice(-20) : g.flowers
                  return gs.map(g => g.id === gId ? { ...g, flowers: [...trimmed, ...spawnFlowers(g.centerX, g.centerY, 3, true)] } : g)
                })
              }, 2500)
              gatheringIntervals.current.set(gId, flowerInterval)
              updated = recalcCircle(ids, lamp.x, lamp.y, updated, gId)
            }
          }
        }

        // Wandering pokemon sucked into gatherings
        for (const g of gatheringsRef.current) {
          for (const p of updated) {
            if (p.state !== 'walking' && p.state !== 'idle') continue
            if (p.gatheringId) continue
            if (Math.hypot(p.x - g.centerX, p.y - g.centerY) < GATHER_RADIUS * 0.7) {
              const newIds = [...g.pokemonIds, p.id]
              setGatherings(gs => gs.map(gg =>
                gg.id === g.id
                  ? { ...gg, pokemonIds: newIds, flowers: [...gg.flowers, ...spawnFlowers(gg.centerX, gg.centerY, 3)] }
                  : gg
              ))
              const angleStep = (Math.PI * 2) / newIds.length
              updated = updated.map(pk => {
                const idx = newIds.indexOf(pk.id)
                if (pk.id === p.id || pk.gatheringId === g.id) {
                  if (idx === -1) return pk
                  const angle = angleStep * idx - Math.PI / 2
                  return {
                    ...pk,
                    state: 'gathering' as const,
                    gatheringId: g.id,
                    targetX: g.centerX + Math.cos(angle) * GATHER_CIRCLE_RADIUS,
                    targetY: g.centerY + Math.sin(angle) * GATHER_CIRCLE_RADIUS,
                  }
                }
                return pk
              })
              break
            }
          }
        }

        return updated
      })

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [setPokemon, interactiveFlowers, interactiveBenches])

  // Center viewport on load
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollLeft = (PARK_WIDTH - el.clientWidth) / 2
    el.scrollTop = (PARK_HEIGHT - el.clientHeight) / 2
  }, [])

  // Build a sorted render list: park objects + pokemon, sorted by baseY/y for depth
  const renderItems = useMemo(() => {
    const items: { type: 'object' | 'pokemon'; y: number; key: string; data: ParkPokemon | typeof PARK_OBJECTS[0] }[] = []

    for (const obj of PARK_OBJECTS) {
      if (hiddenFood.has(obj.id)) continue // eaten food is hidden
      if (obj.type === 'lamp' && timeOfDay === 'day') continue // lamps only at night
      items.push({ type: 'object', y: obj.baseY, key: obj.id, data: obj })
    }

    for (const p of pokemon) {
      items.push({ type: 'pokemon', y: p.y, key: `p-${p.id}`, data: p })
    }

    // Held pokemon always on top
    items.sort((a, b) => {
      const aHeld = a.type === 'pokemon' && (a.data as ParkPokemon).state === 'held'
      const bHeld = b.type === 'pokemon' && (b.data as ParkPokemon).state === 'held'
      if (aHeld && !bHeld) return 1
      if (!aHeld && bHeld) return -1
      return a.y - b.y
    })

    return items
  }, [pokemon, hiddenFood, timeOfDay])

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
        {/* Dirt paths */}
        <div className="park-path path-h" style={{ left: 300, top: 580, width: 600 }} />
        <div className="park-path path-h" style={{ left: 1200, top: 750, width: 500 }} />
        <div className="park-path path-v" style={{ left: 850, top: 400, height: 400 }} />
        <div className="park-path path-v" style={{ left: 1450, top: 600, height: 500 }} />
        <div className="park-path-circle" style={{ left: 850, top: 580 }} />
        <div className="park-path-circle" style={{ left: 1450, top: 750 }} />

        {/* Pond area */}
        <div className="park-pond" style={{ left: 1100, top: 870 }} />

        {/* Lantern light radii (night only) */}
        {timeOfDay === 'night' && lanterns.map(l => (
          <div key={`light-${l.id}`} className="lantern-light" style={{ left: l.x, top: l.y }} />
        ))}

        {/* Gathering flower particles */}
        {gatherings.map(g =>
          g.flowers.map(f => (
            <div
              key={f.id}
              className={`gathering-flower ${g.isNight ? 'night-particle' : ''}`}
              style={{ left: f.x, top: f.y, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }}
            >
              {f.emoji}
            </div>
          ))
        )}

        {/* Gathering rings */}
        {gatherings.map(g => (
          <div key={`ring-${g.id}`} className={`gathering-ring ${g.isNight ? 'night-gathering' : ''}`} style={{ left: g.centerX, top: g.centerY }} />
        ))}

        {/* Y-sorted render: objects + pokemon */}
        {renderItems.map((item, i) => {
          if (item.type === 'object') {
            const obj = item.data as typeof PARK_OBJECTS[0]
            return (
              <div
                key={obj.id}
                className={`park-deco ${obj.type} ${obj.size}`}
                style={{ left: obj.x, top: obj.y, zIndex: i + 1 }}
              >
                {obj.emoji}
              </div>
            )
          }

          const p = item.data as ParkPokemon
          return (
            <div
              key={p.id}
              className={`park-sprite ${p.state} ${p.pinned ? 'pinned' : ''}`}
              style={{
                left: p.x,
                top: p.y,
                transform: `translate(-50%, -50%) scaleX(${p.facingLeft ? -1 : 1})`,
                zIndex: p.state === 'held' ? 9999 : i + 1,
              }}
              onPointerDown={(e) => onSpritePointerDown(e, p.id)}
            >
              <span className="sprite-name" style={p.facingLeft ? { transform: 'translateX(-50%) scaleX(-1)' } : undefined}>
                {p.data.name}
              </span>
              {p.pinned && <span className="pin-badge">📌</span>}
              <img src={p.data.spriteUrl} alt={p.data.name} draggable={false} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

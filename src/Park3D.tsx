import { useRef, useEffect, useCallback, useState, useMemo, type Dispatch, type SetStateAction } from 'react'
import { Canvas } from '@react-three/fiber'
import { Billboard, OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { PARK_WIDTH, PARK_HEIGHT } from './roster'
import { PARK_OBJECTS, type ParkObject } from './parkObjects'
import type { ParkPokemon, TimeOfDay, Gathering, FlowerParticle } from './types'

/* ── constants ──────────────────────────────────────── */

const SCALE = 0.01
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// Game constants (same as Park.tsx)
const SPEED = 0.4
const GATHER_RADIUS = 100
function gatherCircleRadius(count: number) { return 30 + Math.max(count, 2) * 15 }
const FLOWER_EMOJIS = ['🌸', '🌼', '🌺', '🌷', '🌻', '✨', '💫', '🎶']
const NIGHT_PARTICLE_EMOJIS = ['✨', '⭐', '🌙', '💫', '🪷', '🌟']
const LANTERN_ATTRACT_CHANCE = 0.08
const SMELL_DURATION = 3000 + Math.random() * 2000
const SIT_DURATION = 8000 + Math.random() * 6000
const EAT_DURATION = 8000 + Math.random() * 5000
const FOOD_RESPAWN_DELAY = 15000
const DROP_INTERACT_RADIUS = 70
const INTERACT_CHANCE = 0.4

let gatheringIdCounter = 0
let flowerIdCounter = 0

/* ── coordinate helpers ─────────────────────────────── */

function toWorldX(px: number) { return (px - PARK_WIDTH / 2) * SCALE }
function toWorldZ(py: number) { return (py - PARK_HEIGHT / 2) * SCALE }
function fromWorldX(wx: number) { return wx / SCALE + PARK_WIDTH / 2 }
function fromWorldZ(wz: number) { return wz / SCALE + PARK_HEIGHT / 2 }

/* ── game helpers (same as Park.tsx) ────────────────── */

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
    const r = gatherCircleRadius(pokemonIds.length)
    return {
      ...p,
      state: 'gathering' as const,
      gatheringId: gId,
      targetX: cx + Math.cos(angle) * r,
      targetY: cy + Math.sin(angle) * r,
    }
  })
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

/* ── texture cache ──────────────────────────────────── */

const textureCache = new Map<string, THREE.Texture>()
const textureLoader = new THREE.TextureLoader()

function usePixelTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(() => textureCache.get(url) ?? null)

  useEffect(() => {
    if (textureCache.has(url)) {
      setTexture(textureCache.get(url)!)
      return
    }
    textureLoader.load(url, (tex) => {
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      tex.colorSpace = THREE.SRGBColorSpace
      textureCache.set(url, tex)
      setTexture(tex)
    })
  }, [url])

  return texture
}

/* ── 3D park objects ────────────────────────────────── */

function Tree3D({ position, isConifer }: { position: [number, number, number]; isConifer: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.7, 6]} />
        <meshStandardMaterial color="#6B3A20" />
      </mesh>
      {isConifer ? (
        <>
          <mesh position={[0, 0.8, 0]}>
            <coneGeometry args={[0.35, 0.6, 8]} />
            <meshStandardMaterial color="#1a5c10" />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <coneGeometry args={[0.25, 0.5, 8]} />
            <meshStandardMaterial color="#1e6614" />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.45, 8, 6]} />
          <meshStandardMaterial color="#2d6b1e" />
        </mesh>
      )}
    </group>
  )
}

function Flower3D({ position, emoji }: { position: [number, number, number]; emoji: string }) {
  const colors: Record<string, string> = {
    '🌸': '#ffb7c5', '🌼': '#ffd700', '🌷': '#ff6b81', '🌻': '#ffc800', '🌺': '#ff4444',
  }
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
        <meshStandardMaterial color="#3a7030" />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color={colors[emoji] ?? '#ffaacc'} />
      </mesh>
    </group>
  )
}

function Bench3D({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.2]} />
        <meshStandardMaterial color="#8B5E3C" />
      </mesh>
      {[-0.2, 0.2].map(x => (
        <mesh key={x} position={[x, 0.07, 0]}>
          <boxGeometry args={[0.04, 0.14, 0.16]} />
          <meshStandardMaterial color="#6B3A20" />
        </mesh>
      ))}
    </group>
  )
}

function Rock3D({ position, size }: { position: [number, number, number]; size: string }) {
  const s = size === 'sm' ? 0.1 : 0.16
  return (
    <mesh position={[position[0], s * 0.5, position[2]]}>
      <sphereGeometry args={[s, 6, 5]} />
      <meshStandardMaterial color="#808080" roughness={0.9} />
    </mesh>
  )
}

function Mushroom3D({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.1, 5]} />
        <meshStandardMaterial color="#f0e8d0" />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.06, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>
    </group>
  )
}

function Berry3D({ position, emoji }: { position: [number, number, number]; emoji: string }) {
  const color = emoji === '🫐' ? '#4169E1' : '#6B2FA0'
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshStandardMaterial color="#2d6b1e" />
      </mesh>
      {[[-0.06, 0.22, 0.04], [0.05, 0.2, -0.03], [0, 0.25, 0.02]].map(([bx, by, bz], i) => (
        <mesh key={i} position={[bx, by, bz]}>
          <sphereGeometry args={[0.03, 4, 4]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

function Pond3D({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={[position[0], 0.005, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.8, 32]} />
      <meshStandardMaterial color="#4a9edd" transparent opacity={0.5} />
    </mesh>
  )
}

function Sign3D({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 4]} />
        <meshStandardMaterial color="#6B3A20" />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.2, 0.12, 0.02]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
    </group>
  )
}

function Lamp3D({ position, isNight }: { position: [number, number, number]; isNight: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.6, 5]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial
          color="#ffcc66"
          emissive={isNight ? '#ffaa33' : '#000'}
          emissiveIntensity={isNight ? 2 : 0}
        />
      </mesh>
      {isNight && (
        <pointLight position={[0, 0.7, 0]} intensity={3} distance={3} color="#ffcc66" decay={2} />
      )}
    </group>
  )
}

function ParkObject3D({ obj, timeOfDay, hidden }: { obj: ParkObject; timeOfDay: TimeOfDay; hidden: boolean }) {
  if (hidden) return null
  if (obj.type === 'lamp' && timeOfDay === 'day') return null

  const pos: [number, number, number] = [toWorldX(obj.x), 0, toWorldZ(obj.y)]

  switch (obj.type) {
    case 'tree': return <Tree3D position={pos} isConifer={obj.emoji === '🌲'} />
    case 'flower': return <Flower3D position={pos} emoji={obj.emoji} />
    case 'bench': return <Bench3D position={pos} />
    case 'rock': return <Rock3D position={pos} size={obj.size} />
    case 'mushroom': return <Mushroom3D position={pos} />
    case 'berry': return <Berry3D position={pos} emoji={obj.emoji} />
    case 'pond': return <Pond3D position={pos} />
    case 'sign': return <Sign3D position={pos} />
    case 'lamp': return <Lamp3D position={pos} isNight={timeOfDay === 'night'} />
    default: return null
  }
}

/* ── pokemon billboard ──────────────────────────────── */

function PokemonBillboard({
  pokemon,
  isHeld,
  onPointerDown,
  onNameDrag,
}: {
  pokemon: ParkPokemon
  isHeld: boolean
  onPointerDown: (pId: number) => void
  onNameDrag: (pId: number) => void
}) {
  const texture = usePixelTexture(pokemon.data.spriteUrl)
  const [hovered, setHovered] = useState(false)
  const wx = toWorldX(pokemon.x)
  const wz = toWorldZ(pokemon.y)

  // Use actual sprite dimensions to avoid squishing
  const img = texture?.image as HTMLImageElement | undefined
  const aspect = img ? img.width / img.height : 1

  // Animations based on time — use pokemon.id as phase offset for staggering
  const t = performance.now() * 0.001
  const phase = (pokemon.id * 1.7) % (Math.PI * 2) // unique offset per pokemon
  let bounceY = 0
  if (pokemon.state === 'walking') bounceY = Math.abs(Math.sin(t * 6 + phase)) * 0.06
  if (pokemon.state === 'gathering') bounceY = Math.sin(t * 4 + phase) * 0.04
  if (pokemon.state === 'eating') bounceY = Math.abs(Math.sin(t * 8 + phase)) * 0.05 * (Math.sin(t * 3 + phase) > 0 ? 1 : 0.3)
  if (pokemon.state === 'smelling') bounceY = Math.sin(t * 2 + phase) * 0.02
  if (pokemon.state === 'sitting') bounceY = Math.sin(t * 1.5) * 0.01
  if (isHeld) bounceY = Math.sin(t * 5) * 0.02 + 0.15

  // Sitting pokemon perch on top of the bench (seat surface ~0.18)
  const baseY = pokemon.state === 'sitting' ? 0.58 : 0.4
  const y = baseY + bounceY

  // Tint color based on state (applied to meshBasicMaterial color — white = no tint)
  let tint = '#ffffff'
  if (pokemon.state === 'gathering') tint = '#ffe0ee'
  if (pokemon.state === 'eating') tint = '#fff8dd'
  if (pokemon.state === 'smelling') tint = '#fff0dd'
  if (isHeld) tint = '#ddffdd'
  if (hovered && !isHeld) tint = '#ddffdd'

  if (!texture) return null

  return (
    <Billboard position={[wx, y, wz]}>
      <mesh
        scale={[pokemon.facingLeft ? -0.8 * aspect : 0.8 * aspect, 0.8, 1]}
        onPointerDown={(e) => { e.stopPropagation(); onPointerDown(pokemon.id) }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.1}
          side={THREE.DoubleSide}
          color={tint}
        />
      </mesh>
      {(hovered || isHeld || pokemon.state === 'gathering') && (
        <Html center position={[0, 0.55, 0]} style={{ pointerEvents: pokemon.state === 'gathering' ? 'auto' : 'none' }}>
          <span
            className={`sprite-name-3d ${pokemon.state === 'gathering' ? 'draggable-name' : ''}`}
            onPointerDown={pokemon.state === 'gathering' ? (e) => { e.stopPropagation(); onNameDrag(pokemon.id) } : undefined}
          >
            {pokemon.data.name}
          </span>
        </Html>
      )}
    </Billboard>
  )
}

/* ── gathering ring ─────────────────────────────────── */

function GatheringRing3D({ gathering, onDissolve }: { gathering: Gathering; onDissolve: (gId: number) => void }) {
  const wx = toWorldX(gathering.centerX)
  const wz = toWorldZ(gathering.centerY)
  const r = gatherCircleRadius(gathering.pokemonIds.length) * SCALE
  const color = gathering.isNight ? '#8888ff' : '#ffaacc'

  return (
    <group>
      <mesh position={[wx, 0.01, wz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.85, r * 1.15, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[wx, 0.05, wz + r + 0.3]} style={{ pointerEvents: 'auto' }}>
        <button
          className="break-it-up-btn"
          onPointerDown={(e) => { e.stopPropagation(); onDissolve(gathering.id) }}
        >
          break it up!
        </button>
      </Html>
    </group>
  )
}

/* ── ground ─────────────────────────────────────────── */

function Ground({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const grassColor = timeOfDay === 'night' ? '#1a3a18' : '#5ca84f'
  const pathColor = timeOfDay === 'night' ? '#3a3020' : '#8B7355'

  return (
    <group>
      {/* Main grass plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color={grassColor} />
      </mesh>

      {/* Grass variation patches */}
      {[
        [-5, -3, 2.5], [4, 1, 3], [-2, 4, 2], [7, -2, 2],
      ].map(([x, z, r], i) => (
        <mesh key={`patch-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.001, z]}>
          <circleGeometry args={[r, 16]} />
          <meshStandardMaterial
            color={timeOfDay === 'night' ? '#163016' : '#3d7a34'}
            transparent opacity={0.35}
          />
        </mesh>
      ))}

      {/* Dirt paths */}
      {[
        { pos: [-3, 0.002, -2.2] as const, args: [6, 0.28] as const },
        { pos: [2, 0.002, -0.5] as const, args: [5, 0.28] as const },
      ].map((path, i) => (
        <mesh key={`path-h-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[...path.pos]}>
          <planeGeometry args={[...path.args]} />
          <meshStandardMaterial color={pathColor} />
        </mesh>
      ))}
      {[
        { pos: [-3.5, 0.002, -1] as const, args: [0.28, 4] as const },
        { pos: [2.5, 0.002, 0.5] as const, args: [0.28, 5] as const },
      ].map((path, i) => (
        <mesh key={`path-v-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[...path.pos]}>
          <planeGeometry args={[...path.args]} />
          <meshStandardMaterial color={pathColor} />
        </mesh>
      ))}
    </group>
  )
}

/* ── scene (inside Canvas) ──────────────────────────── */

function ParkScene({
  pokemon,
  gatherings,
  hiddenFood,
  timeOfDay,
  heldId,
  onPickUp,
  onDissolve,
  onNameDrag,
}: {
  pokemon: ParkPokemon[]
  gatherings: Gathering[]
  hiddenFood: Set<string>
  timeOfDay: TimeOfDay
  heldId: number | null
  onPickUp: (pId: number) => void
  onDissolve: (gId: number) => void
  onNameDrag: (pId: number) => void
}) {
  const lanterns = useMemo(() => PARK_OBJECTS.filter(o => o.type === 'lamp'), [])

  return (
    <>
      <OrbitControls
        enabled={heldId === null}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.42}
        minDistance={5}
        maxDistance={25}
        enableDamping
        dampingFactor={0.08}
      />

      {/* Sky background */}
      <color attach="background" args={[timeOfDay === 'night' ? '#0a0a1a' : '#87ceeb']} />

      {/* Lighting */}
      <ambientLight intensity={timeOfDay === 'night' ? 0.15 : 1.2} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={timeOfDay === 'night' ? 0.05 : 1.0}
      />
      <hemisphereLight
        args={[
          timeOfDay === 'night' ? '#1a1a3a' : '#87ceeb',
          timeOfDay === 'night' ? '#0a0a1a' : '#4a8c3f',
          timeOfDay === 'night' ? 0.2 : 0.5
        ]}
      />

      {/* Fog */}
      {timeOfDay === 'night'
        ? <fog attach="fog" args={['#0a0a1a', 8, 22]} />
        : <fog attach="fog" args={['#87ceeb', 20, 40]} />
      }

      {/* Ground */}
      <Ground timeOfDay={timeOfDay} />

      {/* Park objects */}
      {PARK_OBJECTS.map(obj => (
        <ParkObject3D
          key={obj.id}
          obj={obj}
          timeOfDay={timeOfDay}
          hidden={hiddenFood.has(obj.id)}
        />
      ))}

      {/* Gathering rings */}
      {gatherings.map(g => (
        <GatheringRing3D key={`ring-${g.id}`} gathering={g} onDissolve={onDissolve} />
      ))}

      {/* Gathering particles */}
      {gatherings.map(g =>
        g.flowers.slice(-20).map(f => (
          <Html
            key={f.id}
            center
            position={[toWorldX(f.x), 0.3, toWorldZ(f.y)]}
            style={{ pointerEvents: 'none' }}
          >
            <span
              className={`gathering-flower-3d ${g.isNight ? 'night-particle' : ''}`}
              style={{ animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }}
            >
              {f.emoji}
            </span>
          </Html>
        ))
      )}

      {/* Night lantern ground glow */}
      {timeOfDay === 'night' && lanterns.map(l => (
        <mesh
          key={`glow-${l.id}`}
          position={[toWorldX(l.x), 0.003, toWorldZ(l.y)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[1.2, 24]} />
          <meshBasicMaterial color="#ffcc66" transparent opacity={0.08} />
        </mesh>
      ))}

      {/* Pokemon */}
      {pokemon.map(p => (
        <PokemonBillboard
          key={p.id}
          pokemon={p}
          isHeld={p.id === heldId}
          onPointerDown={onPickUp}
          onNameDrag={onNameDrag}
        />
      ))}
    </>
  )
}

/* ── main component ─────────────────────────────────── */

interface Props {
  pokemon: ParkPokemon[]
  setPokemon: Dispatch<SetStateAction<ParkPokemon[]>>
  onClickPokemon: (id: number) => void
  timeOfDay: TimeOfDay
}

export default function Park3D({ pokemon, setPokemon, onClickPokemon, timeOfDay }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<THREE.Camera>(null)
  const animRef = useRef<number>(0)

  const [heldId, setHeldId] = useState<number | null>(null)
  const heldRef = useRef<number | null>(null)
  const hasDragged = useRef(false)

  const heldGatheringRef = useRef<number | null>(null)
  const gatherDragStart = useRef<{ cx: number; cy: number; positions: Map<number, { x: number; y: number }> } | null>(null)

  const [hiddenFood, setHiddenFood] = useState<Set<string>>(new Set())
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const gatheringsRef = useRef<Gathering[]>([])
  const gatheringIntervals = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())
  const occupiedObjects = useRef<Set<string>>(new Set())
  const timeOfDayRef = useRef(timeOfDay)

  useEffect(() => { heldRef.current = heldId }, [heldId])
  useEffect(() => { gatheringsRef.current = gatherings }, [gatherings])
  useEffect(() => { timeOfDayRef.current = timeOfDay }, [timeOfDay])
  useEffect(() => {
    const intervals = gatheringIntervals.current
    return () => intervals.forEach(i => clearInterval(i))
  }, [])
  useEffect(() => {
    const occ = new Set<string>()
    for (const p of pokemon) {
      if (p.interactingWith) occ.add(p.interactingWith)
    }
    occupiedObjects.current = occ
  }, [pokemon])

  const interactiveFlowers = useMemo(() => PARK_OBJECTS.filter(o => o.type === 'flower' && o.interactive), [])
  const interactiveBenches = useMemo(() => PARK_OBJECTS.filter(o => o.type === 'bench' && o.interactive), [])
  const interactiveFood = useMemo(() => PARK_OBJECTS.filter(o => (o.type === 'mushroom' || o.type === 'berry') && o.interactive), [])
  const lanterns = useMemo(() => PARK_OBJECTS.filter(o => o.type === 'lamp'), [])

  /* ── gathering helpers ── */

  const dissolveGathering = useCallback((gId: number) => {
    const interval = gatheringIntervals.current.get(gId)
    if (interval) { clearInterval(interval); gatheringIntervals.current.delete(gId) }
    setGatherings(gs => gs.filter(g => g.id !== gId))
    setPokemon(prev => prev.map(p =>
      p.gatheringId === gId
        ? { ...p, state: 'idle' as const, gatheringId: undefined, idleTimer: 500 + Math.random() * 1500 }
        : p
    ))
  }, [setPokemon])

  const extractFromGathering = useCallback((pId: number) => {
    const p = pokemon.find(pk => pk.id === pId)
    if (!p?.gatheringId) return
    const gId = p.gatheringId
    setGatherings(gs => {
      const g = gs.find(gg => gg.id === gId)
      if (!g) return gs
      const newIds = g.pokemonIds.filter(id => id !== pId)
      if (newIds.length < 2) {
        // Dissolve if only 1 left
        const interval = gatheringIntervals.current.get(gId)
        if (interval) { clearInterval(interval); gatheringIntervals.current.delete(gId) }
        setPokemon(prev => prev.map(pk =>
          pk.gatheringId === gId
            ? { ...pk, state: 'held' as const, gatheringId: undefined, idleTimer: 500 + Math.random() * 1500 }
            : pk
        ))
        return gs.filter(gg => gg.id !== gId)
      }
      // Recalculate remaining circle
      setPokemon(prev => recalcCircle(newIds, g.centerX, g.centerY, prev, gId))
      return gs.map(gg => gg.id === gId ? { ...gg, pokemonIds: newIds } : gg)
    })
    // Set the extracted pokemon as held for dragging
    setPokemon(prev => prev.map(pk =>
      pk.id === pId ? { ...pk, state: 'held' as const, gatheringId: undefined } : pk
    ))
    heldGatheringRef.current = null
    gatherDragStart.current = null
    setHeldId(pId)
  }, [pokemon, setPokemon])

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

  /* ── raycasting helper ── */

  const getGroundPoint = useCallback((e: PointerEvent | React.PointerEvent): { x: number; y: number } | null => {
    if (!cameraRef.current || !containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const clientX = 'clientX' in e ? e.clientX : 0
    const clientY = 'clientY' in e ? e.clientY : 0
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)
    const target = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(GROUND_PLANE, target)) return null
    return { x: fromWorldX(target.x), y: fromWorldZ(target.z) }
  }, [])

  /* ── pointer handlers ── */

  const onPickUp = useCallback((pId: number) => {
    hasDragged.current = false

    const p = pokemon.find(pk => pk.id === pId)
    if (p?.gatheringId) {
      const g = gatheringsRef.current.find(gg => gg.id === p.gatheringId)
      if (g) {
        heldGatheringRef.current = g.id
        const positions = new Map<number, { x: number; y: number }>()
        for (const pk of pokemon) {
          if (pk.gatheringId === g.id) positions.set(pk.id, { x: pk.x - g.centerX, y: pk.y - g.centerY })
        }
        gatherDragStart.current = { cx: g.centerX, cy: g.centerY, positions }
        setHeldId(pId)
        return
      }
    }

    setPokemon(prev => prev.map(pk =>
      pk.id === pId ? { ...pk, state: 'held' as const, gatheringId: undefined, interactingWith: undefined } : pk
    ))
    heldGatheringRef.current = null
    gatherDragStart.current = null
    setHeldId(pId)
  }, [pokemon, setPokemon])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (heldRef.current === null) return
    hasDragged.current = true
    const pt = getGroundPoint(e)
    if (!pt) return

    if (heldGatheringRef.current !== null && gatherDragStart.current) {
      const cx = clamp(pt.x, 100, PARK_WIDTH - 100)
      const cy = clamp(pt.y, 100, PARK_HEIGHT - 100)
      const gId = heldGatheringRef.current
      const offsets = gatherDragStart.current.positions
      setGatherings(gs => gs.map(g => g.id === gId ? { ...g, centerX: cx, centerY: cy } : g))
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
        ? { ...p, x: clamp(pt.x, 20, PARK_WIDTH - 20), y: clamp(pt.y, 20, PARK_HEIGHT - 20), targetX: pt.x, targetY: pt.y }
        : p
    ))
  }, [getGroundPoint, setPokemon, setGatherings])

  const onPointerUp = useCallback(() => {
    if (heldRef.current === null) return
    const droppedId = heldRef.current
    setHeldId(null)

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

      for (const bench of interactiveBenches) {
        if (occupiedObjects.current.has(bench.id)) continue
        if (Math.hypot(dropped.x - bench.x, dropped.y - bench.y) < DROP_INTERACT_RADIUS) {
          return prev.map(p =>
            p.id === droppedId ? {
              ...p, state: 'sitting' as const, idleTimer: SIT_DURATION,
              interactingWith: bench.id, x: bench.x, y: bench.y - 8,
              targetX: bench.x, targetY: bench.y - 8,
            } : p
          )
        }
      }

      for (const food of interactiveFood) {
        if (hiddenFood.has(food.id) || occupiedObjects.current.has(food.id)) continue
        if (Math.hypot(dropped.x - food.x, dropped.y - food.y) < DROP_INTERACT_RADIUS) {
          return prev.map(p =>
            p.id === droppedId ? {
              ...p, state: 'eating' as const, idleTimer: EAT_DURATION,
              interactingWith: food.id, x: food.x + (Math.random() - 0.5) * 20,
              y: food.y + 10, targetX: food.x, targetY: food.y + 10,
            } : p
          )
        }
      }

      for (const g of gatheringsRef.current) {
        if (Math.hypot(dropped.x - g.centerX, dropped.y - g.centerY) < GATHER_RADIUS) {
          joinGathering(g.id, droppedId)
          return prev
        }
      }

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
  }, [onClickPokemon, setPokemon, joinGathering, startGathering, interactiveBenches, interactiveFood, hiddenFood, timeOfDay])

  /* ── animation loop (same as Park.tsx) ── */

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

          if (p.state === 'smelling') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }
            return { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000, interactingWith: undefined }
          }

          if (p.state === 'sitting') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }
            return { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000, interactingWith: undefined }
          }

          if (p.state === 'eating') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }
            if (p.interactingWith) {
              const foodId = p.interactingWith
              setHiddenFood(h => new Set(h).add(foodId))
              setTimeout(() => {
                setHiddenFood(h => { const next = new Set(h); next.delete(foodId); return next })
              }, FOOD_RESPAWN_DELAY)
            }
            return { ...p, state: 'idle' as const, idleTimer: 1000 + Math.random() * 2000, interactingWith: undefined }
          }

          if (p.state === 'idle') {
            const remaining = p.idleTimer - dt
            if (remaining > 0) return { ...p, idleTimer: remaining }

            if (timeOfDayRef.current === 'night' && Math.random() < LANTERN_ATTRACT_CHANCE) {
              const lamp = lanterns[Math.floor(Math.random() * lanterns.length)]
              if (lamp) {
                const tx = lamp.x + (Math.random() - 0.5) * 30
                const ty = lamp.y + (Math.random() - 0.5) * 30
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

          if (Math.random() < 0.01) {
            for (const flower of interactiveFlowers) {
              if (occupiedObjects.current.has(flower.id)) continue
              const d = Math.hypot(newX - flower.x, newY - flower.y)
              if (d < flower.radius && Math.random() < INTERACT_CHANCE) {
                return {
                  ...newP, state: 'smelling' as const, idleTimer: SMELL_DURATION,
                  interactingWith: flower.id,
                  x: flower.x + (Math.random() - 0.5) * 20, y: flower.y + 10,
                }
              }
            }
            for (const bench of interactiveBenches) {
              if (occupiedObjects.current.has(bench.id)) continue
              const d = Math.hypot(newX - bench.x, newY - bench.y)
              if (d < bench.radius && Math.random() < INTERACT_CHANCE * 0.5) {
                return {
                  ...newP, state: 'sitting' as const, idleTimer: SIT_DURATION,
                  interactingWith: bench.id, x: bench.x, y: bench.y - 8,
                }
              }
            }
          }

          return newP
        })

        // Night lantern gatherings
        if (timeOfDayRef.current === 'night') {
          for (const lamp of lanterns) {
            const nearLamp = updated.filter(p =>
              (p.state === 'idle' || p.state === 'walking') && !p.gatheringId &&
              Math.hypot(p.x - lamp.x, p.y - lamp.y) < gatherCircleRadius(2) * 1.5
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
                  ? { ...gg, pokemonIds: newIds, flowers: [...gg.flowers, ...spawnFlowers(gg.centerX, gg.centerY, 3, gg.isNight)] }
                  : gg
              ))
              const r = gatherCircleRadius(newIds.length)
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
                    targetX: g.centerX + Math.cos(angle) * r,
                    targetY: g.centerY + Math.sin(angle) * r,
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
  }, [setPokemon, interactiveFlowers, interactiveBenches, lanterns])

  /* ── render ── */

  return (
    <div
      ref={containerRef}
      className="park-viewport-3d"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ touchAction: 'none' }}
    >
      <Canvas
        camera={{ position: [0, 10, 10], fov: 50, near: 0.1, far: 100 }}
        onCreated={({ camera }) => { cameraRef.current = camera }}
      >
        <ParkScene
          pokemon={pokemon}
          gatherings={gatherings}
          hiddenFood={hiddenFood}
          timeOfDay={timeOfDay}
          heldId={heldId}
          onPickUp={onPickUp}
          onDissolve={dissolveGathering}
          onNameDrag={extractFromGathering}
        />
      </Canvas>
    </div>
  )
}

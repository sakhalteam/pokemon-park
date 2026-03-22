/** Core Pokemon data after fetching from PokeAPI */
export interface PokemonData {
  id: number
  name: string
  genus: string
  types: string[]
  height: number
  weight: number
  genderRate: number
  habitat: string | null
  flavorText: string
  spriteUrl: string
  artworkUrl: string
  cryUrl: string | null
}

/** A pokemon currently in the park */
export interface ParkPokemon {
  id: number
  data: PokemonData
  x: number
  y: number
  targetX: number
  targetY: number
  facingLeft: boolean
  state: 'walking' | 'idle' | 'held' | 'gathering' | 'smelling' | 'sitting'
  idleTimer: number
  pinned: boolean
  gatheringId?: number
  interactingWith?: string // park object id
}

/** A group of pokemon playing together */
export interface Gathering {
  id: number
  centerX: number
  centerY: number
  pokemonIds: number[]
  startTime: number
  flowers: FlowerParticle[]
}

export interface FlowerParticle {
  id: number
  x: number
  y: number
  emoji: string
  delay: number
  duration: number
}

export type TimeOfDay = 'day' | 'night'

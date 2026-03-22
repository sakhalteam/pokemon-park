/** Core Pokemon data after fetching from PokeAPI */
export interface PokemonData {
  id: number
  name: string
  genus: string          // "the Seed Pokémon"
  types: string[]
  height: number         // decimetres → we'll convert to display
  weight: number         // hectograms → we'll convert to display
  genderRate: number     // -1 = genderless, 0-8 = eighths female
  habitat: string | null
  flavorText: string     // debut generation pokedex entry
  spriteUrl: string      // small pixel sprite (overworld)
  artworkUrl: string     // official artwork (focus view)
  cryUrl: string | null  // audio cry
}

/** A pokemon currently in the park */
export interface ParkPokemon {
  id: number             // pokedex number
  data: PokemonData
  x: number              // position in park (px)
  y: number              // position in park (px)
  targetX: number        // wandering destination
  targetY: number        // wandering destination
  facingLeft: boolean
  state: 'walking' | 'idle' | 'held' | 'gathering'
  idleTimer: number      // ms remaining in idle
  pinned: boolean
  gatheringId?: number   // which gathering group this pokemon belongs to
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

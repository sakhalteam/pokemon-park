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
  state: 'walking' | 'idle'
  idleTimer: number      // ms remaining in idle
  pinned: boolean
}

export type TimeOfDay = 'day' | 'night'

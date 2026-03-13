import type { PokemonData } from './types'

const API = 'https://pokeapi.co/api/v2'
const cache = new Map<number | string, PokemonData>()

/** Fetch pokemon + species data from PokeAPI, with in-memory cache */
export async function fetchPokemon(id: number | string): Promise<PokemonData> {
  if (cache.has(id)) return cache.get(id)!

  const [poke, species] = await Promise.all([
    fetch(`${API}/pokemon/${id}`).then(r => r.json()),
    fetch(`${API}/pokemon-species/${typeof id === 'string' ? id.replace(/^10\d+$/, () => {
      // For form IDs like 10114 (Alolan Exeggutor), species is base ID
      return '103'
    }) : id}`).then(r => r.json()),
  ])

  // Find English genus
  const genusEntry = species.genera?.find(
    (g: { language: { name: string }; genus: string }) => g.language.name === 'en'
  )

  // Find English flavor text from earliest game version
  const flavorEntries = (species.flavor_text_entries || []).filter(
    (f: { language: { name: string } }) => f.language.name === 'en'
  )
  const flavorText = flavorEntries.length > 0
    ? flavorEntries[0].flavor_text.replace(/[\n\f\r]/g, ' ')
    : ''

  const data: PokemonData = {
    id: typeof id === 'number' ? id : parseInt(id),
    name: species.name || poke.name,
    genus: genusEntry?.genus || '',
    types: poke.types.map((t: { type: { name: string } }) => t.type.name),
    height: poke.height,   // decimetres
    weight: poke.weight,   // hectograms
    genderRate: species.gender_rate,
    habitat: species.habitat?.name || null,
    flavorText,
    spriteUrl: poke.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default
      || poke.sprites?.front_default
      || '',
    artworkUrl: poke.sprites?.other?.['official-artwork']?.front_default
      || poke.sprites?.front_default
      || '',
    cryUrl: poke.cries?.latest || poke.cries?.legacy || null,
  }

  cache.set(id, data)
  return data
}

/** Fetch multiple pokemon in parallel with a concurrency limit */
export async function fetchMany(ids: (number | string)[]): Promise<PokemonData[]> {
  const results: PokemonData[] = []
  const batchSize = 8

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(id => fetchPokemon(id)))
    results.push(...batchResults)
  }

  return results
}

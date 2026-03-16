# pokemon-park — Interactive pokemon encyclopedia playground for Jojo

> Parent context: `../CLAUDE.md` has universal preferences and conventions. Keep it updated with anything universal you learn here.

## What this is
A "meet and greet" pokemon park for Nic's daughter Jojo. NOT a battle stats viewer. Think Animal Crossing museum vibes — pannable 2D park where pokemon wander around. Tap one to see its pokedex entry, hear its cry, learn about it. Pin favorites to keep them in the park.

## Stack
- Vite + React 18 + TypeScript + Tailwind v3
- `base: '/pokemon-park/'` in vite.config.ts
- Deployed to sakhalteam.github.io/pokemon-park/

## Architecture
- **App.tsx**: HomeBtn, loading screen with pokeball spinner, state management (allData, parkPokemon, focusedId, timeOfDay)
- **Park.tsx**: pannable viewport (pointer drag), rAF walk loop (idle→pick target→walk→arrive→idle), emoji decorative elements as placeholders
- **PokemonCard.tsx**: focus overlay with artwork, info card (genus, types, flavor text, height/weight/gender/habitat), cry playback, pin button
- **api.ts**: PokeAPI fetcher with in-memory cache, animated Gen 5 sprites for overworld, official artwork for focus view, debut-gen flavor text
- **roster.ts**: 53 pokemon (gen 1-9 starters + eeveelutions + favorites), PARK_CAPACITY=20, PARK_WIDTH=2400, PARK_HEIGHT=1600
- **types.ts**: PokemonData, ParkPokemon, TimeOfDay

## Key mechanics
- Day/night toggle shuffles non-pinned pokemon, keeps pinned ones
- Pin system lets Jojo keep favorites in the park
- Pannable Where's Waldo-style park (2400x1600), sprites wander with bounce animation

## Pending work
- Island zone integration: `zone_pokemon_park` in island.blend + IslandScene.tsx
- Hand-pick dropdown for choosing specific pokemon
- Nocturnal/diurnal species tied to day/night
- Alolan Exeggutor form (ID 10114, stubbed not wired)
- Expand roster beyond 53
- Replace emoji placeholders (trees, benches) with real art

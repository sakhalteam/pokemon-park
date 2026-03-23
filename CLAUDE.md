# pokemon-park — Interactive pokemon encyclopedia playground for Jojo

> Parent context: `../CLAUDE.md` has universal preferences and conventions. Keep it updated with anything universal you learn here.

## What this is
A "meet and greet" pokemon park for Nic's daughter Jojo. NOT a battle stats viewer. Think Animal Crossing museum vibes — Octopath Traveler HD-2D style (2D sprites billboarded in a 3D environment). Tap a pokemon to see its pokedex entry, hear its cry, learn about it. Pin favorites to keep them in the park.

## Stack
- Vite + React 19 + TypeScript + Tailwind v4 (@tailwindcss/vite plugin)
- React Three Fiber (@react-three/fiber, @react-three/drei, three) for 3D rendering
- `base: '/pokemon-park/'` in vite.config.ts
- Deployed to sakhalteam.github.io/pokemon-park/

## Architecture
- **App.tsx**: HomeBtn, loading screen with pokeball spinner, state management (allData, parkPokemon, focusedId, timeOfDay). Imports Park3D.
- **Park3D.tsx**: Active 3D renderer. Canvas + OrbitControls, billboarded pokemon sprites (meshBasicMaterial for lighting independence), 3D park objects (trees=cone+cylinder, flowers=sphere+stem, benches=boxes, etc.), raycasting for drag-and-drop, rAF animation loop, gathering system, night lantern pointLights. Coordinate system: SCALE=0.01, park coords (2400x1600) map to 3D (24x16 units centered at origin).
- **Park.tsx**: Preserved 2D fallback (DOM-based). Swap import in App.tsx to revert.
- **PokemonCard.tsx**: focus overlay with artwork, info card (genus, types, flavor text, height/weight/gender/habitat), cry playback, pin button
- **api.ts**: PokeAPI fetcher with in-memory cache, animated Gen 5 sprites for overworld, official artwork for focus view, debut-gen flavor text
- **roster.ts**: 53 pokemon (gen 1-9 starters + eeveelutions + favorites), PARK_CAPACITY=20, PARK_WIDTH=2400, PARK_HEIGHT=1600
- **types.ts**: PokemonData, ParkPokemon (states: walking/idle/held/gathering/smelling/sitting/eating), Gathering (isNight flag), FlowerParticle, TimeOfDay
- **parkObjects.ts**: Hand-placed park objects with position, baseY, interactivity, radius. Mushrooms/berries are interactive (edible).

## Key mechanics
- **3D environment**: OrbitControls for camera rotation/pan/zoom. Sky background, hemisphere lighting, fog
- **Billboarded sprites**: pokemon sprites always face camera (meshBasicMaterial, unlit). Aspect ratio from actual texture dimensions
- **Day/night toggle**: shuffles non-pinned pokemon, keeps pinned ones. Night adds lantern pointLights, dims ambient
- **Pin system**: lets Jojo keep favorites in the park
- **Drag-and-drop**: raycast to ground plane for coordinates. Grab sprite body = drag individual (or whole gathering if in one). Grab name label = extract individual from gathering. Drop near others = start gathering. Drop on bench/food = interact
- **Gatherings**: dance in circle with flower/star particles (`<Html>` from drei). Draggable as group. Dynamic circle radius scales with member count. "Break it up!" button dissolves gatherings. Name labels are grab handles to extract individuals. Dance animations staggered per pokemon (phase offset by id). Night gatherings have cooler colors + star emojis
- **Night lanterns**: hidden during day. At night: pointLight + ground glow, pokemon attracted toward them, form night gatherings when meeting
- **Object interactions**: flower smelling, bench sitting (sprites raised above bench surface), eating (food disappears + respawns)
- **Assets**: `public/models/` folder ready for GLB drops (Blender exports)

## Pending work (priority order)
1. Blender GLB scene import — replace procedural ground/objects with exported model. Use `public/models/` folder. Coordinate scale: 24x16 units centered at origin
2. Zone architecture: pokemon-park links directly from island (no intermediate zone scene)
3. Hand-pick dropdown for choosing specific pokemon
4. Nocturnal/diurnal species tied to day/night
5. Expand roster beyond 53

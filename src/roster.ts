/** Master roster of pokemon available in the park.
 *  Each entry is [pokedex number, name] */
export const ROSTER: [number, string][] = [
  // Gen 1 starter
  [1, 'bulbasaur'],
  // Gen 2 starters
  [152, 'chikorita'],
  [155, 'cyndaquil'],
  [158, 'totodile'],
  // Gen 3 starters
  [252, 'treecko'],
  [255, 'torchic'],
  [258, 'mudkip'],
  // Gen 4 starters
  [387, 'turtwig'],
  [390, 'chimchar'],
  [393, 'piplup'],
  // Gen 5 starters
  [495, 'snivy'],
  [498, 'tepig'],
  [501, 'oshawott'],
  // Gen 6 starters
  [650, 'chespin'],
  [653, 'fennekin'],
  [656, 'froakie'],
  // Gen 7 starters
  [722, 'rowlet'],
  [725, 'litten'],
  [728, 'popplio'],
  // Gen 8 starters
  [810, 'grookey'],
  [813, 'scorbunny'],
  [816, 'sobble'],
  // Gen 9 starters
  [906, 'sprigatito'],
  [909, 'fuecoco'],
  [912, 'quaxly'],
  // Gen 1 starters (charmander, squirtle)
  [4, 'charmander'],
  [7, 'squirtle'],

  // Eevee family
  [133, 'eevee'],
  [134, 'vaporeon'],
  [135, 'jolteon'],
  [136, 'flareon'],
  [196, 'espeon'],
  [197, 'umbreon'],
  [470, 'leafeon'],
  [471, 'glaceon'],
  [700, 'sylveon'],

  // Jojo's favorites
  [143, 'snorlax'],
  [59, 'arcanine'],
  [249, 'lugia'],
  [175, 'togepi'],
  [151, 'mew'],
  [115, 'kangaskhan'],
  [84, 'doduo'],
  [85, 'dodrio'],
  [102, 'exeggcute'],
  [52, 'meowth'],
  [94, 'gengar'],
  [144, 'articuno'],
  [146, 'moltres'],
  [145, 'zapdos'],
  [172, 'pichu'],
  [26, 'raichu'],
]

// Alolan Exeggutor — special form, handled separately
export const ALOLAN_EXEGGUTOR_ID = '10114' // PokeAPI form ID

/** How many pokemon to show in the park at once */
export const PARK_CAPACITY = 20

/** Park world dimensions (px) */
export const PARK_WIDTH = 2400
export const PARK_HEIGHT = 1600

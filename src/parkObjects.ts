export interface ParkObject {
  id: string
  type: 'tree' | 'flower' | 'bench' | 'rock' | 'mushroom' | 'berry' | 'pond' | 'sign' | 'lamp'
  emoji: string
  x: number
  y: number
  /** Y offset for the "feet" of the object — used for depth sorting.
   *  E.g. a tall tree's base is lower than its top. */
  baseY: number
  /** Can pokemon interact with this? */
  interactive: boolean
  /** Interaction radius in px */
  radius: number
  /** CSS class for sizing */
  size: 'sm' | 'md' | 'lg'
}

// Hand-placed objects for a 2400x1600 park
export const PARK_OBJECTS: ParkObject[] = [
  // === Trees (large, pokemon walk behind them) ===
  { id: 't1',  type: 'tree',     emoji: '🌳', x: 200,  y: 280,  baseY: 330,  interactive: false, radius: 0,  size: 'lg' },
  { id: 't2',  type: 'tree',     emoji: '🌲', x: 1800, y: 180,  baseY: 230,  interactive: false, radius: 0,  size: 'lg' },
  { id: 't3',  type: 'tree',     emoji: '🌳', x: 600,  y: 1150, baseY: 1200, interactive: false, radius: 0,  size: 'lg' },
  { id: 't4',  type: 'tree',     emoji: '🌲', x: 1400, y: 860,  baseY: 910,  interactive: false, radius: 0,  size: 'lg' },
  { id: 't5',  type: 'tree',     emoji: '🌳', x: 2100, y: 1060, baseY: 1110, interactive: false, radius: 0,  size: 'lg' },
  { id: 't6',  type: 'tree',     emoji: '🌲', x: 400,  y: 660,  baseY: 710,  interactive: false, radius: 0,  size: 'lg' },
  { id: 't7',  type: 'tree',     emoji: '🌳', x: 1050, y: 200,  baseY: 250,  interactive: false, radius: 0,  size: 'lg' },
  { id: 't8',  type: 'tree',     emoji: '🌲', x: 2200, y: 450,  baseY: 500,  interactive: false, radius: 0,  size: 'lg' },
  { id: 't9',  type: 'tree',     emoji: '🌳', x: 300,  y: 1350, baseY: 1400, interactive: false, radius: 0,  size: 'lg' },
  { id: 't10', type: 'tree',     emoji: '🌲', x: 1650, y: 350,  baseY: 400,  interactive: false, radius: 0,  size: 'lg' },

  // === Flowers (small, pokemon stop to smell them) ===
  { id: 'f1',  type: 'flower',   emoji: '🌸', x: 300,  y: 980,  baseY: 985,  interactive: true, radius: 50, size: 'sm' },
  { id: 'f2',  type: 'flower',   emoji: '🌼', x: 900,  y: 380,  baseY: 385,  interactive: true, radius: 50, size: 'sm' },
  { id: 'f3',  type: 'flower',   emoji: '🌷', x: 2000, y: 680,  baseY: 685,  interactive: true, radius: 50, size: 'sm' },
  { id: 'f4',  type: 'flower',   emoji: '🌻', x: 700,  y: 180,  baseY: 185,  interactive: true, radius: 50, size: 'sm' },
  { id: 'f5',  type: 'flower',   emoji: '🌺', x: 1300, y: 1200, baseY: 1205, interactive: true, radius: 50, size: 'sm' },
  { id: 'f6',  type: 'flower',   emoji: '🌸', x: 1700, y: 1100, baseY: 1105, interactive: true, radius: 50, size: 'sm' },
  { id: 'f7',  type: 'flower',   emoji: '🌼', x: 500,  y: 500,  baseY: 505,  interactive: true, radius: 50, size: 'sm' },
  { id: 'f8',  type: 'flower',   emoji: '🌷', x: 1150, y: 650,  baseY: 655,  interactive: true, radius: 50, size: 'sm' },

  // === Benches (medium, pokemon hop on and sit) ===
  { id: 'b1',  type: 'bench',    emoji: '🪑', x: 1000, y: 580,  baseY: 590,  interactive: true, radius: 60, size: 'md' },
  { id: 'b2',  type: 'bench',    emoji: '🪑', x: 1600, y: 1280, baseY: 1290, interactive: true, radius: 60, size: 'md' },
  { id: 'b3',  type: 'bench',    emoji: '🪑', x: 450,  y: 1100, baseY: 1110, interactive: true, radius: 60, size: 'md' },

  // === Rocks (decorative, various sizes) ===
  { id: 'r1',  type: 'rock',     emoji: '🪨', x: 800,  y: 750,  baseY: 755,  interactive: false, radius: 0, size: 'md' },
  { id: 'r2',  type: 'rock',     emoji: '🪨', x: 1900, y: 1350, baseY: 1355, interactive: false, radius: 0, size: 'sm' },
  { id: 'r3',  type: 'rock',     emoji: '🪨', x: 150,  y: 550,  baseY: 555,  interactive: false, radius: 0, size: 'sm' },

  // === Mushrooms (small decorative) ===
  { id: 'm1',  type: 'mushroom', emoji: '🍄', x: 350,  y: 800,  baseY: 805,  interactive: false, radius: 0, size: 'sm' },
  { id: 'm2',  type: 'mushroom', emoji: '🍄', x: 1550, y: 500,  baseY: 505,  interactive: false, radius: 0, size: 'sm' },
  { id: 'm3',  type: 'mushroom', emoji: '🍄', x: 2050, y: 900,  baseY: 905,  interactive: false, radius: 0, size: 'sm' },

  // === Berry bushes (decorative) ===
  { id: 'bb1', type: 'berry',    emoji: '🫐', x: 1200, y: 400,  baseY: 420,  interactive: false, radius: 0, size: 'md' },
  { id: 'bb2', type: 'berry',    emoji: '🍇', x: 750,  y: 1300, baseY: 1320, interactive: false, radius: 0, size: 'md' },

  // === Pond ===
  { id: 'p1',  type: 'pond',     emoji: '💧', x: 1100, y: 900,  baseY: 940,  interactive: false, radius: 0, size: 'lg' },

  // === Signs ===
  { id: 's1',  type: 'sign',     emoji: '🪧', x: 550,  y: 350,  baseY: 365,  interactive: false, radius: 0, size: 'sm' },

  // === Lamps (for night atmosphere) ===
  { id: 'l1',  type: 'lamp',     emoji: '🏮', x: 850,  y: 550,  baseY: 570,  interactive: false, radius: 0, size: 'sm' },
  { id: 'l2',  type: 'lamp',     emoji: '🏮', x: 1500, y: 750,  baseY: 770,  interactive: false, radius: 0, size: 'sm' },
  { id: 'l3',  type: 'lamp',     emoji: '🏮', x: 1900, y: 500,  baseY: 520,  interactive: false, radius: 0, size: 'sm' },
]

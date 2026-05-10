export const TILE_SIZE = 32
export const MAP_ROWS = 30
export const MAP_COLS = 53
export const TILESET_COLUMNS = 32
export const TILESET_ROWS = 48

export type WorldObject = {
  id: string
  type:
    | 'whiteboard'
    | 'converter'
    | 'tv'
    | 'door'
    | 'plant'
    | 'desk'
    | 'poster'
    | 'note'
    | 'game'
    | 'library'
    | 'reception'
    | 'pm'
    | 'crm'
  x: number
  y: number
  width: number
  height: number
  tileId: number
  interactive: boolean
  interactRadius: number
  zLayer: 'below' | 'above'
  targetX?: number
  targetY?: number
  targetRoom?: string
  requiredPermission?: 'room.pm_access' | 'room.crm_access'
  lockedHint?: string
}

export type Room = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  proximityRadius: number
}

export type Section = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  voiceMode: 'common' | 'private'
  focus?: boolean
}

export type Furniture = {
  id: string
  kind: 'table' | 'sofa' | 'desk'
  x: number
  y: number
  width: number
  height: number
  sectionId: string
}

export type DecorPropKind =
  | 'chair-desk'
  | 'lamp-round-floor'
  | 'lounge-sofa'
  | 'lounge-sofa-corner'
  | 'potted-plant'
  | 'rug-square'

export type DecorProp = {
  id: string
  kind: DecorPropKind
  x: number
  y: number
  width: number
  height: number
  sectionId: string
  zLayer: 'below' | 'above'
}

export type Seat = {
  id: string
  label: string
  x: number
  y: number
  sectionId: string
  channelMode: 'common' | 'private'
  channelName: string
}

export const rooms: Room[] = [
  {
    id: 'main',
    name: 'Main Room',
    x: 0,
    y: 0,
    width: MAP_COLS,
    height: MAP_ROWS,
    proximityRadius: 5,
  },
]

const EMPTY_TILE = -1
const FLOOR_TILE = 0

export const floorLayer: number[][] = Array.from({ length: MAP_ROWS }, () =>
  Array.from({ length: MAP_COLS }, () => FLOOR_TILE),
)

export const detailLayer: number[][] = Array.from({ length: MAP_ROWS }, () =>
  Array.from({ length: MAP_COLS }, () => EMPTY_TILE),
)

export const roofLayer: number[][] = Array.from({ length: MAP_ROWS }, () =>
  Array.from({ length: MAP_COLS }, () => EMPTY_TILE),
)

export const objects: WorldObject[] = [
  {
    id: 'conference-screen',
    type: 'tv',
    x: 15,
    y: 1,
    width: 4,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 3,
    zLayer: 'above',
  },
  {
    id: 'lounge-whiteboard',
    type: 'whiteboard',
    x: 25,
    y: 1,
    width: 3,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 3,
    zLayer: 'above',
  },
  {
    id: 'lounge-game-table',
    type: 'game',
    x: 26,
    y: 4,
    width: 2,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 2,
    zLayer: 'above',
  },
  {
    id: 'cafeteria-converter',
    type: 'converter',
    x: 35,
    y: 3,
    width: 4,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 3,
    zLayer: 'above',
  },
  {
    id: 'library-kiosk',
    type: 'library',
    x: 47,
    y: 1,
    width: 4,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 3,
    zLayer: 'above',
  },
  {
    id: 'reception-desk',
    type: 'reception',
    x: 22,
    y: 23,
    width: 9,
    height: 2,
    tileId: 0,
    interactive: true,
    interactRadius: 3,
    zLayer: 'above',
  },
  {
    id: 'pm-room-hotspot',
    type: 'pm',
    x: 23,
    y: 11,
    width: 5,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 3,
    zLayer: 'above',
    requiredPermission: 'room.pm_access',
    lockedHint: 'PM workspace is locked. Requires room.pm_access.',
  },
  {
    id: 'crm-room-hotspot',
    type: 'crm',
    x: 34,
    y: 22,
    width: 8,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 3,
    zLayer: 'above',
    requiredPermission: 'room.crm_access',
    lockedHint: 'CRM workspace is locked. Requires room.crm_access.',
  },
]

export const sections: Section[] = [
  {
    id: 'conference',
    name: 'Conference Room',
    x: 10,
    y: 0,
    width: 11,
    height: 8,
    voiceMode: 'common',
  },
  {
    id: 'lounge',
    name: 'Lounge',
    x: 22,
    y: 0,
    width: 9,
    height: 8,
    voiceMode: 'common',
  },
  {
    id: 'cafeteria',
    name: 'Cafeteria',
    x: 32,
    y: 0,
    width: 12,
    height: 10,
    voiceMode: 'common',
  },
  {
    id: 'library',
    name: 'Library',
    x: 45,
    y: 0,
    width: 7,
    height: 9,
    voiceMode: 'common',
  },
  {
    id: 'desks',
    name: 'Desk Area',
    x: 12,
    y: 10,
    width: 27,
    height: 10,
    voiceMode: 'private',
  },
  {
    id: 'reception',
    name: 'Reception',
    x: 20,
    y: 21,
    width: 13,
    height: 8,
    voiceMode: 'common',
  },
  {
    id: 'side-desks',
    name: 'Desk Rooms',
    x: 0,
    y: 0,
    width: 9,
    height: 29,
    voiceMode: 'private',
  },
  {
    id: 'right-desks',
    name: 'Desk Rooms',
    x: 44,
    y: 9,
    width: 8,
    height: 20,
    voiceMode: 'private',
  },
]

export const furniture: Furniture[] = []

export const decorProps: DecorProp[] = []

export const seats: Seat[] = [
  { id: 'conf-seat-1', label: 'Conference Seat 1', x: 12, y: 3, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-2', label: 'Conference Seat 2', x: 12, y: 4, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-3', label: 'Conference Seat 3', x: 12, y: 5, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-4', label: 'Conference Seat 4', x: 20, y: 3, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-5', label: 'Conference Seat 5', x: 20, y: 4, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-6', label: 'Conference Seat 6', x: 20, y: 5, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-7', label: 'Conference Seat 7', x: 15, y: 6, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-8', label: 'Conference Seat 8', x: 17, y: 6, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },

  { id: 'desk-seat-1', label: 'Desk 1', x: 15, y: 14, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 1' },
  { id: 'desk-seat-2', label: 'Desk 2', x: 24, y: 14, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 2' },
  { id: 'desk-seat-3', label: 'Desk 3', x: 33, y: 14, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 3' },
  { id: 'desk-seat-4', label: 'Desk 4', x: 15, y: 19, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 4' },
  { id: 'desk-seat-5', label: 'Desk 5', x: 24, y: 19, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 5' },
  { id: 'desk-seat-6', label: 'Desk 6', x: 33, y: 19, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 6' },

  { id: 'lounge-seat-1', label: 'Lounge Seat 1', x: 23, y: 6, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'lounge-seat-2', label: 'Lounge Seat 2', x: 26, y: 6, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'lounge-seat-3', label: 'Lounge Seat 3', x: 29, y: 6, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'library-seat-1', label: 'Library Seat 1', x: 47, y: 8, sectionId: 'library', channelMode: 'common', channelName: 'Library' },
  { id: 'library-seat-2', label: 'Library Seat 2', x: 50, y: 8, sectionId: 'library', channelMode: 'common', channelName: 'Library' },
]

const createGrid = (rows: number, cols: number, fill: boolean) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill))

const wallMap = createGrid(MAP_ROWS, MAP_COLS, false)

type Rect = { x: number; y: number; width: number; height: number }

const walkableRects: Rect[] = [
  // Main horizontal and vertical circulation.
  { x: 9, y: 0, width: 1, height: 29 },
  { x: 43, y: 0, width: 1, height: 29 },
  { x: 9, y: 9, width: 35, height: 3 },
  { x: 10, y: 20, width: 34, height: 2 },
  { x: 18, y: 21, width: 2, height: 8 },
  { x: 33, y: 21, width: 1, height: 8 },
  { x: 42, y: 21, width: 2, height: 8 },
  { x: 20, y: 25, width: 13, height: 4 },

  // Left private desk rooms.
  { x: 1, y: 1, width: 7, height: 4 },
  { x: 1, y: 6, width: 7, height: 4 },
  { x: 1, y: 11, width: 7, height: 4 },
  { x: 1, y: 16, width: 7, height: 5 },
  { x: 1, y: 22, width: 7, height: 6 },

  // Top common areas.
  { x: 10, y: 1, width: 11, height: 7 },
  { x: 22, y: 1, width: 9, height: 7 },
  { x: 32, y: 1, width: 11, height: 8 },
  { x: 45, y: 1, width: 7, height: 8 },

  // Central desks and lower common rooms.
  { x: 12, y: 12, width: 27, height: 8 },
  { x: 10, y: 22, width: 9, height: 7 },
  { x: 20, y: 22, width: 13, height: 7 },
  { x: 34, y: 22, width: 9, height: 7 },

  // Right private desk rooms.
  { x: 45, y: 10, width: 7, height: 4 },
  { x: 45, y: 15, width: 7, height: 4 },
  { x: 45, y: 20, width: 7, height: 5 },
]

const walkableMap = createGrid(MAP_ROWS, MAP_COLS, false)

walkableRects.forEach((rect) => {
  for (let row = rect.y; row < rect.y + rect.height; row += 1) {
    for (let col = rect.x; col < rect.x + rect.width; col += 1) {
      if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
        walkableMap[row][col] = true
      }
    }
  }
})

const blockedRects: Rect[] = [
  // Outer bounds.
  { x: 0, y: 0, width: MAP_COLS, height: 1 },
  { x: 0, y: MAP_ROWS - 1, width: MAP_COLS, height: 1 },
  { x: 0, y: 0, width: 1, height: MAP_ROWS },
  { x: MAP_COLS - 1, y: 0, width: 1, height: MAP_ROWS },

  // Baked wall bands and room dividers.
  { x: 8, y: 0, width: 1, height: 30 },
  { x: 44, y: 0, width: 1, height: 30 },
  { x: 10, y: 0, width: 1, height: 9 },
  { x: 21, y: 0, width: 1, height: 9 },
  { x: 31, y: 0, width: 1, height: 9 },
  { x: 44, y: 0, width: 1, height: 9 },
  { x: 10, y: 8, width: 35, height: 1 },
  { x: 0, y: 5, width: 9, height: 1 },
  { x: 0, y: 10, width: 9, height: 1 },
  { x: 0, y: 15, width: 9, height: 1 },
  { x: 0, y: 21, width: 9, height: 1 },
  { x: 0, y: 27, width: 9, height: 1 },
  { x: 44, y: 9, width: 9, height: 1 },
  { x: 44, y: 14, width: 9, height: 1 },
  { x: 44, y: 19, width: 9, height: 1 },
  { x: 44, y: 25, width: 9, height: 1 },
  { x: 10, y: 21, width: 9, height: 1 },
  { x: 19, y: 21, width: 1, height: 8 },
  { x: 33, y: 21, width: 1, height: 8 },
  { x: 42, y: 21, width: 1, height: 8 },

  // Major built-in furniture from the baked background.
  { x: 13, y: 3, width: 7, height: 3 },
  { x: 22, y: 2, width: 8, height: 4 },
  { x: 34, y: 2, width: 9, height: 3 },
  { x: 46, y: 1, width: 6, height: 2 },
  { x: 47, y: 5, width: 4, height: 3 },
  { x: 2, y: 1, width: 5, height: 3 },
  { x: 2, y: 6, width: 5, height: 3 },
  { x: 2, y: 12, width: 5, height: 3 },
  { x: 2, y: 18, width: 5, height: 3 },
  { x: 2, y: 24, width: 5, height: 3 },
  { x: 14, y: 12, width: 5, height: 2 },
  { x: 23, y: 12, width: 5, height: 2 },
  { x: 32, y: 12, width: 5, height: 2 },
  { x: 14, y: 17, width: 5, height: 2 },
  { x: 23, y: 17, width: 5, height: 2 },
  { x: 32, y: 17, width: 5, height: 2 },
  { x: 21, y: 22, width: 11, height: 3 },
  { x: 11, y: 22, width: 7, height: 5 },
  { x: 34, y: 22, width: 8, height: 5 },
  { x: 46, y: 11, width: 5, height: 3 },
  { x: 46, y: 16, width: 5, height: 3 },
  { x: 46, y: 22, width: 5, height: 3 },
]

blockedRects.forEach((rect) => {
  for (let row = rect.y; row < rect.y + rect.height; row += 1) {
    for (let col = rect.x; col < rect.x + rect.width; col += 1) {
      if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
        wallMap[row][col] = true
      }
    }
  }
})

const openings: Rect[] = [
  // Left office doors into the main hallway.
  { x: 8, y: 3, width: 1, height: 2 },
  { x: 8, y: 8, width: 1, height: 2 },
  { x: 8, y: 13, width: 1, height: 2 },
  { x: 8, y: 19, width: 1, height: 2 },
  { x: 8, y: 25, width: 1, height: 2 },

  // Top/common area doors into the central workspace.
  { x: 11, y: 8, width: 3, height: 1 },
  { x: 21, y: 8, width: 4, height: 1 },
  { x: 31, y: 8, width: 4, height: 1 },
  { x: 43, y: 8, width: 3, height: 1 },

  // Right office doors into the hallway.
  { x: 44, y: 4, width: 1, height: 2 },
  { x: 44, y: 11, width: 1, height: 2 },
  { x: 44, y: 17, width: 1, height: 2 },
  { x: 44, y: 23, width: 1, height: 2 },

  // Bottom lounge/cafeteria openings.
  { x: 13, y: 21, width: 4, height: 1 },
  { x: 34, y: 21, width: 4, height: 1 },
]

openings.forEach((rect) => {
  for (let row = rect.y; row < rect.y + rect.height; row += 1) {
    for (let col = rect.x; col < rect.x + rect.width; col += 1) {
      if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
        wallMap[row][col] = false
        walkableMap[row][col] = true
      }
    }
  }
})

export const collisionMap: boolean[][] = Array.from(
  { length: MAP_ROWS },
  (_, row) =>
    Array.from({ length: MAP_COLS }, (_, col) => {
      if (!walkableMap[row][col]) {
        return false
      }
      if (wallMap[row][col]) {
        return false
      }
      const isBlocked = objects.some((object) => {
        if (object.interactive) {
          return false
        }
        return (
          col >= object.x &&
          col < object.x + object.width &&
          row >= object.y &&
          row < object.y + object.height
        )
      })
      return !isBlocked
    }),
)

export { wallMap }

export const tileLayers = {
  floor: floorLayer,
  detail: detailLayer,
  roof: roofLayer,
  emptyTile: EMPTY_TILE,
}

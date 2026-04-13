export const TILE_SIZE = 32
export const MAP_ROWS = 22
export const MAP_COLS = 30
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
    id: 'lounge-whiteboard',
    type: 'whiteboard',
    x: 5,
    y: 11,
    width: 1,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 2,
    zLayer: 'above',
  },
  {
    id: 'cafeteria-converter',
    type: 'converter',
    x: 20,
    y: 10,
    width: 1,
    height: 1,
    tileId: 0,
    interactive: true,
    interactRadius: 2,
    zLayer: 'above',
  },
]

export const sections: Section[] = [
  {
    id: 'conference',
    name: 'Conference Room',
    x: 1,
    y: 1,
    width: 10,
    height: 6,
    voiceMode: 'common',
  },
  {
    id: 'desks',
    name: 'Desk Area',
    x: 12,
    y: 1,
    width: 17,
    height: 6,
    voiceMode: 'private',
  },
  {
    id: 'lounge',
    name: 'Lounge',
    x: 1,
    y: 8,
    width: 9,
    height: 6,
    voiceMode: 'common',
  },
  {
    id: 'cafeteria',
    name: 'Cafeteria',
    x: 12,
    y: 8,
    width: 17,
    height: 6,
    voiceMode: 'common',
  },
  {
    id: 'focus-a',
    name: 'Focus Room A',
    x: 1,
    y: 15,
    width: 6,
    height: 6,
    voiceMode: 'private',
    focus: true,
  },
  {
    id: 'focus-b',
    name: 'Focus Room B',
    x: 8,
    y: 15,
    width: 6,
    height: 6,
    voiceMode: 'private',
    focus: true,
  },
  {
    id: 'focus-c',
    name: 'Focus Room C',
    x: 15,
    y: 15,
    width: 6,
    height: 6,
    voiceMode: 'private',
    focus: true,
  },
  {
    id: 'focus-d',
    name: 'Focus Room D',
    x: 22,
    y: 15,
    width: 6,
    height: 6,
    voiceMode: 'private',
    focus: true,
  },
]

export const furniture: Furniture[] = [
  { id: 'conf-table', kind: 'table', x: 3, y: 3, width: 6, height: 2, sectionId: 'conference' },
  { id: 'desk-1', kind: 'table', x: 13, y: 2, width: 2, height: 1, sectionId: 'desks' },
  { id: 'desk-2', kind: 'table', x: 17, y: 2, width: 2, height: 1, sectionId: 'desks' },
  { id: 'desk-3', kind: 'table', x: 21, y: 2, width: 2, height: 1, sectionId: 'desks' },
  { id: 'desk-4', kind: 'table', x: 13, y: 4, width: 2, height: 1, sectionId: 'desks' },
  { id: 'desk-5', kind: 'table', x: 17, y: 4, width: 2, height: 1, sectionId: 'desks' },
  { id: 'desk-6', kind: 'table', x: 21, y: 4, width: 2, height: 1, sectionId: 'desks' },
  { id: 'sofa-1', kind: 'sofa', x: 2, y: 9, width: 3, height: 1, sectionId: 'lounge' },
  { id: 'sofa-2', kind: 'sofa', x: 6, y: 9, width: 3, height: 1, sectionId: 'lounge' },
  { id: 'sofa-3', kind: 'sofa', x: 4, y: 11, width: 3, height: 1, sectionId: 'lounge' },
  { id: 'caf-converter-table', kind: 'table', x: 19, y: 10, width: 3, height: 1, sectionId: 'cafeteria' },
  { id: 'focus-a-desk', kind: 'desk', x: 2, y: 17, width: 2, height: 1, sectionId: 'focus-a' },
  { id: 'focus-b-desk', kind: 'desk', x: 9, y: 17, width: 2, height: 1, sectionId: 'focus-b' },
  { id: 'focus-c-desk', kind: 'desk', x: 16, y: 17, width: 2, height: 1, sectionId: 'focus-c' },
  { id: 'focus-d-desk', kind: 'desk', x: 23, y: 17, width: 2, height: 1, sectionId: 'focus-d' },
]

export const decorProps: DecorProp[] = [
  // Lounge
  { id: 'lounge-rug-main', kind: 'rug-square', x: 4, y: 9, width: 3, height: 3, sectionId: 'lounge', zLayer: 'below' },
  { id: 'lounge-sofa-1', kind: 'lounge-sofa', x: 2, y: 9, width: 3, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-sofa-2', kind: 'lounge-sofa', x: 6, y: 9, width: 3, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-sofa-corner', kind: 'lounge-sofa-corner', x: 4, y: 11, width: 3, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-lamp-left', kind: 'lamp-round-floor', x: 2, y: 12, width: 1, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-lamp-right', kind: 'lamp-round-floor', x: 8, y: 12, width: 1, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-plant-top-left', kind: 'potted-plant', x: 1, y: 9, width: 1, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-plant-top-right', kind: 'potted-plant', x: 9, y: 9, width: 1, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-plant-bottom-left', kind: 'potted-plant', x: 1, y: 13, width: 1, height: 1, sectionId: 'lounge', zLayer: 'above' },
  { id: 'lounge-plant-bottom-right', kind: 'potted-plant', x: 9, y: 13, width: 1, height: 1, sectionId: 'lounge', zLayer: 'above' },

  // Desk area
  { id: 'desk-main-1', kind: 'chair-desk', x: 13, y: 2, width: 2, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-main-2', kind: 'chair-desk', x: 17, y: 2, width: 2, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-main-3', kind: 'chair-desk', x: 21, y: 2, width: 2, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-main-4', kind: 'chair-desk', x: 13, y: 4, width: 2, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-main-5', kind: 'chair-desk', x: 17, y: 4, width: 2, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-main-6', kind: 'chair-desk', x: 21, y: 4, width: 2, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-plant-1', kind: 'potted-plant', x: 16, y: 2, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-plant-2', kind: 'potted-plant', x: 20, y: 2, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-plant-3', kind: 'potted-plant', x: 24, y: 2, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-plant-4', kind: 'potted-plant', x: 16, y: 4, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-plant-5', kind: 'potted-plant', x: 20, y: 4, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-plant-6', kind: 'potted-plant', x: 24, y: 4, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-lamp-1', kind: 'lamp-round-floor', x: 28, y: 2, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },
  { id: 'desk-lamp-2', kind: 'lamp-round-floor', x: 28, y: 4, width: 1, height: 1, sectionId: 'desks', zLayer: 'above' },

  // Cafeteria
  { id: 'cafeteria-rug-main', kind: 'rug-square', x: 19, y: 9, width: 3, height: 3, sectionId: 'cafeteria', zLayer: 'below' },
  { id: 'cafeteria-lamp-left', kind: 'lamp-round-floor', x: 13, y: 9, width: 1, height: 1, sectionId: 'cafeteria', zLayer: 'above' },
  { id: 'cafeteria-lamp-right', kind: 'lamp-round-floor', x: 27, y: 9, width: 1, height: 1, sectionId: 'cafeteria', zLayer: 'above' },
  { id: 'cafeteria-plant-left', kind: 'potted-plant', x: 13, y: 13, width: 1, height: 1, sectionId: 'cafeteria', zLayer: 'above' },
  { id: 'cafeteria-plant-right', kind: 'potted-plant', x: 27, y: 13, width: 1, height: 1, sectionId: 'cafeteria', zLayer: 'above' },
  { id: 'cafeteria-workstation', kind: 'chair-desk', x: 15, y: 10, width: 2, height: 1, sectionId: 'cafeteria', zLayer: 'above' },

  // Conference
  { id: 'conference-rug-main', kind: 'rug-square', x: 5, y: 2, width: 3, height: 3, sectionId: 'conference', zLayer: 'below' },
  { id: 'conference-plant-1', kind: 'potted-plant', x: 2, y: 2, width: 1, height: 1, sectionId: 'conference', zLayer: 'above' },
  { id: 'conference-plant-2', kind: 'potted-plant', x: 9, y: 2, width: 1, height: 1, sectionId: 'conference', zLayer: 'above' },
  { id: 'conference-plant-3', kind: 'potted-plant', x: 2, y: 5, width: 1, height: 1, sectionId: 'conference', zLayer: 'above' },
  { id: 'conference-plant-4', kind: 'potted-plant', x: 9, y: 5, width: 1, height: 1, sectionId: 'conference', zLayer: 'above' },
  { id: 'conference-lamp-left', kind: 'lamp-round-floor', x: 1, y: 3, width: 1, height: 1, sectionId: 'conference', zLayer: 'above' },
  { id: 'conference-lamp-right', kind: 'lamp-round-floor', x: 10, y: 3, width: 1, height: 1, sectionId: 'conference', zLayer: 'above' },

  // Focus rooms
  { id: 'focus-a-desk-decor', kind: 'chair-desk', x: 2, y: 17, width: 2, height: 1, sectionId: 'focus-a', zLayer: 'above' },
  { id: 'focus-b-desk-decor', kind: 'chair-desk', x: 9, y: 17, width: 2, height: 1, sectionId: 'focus-b', zLayer: 'above' },
  { id: 'focus-c-desk-decor', kind: 'chair-desk', x: 16, y: 17, width: 2, height: 1, sectionId: 'focus-c', zLayer: 'above' },
  { id: 'focus-d-desk-decor', kind: 'chair-desk', x: 23, y: 17, width: 2, height: 1, sectionId: 'focus-d', zLayer: 'above' },
  { id: 'focus-a-lamp', kind: 'lamp-round-floor', x: 5, y: 17, width: 1, height: 1, sectionId: 'focus-a', zLayer: 'above' },
  { id: 'focus-b-lamp', kind: 'lamp-round-floor', x: 12, y: 17, width: 1, height: 1, sectionId: 'focus-b', zLayer: 'above' },
  { id: 'focus-c-lamp', kind: 'lamp-round-floor', x: 19, y: 17, width: 1, height: 1, sectionId: 'focus-c', zLayer: 'above' },
  { id: 'focus-d-lamp', kind: 'lamp-round-floor', x: 26, y: 17, width: 1, height: 1, sectionId: 'focus-d', zLayer: 'above' },
  { id: 'focus-a-plant', kind: 'potted-plant', x: 3, y: 19, width: 1, height: 1, sectionId: 'focus-a', zLayer: 'above' },
  { id: 'focus-b-plant', kind: 'potted-plant', x: 10, y: 19, width: 1, height: 1, sectionId: 'focus-b', zLayer: 'above' },
  { id: 'focus-c-plant', kind: 'potted-plant', x: 17, y: 19, width: 1, height: 1, sectionId: 'focus-c', zLayer: 'above' },
  { id: 'focus-d-plant', kind: 'potted-plant', x: 24, y: 19, width: 1, height: 1, sectionId: 'focus-d', zLayer: 'above' },
]

export const seats: Seat[] = [
  { id: 'conf-seat-1', label: 'Conference Seat 1', x: 3, y: 2, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-2', label: 'Conference Seat 2', x: 4, y: 2, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-3', label: 'Conference Seat 3', x: 5, y: 2, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-4', label: 'Conference Seat 4', x: 6, y: 2, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-5', label: 'Conference Seat 5', x: 7, y: 2, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-6', label: 'Conference Seat 6', x: 8, y: 2, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-7', label: 'Conference Seat 7', x: 4, y: 5, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },
  { id: 'conf-seat-8', label: 'Conference Seat 8', x: 6, y: 5, sectionId: 'conference', channelMode: 'common', channelName: 'Conference Room' },

  { id: 'desk-seat-1', label: 'Desk 1', x: 14, y: 3, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 1' },
  { id: 'desk-seat-2', label: 'Desk 2', x: 18, y: 3, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 2' },
  { id: 'desk-seat-3', label: 'Desk 3', x: 22, y: 3, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 3' },
  { id: 'desk-seat-4', label: 'Desk 4', x: 14, y: 5, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 4' },
  { id: 'desk-seat-5', label: 'Desk 5', x: 18, y: 5, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 5' },
  { id: 'desk-seat-6', label: 'Desk 6', x: 22, y: 5, sectionId: 'desks', channelMode: 'private', channelName: 'Desk 6' },

  { id: 'sofa-seat-1', label: 'Lounge Seat 1', x: 2, y: 10, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-2', label: 'Lounge Seat 2', x: 3, y: 10, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-3', label: 'Lounge Seat 3', x: 4, y: 10, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-4', label: 'Lounge Seat 4', x: 6, y: 10, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-5', label: 'Lounge Seat 5', x: 7, y: 10, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-6', label: 'Lounge Seat 6', x: 8, y: 10, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-7', label: 'Lounge Seat 7', x: 4, y: 12, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-8', label: 'Lounge Seat 8', x: 5, y: 12, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },
  { id: 'sofa-seat-9', label: 'Lounge Seat 9', x: 6, y: 12, sectionId: 'lounge', channelMode: 'common', channelName: 'Lounge' },

  { id: 'focus-seat-a', label: 'Focus Room A Desk', x: 2, y: 18, sectionId: 'focus-a', channelMode: 'private', channelName: 'Focus Room A' },
  { id: 'focus-seat-b', label: 'Focus Room B Desk', x: 9, y: 18, sectionId: 'focus-b', channelMode: 'private', channelName: 'Focus Room B' },
  { id: 'focus-seat-c', label: 'Focus Room C Desk', x: 16, y: 18, sectionId: 'focus-c', channelMode: 'private', channelName: 'Focus Room C' },
  { id: 'focus-seat-d', label: 'Focus Room D Desk', x: 23, y: 18, sectionId: 'focus-d', channelMode: 'private', channelName: 'Focus Room D' },
]

const createGrid = (rows: number, cols: number, fill: boolean) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill))

const wallMap = createGrid(MAP_ROWS, MAP_COLS, false)

const addWallRect = (
  x: number,
  y: number,
  width: number,
  height: number,
  door?: { x: number; y: number },
) => {
  const maxX = x + width - 1
  const maxY = y + height - 1
  for (let col = x; col <= maxX; col += 1) {
    if (!door || door.x !== col || door.y !== y) {
      wallMap[y][col] = true
    }
    if (!door || door.x !== col || door.y !== maxY) {
      wallMap[maxY][col] = true
    }
  }
  for (let row = y; row <= maxY; row += 1) {
    if (!door || door.x !== x || door.y !== row) {
      wallMap[row][x] = true
    }
    if (!door || door.x !== maxX || door.y !== row) {
      wallMap[row][maxX] = true
    }
  }
}

addWallRect(1, 1, 10, 6, { x: 6, y: 6 })
addWallRect(12, 1, 17, 6, { x: 20, y: 6 })
addWallRect(1, 8, 9, 6, { x: 5, y: 8 })
addWallRect(12, 8, 17, 6, { x: 20, y: 8 })
addWallRect(1, 15, 6, 6, { x: 3, y: 15 })
addWallRect(8, 15, 6, 6, { x: 10, y: 15 })
addWallRect(15, 15, 6, 6, { x: 17, y: 15 })
addWallRect(22, 15, 6, 6, { x: 24, y: 15 })

export const collisionMap: boolean[][] = Array.from(
  { length: MAP_ROWS },
  (_, row) =>
    Array.from({ length: MAP_COLS }, (_, col) => {
      if (wallMap[row][col]) {
        return false
      }
      const blockedByFurniture = furniture.some((item) => {
        return (
          col >= item.x &&
          col < item.x + item.width &&
          row >= item.y &&
          row < item.y + item.height
        )
      })
      if (blockedByFurniture) {
        return false
      }
      const isBlocked = objects.some((object) => {
        if (object.type === 'door') {
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

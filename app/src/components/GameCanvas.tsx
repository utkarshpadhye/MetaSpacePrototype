import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { DecorPropKind, WorldObject } from '../canvas/world'
import {
  collisionMap,
  decorProps,
  furniture,
  objects,
  rooms,
  sections,
  seats,
  TILE_SIZE,
  TILESET_COLUMNS,
  TILESET_ROWS,
  tileLayers,
  wallMap,
} from '../canvas/world'
import { useGameLoop } from '../hooks/useGameLoop'

const DEFAULT_ZOOM = 2
const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3]
const ZOOM_ANIMATION_MS = 200
const PLAYER_SPRITE_SIZE = 48
const PLAYER_FRAME_COUNT = 3
const PLAYER_DIRECTIONS = ['down', 'left', 'right', 'up'] as const
const MOVE_INTERVAL_MS = 200
const WALK_FRAME_INTERVAL_MS = 150
const WALK_FRAMES = [0, 1, 2, 1]
const CAMERA_TELEPORT_THRESHOLD = TILE_SIZE * 2
const DECOR_MANIFEST_SRC = '/assets/sprites/props/manifest.json'

type Direction = (typeof PLAYER_DIRECTIONS)[number]

type PlayerState = {
  x: number
  y: number
  prevX: number
  prevY: number
  direction: Direction
  isMoving: boolean
  moveElapsedMs: number
  moveAccumulatorMs: number
  walkElapsedMs: number
  walkFrameIndex: number
  name: string
  path: Array<{ x: number; y: number }>
  roomId: string
}

type PlayerSheetMeta = {
  frameSize: number
  columns: number
  rows: number
  directionRows: [number, number, number, number]
}

type SyncedPeer = {
  id: string
  name: string
  x: number
  y: number
  roomId: string
  muted: boolean
  cameraOff: boolean
}

type PeerRenderState = SyncedPeer & {
  prevX: number
  prevY: number
  moveElapsedMs: number
  proximityState: 'outside' | 'entering' | 'connected' | 'leaving'
  proximityTimerMs: number
  distance: number
}

type DecorSpriteMeta = {
  id: DecorPropKind
  src?: string
  frame?: {
    x: number
    y: number
    width: number
    height: number
  }
  drawWidth: number
  drawHeight: number
  anchorX: number
  anchorY: number
  shadowOffset: number
  shadowOpacity?: number
  offsetX?: number
  offsetY?: number
}

type DecorManifest = {
  atlas?: string
  sprites?: DecorSpriteMeta[]
}

type GameCanvasProps = {
  onHintChange: (hint: string) => void
  interaction: WorldObject | null
  onInteractionChange: (interaction: WorldObject | null) => void
  isTyping: boolean
  speechBubbles: Array<{
    id: string
    text: string
    createdAt: number
    expiresAt: number
  }>
  emojiReactions: Array<{
    id: string
    emoji: string
    createdAt: number
  }>
  onParticipantsUpdate: (
    participants: Array<{
      id: string
      name: string
      muted: boolean
      cameraOff: boolean
      nearby: boolean
      distance: number
      roomId: string
      inSameRoom: boolean
    }>,
  ) => void
  onRoomTransition: (targetRoom: string) => void
  onAssetsReady: () => void
  onVoiceChannelChange: (label: string) => void
  syncedPeers: SyncedPeer[]
  localName: string
  localMuted: boolean
  onLocalPresence: (state: {
    x: number
    y: number
    roomId: string
    muted: boolean
  }) => void
}

function createPlaceholderTileset() {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE * TILESET_COLUMNS
  canvas.height = TILE_SIZE * TILESET_ROWS
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return ''
  }

  const colors = [
    '#1a202c',
    '#2d3748',
    '#4a5568',
    '#2c5282',
    '#285e61',
    '#2f855a',
    '#975a16',
    '#553c9a',
  ]
  let index = 0
  for (let row = 0; row < TILESET_ROWS; row += 1) {
    for (let col = 0; col < TILESET_COLUMNS; col += 1) {
      ctx.fillStyle = colors[index % colors.length]
      ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.strokeRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      index += 1
    }
  }

  return canvas.toDataURL('image/png')
}

function createPlaceholderPlayerSheet() {
  const canvas = document.createElement('canvas')
  canvas.width = PLAYER_SPRITE_SIZE * PLAYER_FRAME_COUNT
  canvas.height = PLAYER_SPRITE_SIZE * PLAYER_DIRECTIONS.length
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return ''
  }

  const baseColors = ['#f56565', '#ed8936', '#ecc94b']
  PLAYER_DIRECTIONS.forEach((_, row) => {
    for (let col = 0; col < PLAYER_FRAME_COUNT; col += 1) {
      const x = col * PLAYER_SPRITE_SIZE
      const y = row * PLAYER_SPRITE_SIZE
      ctx.fillStyle = baseColors[col % baseColors.length]
      ctx.fillRect(x + 2, y + 3, PLAYER_SPRITE_SIZE - 4, PLAYER_SPRITE_SIZE - 5)
      ctx.fillStyle = '#1a202c'
      ctx.fillRect(x + 8, y + 8, 4, 4)
      ctx.fillRect(x + 20, y + 8, 4, 4)
      ctx.fillStyle = '#2d3748'
      ctx.fillRect(x + 10, y + 20, 12, 8)
    }
  })

  return canvas.toDataURL('image/png')
}


export function GameCanvas({
  onHintChange,
  interaction,
  onInteractionChange,
  isTyping,
  speechBubbles,
  emojiReactions,
  onParticipantsUpdate,
  onRoomTransition,
  onAssetsReady,
  onVoiceChannelChange,
  syncedPeers,
  localName,
  localMuted,
  onLocalPresence,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tilesetRef = useRef<HTMLImageElement | null>(null)
  const tilesetReadyRef = useRef(false)
  const playerSheetRef = useRef<HTMLImageElement | null>(null)
  const playerSheetReadyRef = useRef(false)
  const playerSheetMetaRef = useRef<PlayerSheetMeta>({
    frameSize: PLAYER_SPRITE_SIZE,
    columns: PLAYER_FRAME_COUNT,
    rows: PLAYER_DIRECTIONS.length,
    directionRows: [0, 1, 2, 3],
  })
  const tileLayersRef = useRef<{
    floor: HTMLCanvasElement | null
    detail: HTMLCanvasElement | null
    roof: HTMLCanvasElement | null
  }>({ floor: null, detail: null, roof: null })
  const tileLayersReadyRef = useRef(false)
  const decorSpritesRef = useRef<Map<DecorPropKind, DecorSpriteMeta>>(new Map())
  const decorImagesRef = useRef<Map<DecorPropKind, HTMLImageElement>>(new Map())
  const decorAtlasRef = useRef<HTMLImageElement | null>(null)
  const frameRef = useRef({ width: 0, height: 0, dpr: 1 })
  const cameraRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef({
    current: DEFAULT_ZOOM,
    target: DEFAULT_ZOOM,
    start: DEFAULT_ZOOM,
    elapsedMs: 0,
  })
  const lastPlayerPosRef = useRef({ x: 10, y: 10 })
  const highlightRef = useRef({ elapsedMs: 0 })
  const assetsReadyRef = useRef(false)
  const lastDoorTriggerRef = useRef(0)
  const nearestInteractableRef = useRef<WorldObject | null>(null)
  const lastHintRef = useRef('')
  const lastVoiceLabelRef = useRef('')
  const keysHeldRef = useRef<Set<string>>(new Set())
  const seatStateRef = useRef(new Map<string, string | null>())
  const pendingSeatRef = useRef<string | null>(null)
  const selectedSeatRef = useRef<string | null>(null)
  const peersRef = useRef<Map<string, PeerRenderState>>(new Map())
  const peersDirtyRef = useRef(true)
  const playerRef = useRef<PlayerState>({
    x: 10,
    y: 10,
    prevX: 10,
    prevY: 10,
    direction: 'down',
    isMoving: false,
    moveElapsedMs: MOVE_INTERVAL_MS,
    moveAccumulatorMs: 0,
    walkElapsedMs: 0,
    walkFrameIndex: 0,
    name: localName,
    path: [],
    roomId: 'main',
  })
  const tilesetSrc = useMemo(() => '/assets/tilesets/city.png', [])
  const tilesetFallbackSrc = useMemo(() => createPlaceholderTileset(), [])
  const playerSheetSrc = useMemo(() => '/assets/avatars/player.png', [])
  const playerFallbackSrc = useMemo(() => createPlaceholderPlayerSheet(), [])

  useEffect(() => {
    let isCancelled = false

    const loadDecorSprites = async () => {
      try {
        const response = await fetch(DECOR_MANIFEST_SRC)
        if (!response.ok) {
          return
        }
        const payload = (await response.json()) as DecorManifest
        const entries = payload.sprites ?? []
        const metaMap = new Map<DecorPropKind, DecorSpriteMeta>()

        if (payload.atlas) {
          await new Promise<void>((resolve) => {
            const atlasImage = new Image()
            atlasImage.onload = () => {
              if (!isCancelled) {
                decorAtlasRef.current = atlasImage
              }
              resolve()
            }
            atlasImage.onerror = () => resolve()
            atlasImage.src = payload.atlas ?? ''
          })
        }

        await Promise.all(
          entries.map(
            (entry) =>
              new Promise<void>((resolve) => {
                if (!entry.src) {
                  if (!isCancelled) {
                    metaMap.set(entry.id, entry)
                  }
                  resolve()
                  return
                }
                const image = new Image()
                image.onload = () => {
                  if (!isCancelled) {
                    metaMap.set(entry.id, entry)
                    decorImagesRef.current.set(entry.id, image)
                  }
                  resolve()
                }
                image.onerror = () => resolve()
                image.src = entry.src
              }),
          ),
        )

        if (!isCancelled) {
          decorSpritesRef.current = metaMap
        }
      } catch {
        // Keep graceful fallback rendering if sprite assets are not ready.
      }
    }

    void loadDecorSprites()

    return () => {
      isCancelled = true
      decorSpritesRef.current = new Map()
      decorImagesRef.current = new Map()
      decorAtlasRef.current = null
    }
  }, [])

  useEffect(() => {
    playerRef.current.name = localName
  }, [localName])

  useEffect(() => {
    const existing = peersRef.current
    const next = new Map<string, PeerRenderState>()

    syncedPeers.forEach((peer) => {
      const prev = existing.get(peer.id)
      if (prev) {
        const moved = prev.x !== peer.x || prev.y !== peer.y
        next.set(peer.id, {
          ...prev,
          ...peer,
          prevX: moved ? prev.x : prev.prevX,
          prevY: moved ? prev.y : prev.prevY,
          moveElapsedMs: moved ? 0 : Math.min(prev.moveElapsedMs + 16, MOVE_INTERVAL_MS),
        })
        return
      }

      next.set(peer.id, {
        ...peer,
        prevX: peer.x,
        prevY: peer.y,
        moveElapsedMs: MOVE_INTERVAL_MS,
        proximityState: 'outside',
        proximityTimerMs: 0,
        distance: Infinity,
      })
    })

    peersRef.current = next
    peersDirtyRef.current = true
  }, [syncedPeers])

  const setZoomTarget = useCallback((direction: 1 | -1) => {
    const zoomState = zoomRef.current
    const currentIndex = ZOOM_LEVELS.findIndex(
      (level) => Math.abs(level - zoomState.target) < 0.001,
    )
    const safeIndex = currentIndex === -1 ? 2 : currentIndex
    const nextIndex = Math.min(
      ZOOM_LEVELS.length - 1,
      Math.max(0, safeIndex + direction),
    )
    zoomState.start = zoomState.current
    zoomState.target = ZOOM_LEVELS[nextIndex]
    zoomState.elapsedMs = 0
  }, [])

  const buildTileLayer = (layer: number[][]) => {
    if (!tilesetReadyRef.current || !tilesetRef.current) {
      return null
    }
    const offscreen = document.createElement('canvas')
    const width = layer[0].length * TILE_SIZE
    const height = layer.length * TILE_SIZE
    offscreen.width = width
    offscreen.height = height
    const ctx = offscreen.getContext('2d')
    if (!ctx) {
      return null
    }
    ctx.imageSmoothingEnabled = false

    for (let row = 0; row < layer.length; row += 1) {
      const rowData = layer[row]
      for (let col = 0; col < rowData.length; col += 1) {
        const tileId = rowData[col]
        if (tileId < 0) {
          continue
        }
        const sx = (tileId % TILESET_COLUMNS) * TILE_SIZE
        const sy = Math.floor(tileId / TILESET_COLUMNS) * TILE_SIZE
        const dx = col * TILE_SIZE
        const dy = row * TILE_SIZE
        ctx.drawImage(
          tilesetRef.current,
          sx,
          sy,
          TILE_SIZE,
          TILE_SIZE,
          dx,
          dy,
          TILE_SIZE,
          TILE_SIZE,
        )
      }
    }

    return offscreen
  }

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      tilesetReadyRef.current = true
      tileLayersRef.current = {
        floor: buildTileLayer(tileLayers.floor),
        detail: buildTileLayer(tileLayers.detail),
        roof: buildTileLayer(tileLayers.roof),
      }
      tileLayersReadyRef.current = true
      if (playerSheetReadyRef.current && !assetsReadyRef.current) {
        assetsReadyRef.current = true
        onAssetsReady()
      }
    }
    image.onerror = () => {
      if (image.src !== tilesetFallbackSrc) {
        image.src = tilesetFallbackSrc
      }
    }
    image.src = tilesetSrc
    tilesetRef.current = image

    const playerImage = new Image()
    playerImage.onload = () => {
      const width = playerImage.naturalWidth
      const height = playerImage.naturalHeight
      const expectedRows = PLAYER_DIRECTIONS.length
      let frameSize: number = Math.floor(height / expectedRows)
      let rows: number = expectedRows
      let columns: number = frameSize > 0 ? Math.floor(width / frameSize) : 0
      let directionRows: [number, number, number, number] = [0, 1, 2, 3]

      if (width === 192 && height === 192) {
        frameSize = 48
        rows = 4
        columns = 4
        directionRows = [0, 1, 2, 3]
      } else if (width === height && height % 6 === 0) {
        frameSize = Math.floor(height / 6)
        rows = 6
        columns = 6
        directionRows = [0, 1, 2, 3]
      } else if (frameSize <= 0 || width % frameSize !== 0) {
        frameSize = height
        rows = 1
        columns = frameSize > 0 ? Math.floor(width / frameSize) : 0
      }

      if (columns <= 0 || rows <= 0) {
        frameSize = PLAYER_SPRITE_SIZE
        rows = expectedRows
        columns = PLAYER_FRAME_COUNT
      }

      playerSheetMetaRef.current = { frameSize, columns, rows, directionRows }
      playerSheetReadyRef.current = true
      if (tilesetReadyRef.current && !assetsReadyRef.current) {
        assetsReadyRef.current = true
        onAssetsReady()
      }
    }
    playerImage.onerror = () => {
      if (playerImage.src !== playerFallbackSrc) {
        playerImage.src = playerFallbackSrc
      }
    }
    playerImage.src = playerSheetSrc
    playerSheetRef.current = playerImage

    return () => {
      tilesetRef.current = null
      tilesetReadyRef.current = false
      playerSheetRef.current = null
      playerSheetReadyRef.current = false
      tileLayersRef.current = { floor: null, detail: null, roof: null }
      tileLayersReadyRef.current = false
    }
  }, [onAssetsReady, playerFallbackSrc, playerSheetSrc, tilesetFallbackSrc, tilesetSrc])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keysHeldRef.current.add(event.key)

      if (event.key === '+' || event.key === '=') {
        setZoomTarget(1)
      }
      if (event.key === '-') {
        setZoomTarget(-1)
      }

      if (event.key === 'Escape' && interaction) {
        onInteractionChange(null)
      }

      if (
        (event.key === 'x' || event.key === 'X' || event.key === ' ') &&
        !interaction
      ) {
        const nearest = nearestInteractableRef.current
        if (nearest) {
          onInteractionChange(nearest)
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keysHeldRef.current.delete(event.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [interaction, onInteractionChange, setZoomTarget])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      if (interaction || isTyping) {
        return
      }
      const rect = canvas.getBoundingClientRect()
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const { current: zoom } = zoomRef.current
      const camera = cameraRef.current
      const worldX = (localX - camera.x) / zoom
      const worldY = (localY - camera.y) / zoom
      const tileX = Math.floor(worldX / TILE_SIZE)
      const tileY = Math.floor(worldY / TILE_SIZE)
      const seat = seats.find((item) => item.x === tileX && item.y === tileY) ?? null
      if (seat) {
        const selectedSeat = selectedSeatRef.current
        if (selectedSeat === seat.id) {
          seatStateRef.current.set(seat.id, null)
          selectedSeatRef.current = null
          pendingSeatRef.current = null
        } else {
          pendingSeatRef.current = seat.id
        }
      }
      const target = getNearestWalkableTile(tileX, tileY)
      if (!target) {
        return
      }
      const player = playerRef.current
      const path = findPath({ x: player.x, y: player.y }, target)
      player.path = path
    }

    canvas.addEventListener('click', handleClick)

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        return
      }
      event.preventDefault()
      setZoomTarget(event.deltaY < 0 ? 1 : -1)
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [interaction, isTyping, setZoomTarget])

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }
      const dpr = window.devicePixelRatio || 1
      const width = window.innerWidth
      const height = window.innerHeight

      frameRef.current = { width, height, dpr }

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.imageSmoothingEnabled = false
      }
    }

    resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
    }
  }, [])

  const drawPlayer = (ctx: CanvasRenderingContext2D, labelOffsetX: number) => {
    const player = playerRef.current
    const playerSheet = playerSheetRef.current
    const frame = WALK_FRAMES[player.walkFrameIndex]
    const directionIndex = PLAYER_DIRECTIONS.indexOf(player.direction)
    const sourceSize = playerSheetMetaRef.current.frameSize
    const renderSize = sourceSize
    const sheetColumns = Math.max(1, playerSheetMetaRef.current.columns)
    const sheetRows = Math.max(1, playerSheetMetaRef.current.rows)
    const clampedFrame = Math.min(frame, sheetColumns - 1)
    const sx = clampedFrame * sourceSize
    const directionRow = playerSheetMetaRef.current.directionRows[directionIndex]
    const sy = sheetRows >= PLAYER_DIRECTIONS.length ? directionRow * sourceSize : 0
    const lerpFactor = Math.min(player.moveElapsedMs / MOVE_INTERVAL_MS, 1)
    const visualX = player.prevX + (player.x - player.prevX) * lerpFactor
    const visualY = player.prevY + (player.y - player.prevY) * lerpFactor
    const drawX = visualX * TILE_SIZE + (TILE_SIZE - renderSize) / 2
    const drawY = visualY * TILE_SIZE - (renderSize - TILE_SIZE)

    if (playerSheetReadyRef.current && playerSheet) {
      ctx.drawImage(
        playerSheet,
        sx,
        sy,
        sourceSize,
        sourceSize,
        drawX,
        drawY,
        renderSize,
        renderSize,
      )
    } else {
      ctx.fillStyle = '#f56565'
      ctx.fillRect(drawX, drawY, renderSize, renderSize)
    }

    const labelText = player.name
    ctx.font = "12px 'Press Start 2P', Arial"
    const textWidth = ctx.measureText(labelText).width
    const paddingX = 6
    const paddingY = 2
    const labelWidth = textWidth + paddingX * 2
    const labelHeight = 14
    const labelX = drawX + renderSize / 2 - labelWidth / 2 + labelOffsetX
    const labelY = drawY - 14

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 10)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
    ctx.shadowBlur = 2
    ctx.shadowOffsetY = 1
    ctx.fillText(labelText, labelX + paddingX, labelY + labelHeight - paddingY)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }

  const drawPeer = (
    ctx: CanvasRenderingContext2D,
    peer: {
      id: string
      name: string
      prevX: number
      prevY: number
      x: number
      y: number
      moveElapsedMs: number
      distance: number
      proximityState: 'outside' | 'entering' | 'connected' | 'leaving'
    },
    labelOffsetX: number,
      now: number,
  ) => {
    const lerpFactor = Math.min(peer.moveElapsedMs / MOVE_INTERVAL_MS, 1)
    const visualX = peer.prevX + (peer.x - peer.prevX) * lerpFactor
    const visualY = peer.prevY + (peer.y - peer.prevY) * lerpFactor
    const renderSize = playerSheetMetaRef.current.frameSize
    const drawX = visualX * TILE_SIZE + (TILE_SIZE - renderSize) / 2
    const drawY = visualY * TILE_SIZE - (renderSize - TILE_SIZE)

    if (peer.proximityState === 'connected') {
      drawProximityRing(ctx, visualX, visualY, peer.distance, now)
    }

    const peerSheet = playerSheetRef.current
    const sourceSize = playerSheetMetaRef.current.frameSize
    const sheetColumns = Math.max(1, playerSheetMetaRef.current.columns)
    const idleFrame = 0
    const sx = Math.min(idleFrame, sheetColumns - 1) * sourceSize
    const sy = 0

    if (playerSheetReadyRef.current && peerSheet) {
      ctx.drawImage(
        peerSheet,
        sx,
        sy,
        sourceSize,
        sourceSize,
        drawX,
        drawY,
        renderSize,
        renderSize,
      )
    } else {
      ctx.fillStyle = '#63b3ed'
      ctx.fillRect(drawX, drawY, renderSize, renderSize)
    }

    ctx.font = "12px 'Press Start 2P', Arial"
    const textWidth = ctx.measureText(peer.name).width
    const paddingX = 6
    const paddingY = 2
    const labelWidth = textWidth + paddingX * 2
    const labelHeight = 14
    const labelX = drawX + renderSize / 2 - labelWidth / 2 + labelOffsetX
    const labelY = drawY - 14

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 10)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
    ctx.shadowBlur = 2
    ctx.shadowOffsetY = 1
    ctx.fillText(peer.name, labelX + paddingX, labelY + labelHeight - paddingY)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }

  const drawProximityRing = (
    ctx: CanvasRenderingContext2D,
    visualX: number,
    visualY: number,
    distance: number,
    now: number,
  ) => {
    const radius = TILE_SIZE * 0.8
    const strength = Math.max(0, 1 - distance / 5)
    const pulse = (Math.sin(now / 1000) + 1) / 2
    const scale = 1 + 0.15 * pulse
    const opacity = 0.3 + 0.3 * strength

    ctx.save()
    ctx.beginPath()
    ctx.fillStyle = `rgba(72, 187, 120, ${opacity})`
    ctx.arc(
      visualX * TILE_SIZE + TILE_SIZE / 2,
      visualY * TILE_SIZE + TILE_SIZE / 2,
      radius * scale,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.restore()
  }

  const drawSpeechBubbles = (
    ctx: CanvasRenderingContext2D,
    visualX: number,
    visualY: number,
      now: number,
  ) => {
    const bubble = speechBubbles[speechBubbles.length - 1]
    if (!bubble || now > bubble.expiresAt) {
      return
    }
    const fadeStart = bubble.expiresAt - 500
    const opacity = now >= fadeStart ? 1 - (now - fadeStart) / 500 : 1

    ctx.save()
    ctx.globalAlpha = Math.max(0, opacity)
    ctx.font = '11px Arial'

    const maxWidth = 200
    const lines = wrapText(ctx, bubble.text, maxWidth)
    const lineHeight = 14
    const textWidth = Math.max(
      ...lines.map((line) => ctx.measureText(line).width),
    )
    const paddingX = 8
    const paddingY = 6
    const bubbleWidth = textWidth + paddingX * 2
    const bubbleHeight = lineHeight * lines.length + paddingY * 2
    const drawX = visualX * TILE_SIZE + TILE_SIZE / 2 - bubbleWidth / 2
    const drawY = visualY * TILE_SIZE - PLAYER_SPRITE_SIZE - bubbleHeight - 8

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    roundRect(ctx, drawX, drawY, bubbleWidth, bubbleHeight, 8)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(drawX + bubbleWidth / 2 - 6, drawY + bubbleHeight)
    ctx.lineTo(drawX + bubbleWidth / 2 + 6, drawY + bubbleHeight)
    ctx.lineTo(drawX + bubbleWidth / 2, drawY + bubbleHeight + 8)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#1a202c'
    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        drawX + paddingX,
        drawY + paddingY + lineHeight * (index + 1) - 4,
      )
    })
    ctx.restore()
  }

  const drawEmojiReactions = (
    ctx: CanvasRenderingContext2D,
    visualX: number,
    visualY: number,
      now: number,
  ) => {
    emojiReactions.forEach((reaction) => {
      const elapsed = now - reaction.createdAt
      const progress = Math.min(elapsed / 2000, 1)
      if (progress >= 1) {
        return
      }
      const opacity = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1
      const offsetY = 60 * progress
      const scale = 1 - 0.2 * progress

      ctx.save()
      ctx.globalAlpha = opacity
      ctx.font = `${48 * scale}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText(
        reaction.emoji,
        visualX * TILE_SIZE + TILE_SIZE / 2,
        visualY * TILE_SIZE - offsetY - 20,
      )
      ctx.restore()
    })
  }

  const drawObjects = (
    ctx: CanvasRenderingContext2D,
    layer: 'below' | 'above',
  ) => {
    objects
      .filter((object) => object.zLayer === layer)
      .forEach((object) => {
        const drawX = object.x * TILE_SIZE
        const drawY = object.y * TILE_SIZE
        if (object.type === 'whiteboard') {
          const drawW = object.width * TILE_SIZE
          const drawH = object.height * TILE_SIZE
          ctx.save()
          ctx.fillStyle = '#f8fafc'
          ctx.strokeStyle = '#475569'
          ctx.lineWidth = 2
          roundRect(ctx, drawX + 4, drawY + 4, drawW - 8, drawH - 8, 4)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#334155'
          ctx.font = '8px "Press Start 2P", sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('WB', drawX + drawW / 2, drawY + drawH / 2)
          ctx.restore()
          return
        }
        if (object.type === 'converter') {
          const drawW = object.width * TILE_SIZE
          const drawH = object.height * TILE_SIZE
          ctx.save()
          ctx.fillStyle = '#e6fffa'
          ctx.strokeStyle = '#0f766e'
          ctx.lineWidth = 2
          roundRect(ctx, drawX + 4, drawY + 4, drawW - 8, drawH - 8, 4)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#115e59'
          ctx.font = '8px "Press Start 2P", sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('CV', drawX + drawW / 2, drawY + drawH / 2)
          ctx.restore()
          return
        }
        if (tilesetReadyRef.current && tilesetRef.current) {
          const tileX = object.tileId % TILESET_COLUMNS
          const tileY = Math.floor(object.tileId / TILESET_COLUMNS)
          ctx.drawImage(
            tilesetRef.current,
            tileX * TILE_SIZE,
            tileY * TILE_SIZE,
            object.width * TILE_SIZE,
            object.height * TILE_SIZE,
            drawX,
            drawY,
            object.width * TILE_SIZE,
            object.height * TILE_SIZE,
          )
        } else {
          ctx.fillStyle = getObjectColor(object.type)
          ctx.fillRect(
            drawX,
            drawY,
            object.width * TILE_SIZE,
            object.height * TILE_SIZE,
          )
        }
      })
  }

  const drawWalls = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.fillStyle = '#d7dee9'
    ctx.strokeStyle = '#b6c0d5'
    ctx.lineWidth = 1
    for (let row = 0; row < wallMap.length; row += 1) {
      for (let col = 0; col < wallMap[row].length; col += 1) {
        if (!wallMap[row][col]) {
          continue
        }
        const x = col * TILE_SIZE
        const y = row * TILE_SIZE
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
      }
    }
    ctx.restore()
  }

  const drawSectionLabels = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.font = '10px "Press Start 2P", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    sections.forEach((section) => {
      const centerX = (section.x + section.width / 2) * TILE_SIZE
      const labelY = (section.y + 0.7) * TILE_SIZE
      const paddingX = 8
      const paddingY = 6
      const textWidth = ctx.measureText(section.name).width
      const boxWidth = textWidth + paddingX * 2
      const boxHeight = 16 + paddingY
      const drawX = centerX - boxWidth / 2
      const drawY = labelY - boxHeight / 2
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.strokeStyle = '#c3ccdd'
      ctx.lineWidth = 1
      roundRect(ctx, drawX, drawY, boxWidth, boxHeight, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#2d3748'
      ctx.fillText(section.name, centerX, labelY)
    })
    ctx.restore()
  }

  const drawFurniture = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    const hiddenFurnitureIds = new Set([
      'desk-1',
      'desk-2',
      'desk-3',
      'desk-4',
      'desk-5',
      'desk-6',
      'sofa-1',
      'sofa-2',
      'sofa-3',
      'focus-a-desk',
      'focus-b-desk',
      'focus-c-desk',
      'focus-d-desk',
    ])
    furniture.forEach((item) => {
      if (hiddenFurnitureIds.has(item.id)) {
        return
      }
      const x = item.x * TILE_SIZE
      const y = item.y * TILE_SIZE
      const w = item.width * TILE_SIZE
      const h = item.height * TILE_SIZE
      if (item.kind === 'table') {
        ctx.fillStyle = '#cbd5e0'
        ctx.strokeStyle = '#94a3b8'
      } else if (item.kind === 'sofa') {
        ctx.fillStyle = '#cbb4a5'
        ctx.strokeStyle = '#a08b7f'
      } else {
        ctx.fillStyle = '#e2d8c3'
        ctx.strokeStyle = '#b8ab93'
      }
      ctx.lineWidth = 1
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    })
    ctx.restore()
  }

  const drawDecorFallback = (
    ctx: CanvasRenderingContext2D,
    kind: DecorPropKind,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
  ) => {
    ctx.save()
    if (kind === 'rug-square') {
      ctx.fillStyle = '#fee7c4'
      ctx.strokeStyle = '#d6a96c'
      ctx.lineWidth = 1
      roundRect(ctx, drawX + 2, drawY + 2, drawW - 4, drawH - 4, 5)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      return
    }

    if (kind === 'potted-plant') {
      ctx.fillStyle = '#9a6a3a'
      roundRect(ctx, drawX + drawW * 0.25, drawY + drawH * 0.64, drawW * 0.5, drawH * 0.3, 3)
      ctx.fill()
      ctx.fillStyle = '#3f8f4a'
      ctx.beginPath()
      ctx.arc(drawX + drawW / 2, drawY + drawH * 0.4, drawW * 0.26, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    if (kind === 'lamp-round-floor') {
      ctx.fillStyle = '#d8c8a8'
      roundRect(ctx, drawX + drawW * 0.44, drawY + drawH * 0.2, drawW * 0.12, drawH * 0.56, 2)
      ctx.fill()
      ctx.fillStyle = '#efe5c8'
      ctx.beginPath()
      ctx.ellipse(drawX + drawW / 2, drawY + drawH * 0.2, drawW * 0.24, drawH * 0.14, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    if (kind === 'lounge-sofa' || kind === 'lounge-sofa-corner') {
      ctx.fillStyle = '#be9d8a'
      roundRect(ctx, drawX + 1, drawY + drawH * 0.28, drawW - 2, drawH * 0.62, 5)
      ctx.fill()
      ctx.fillStyle = '#d6b39d'
      roundRect(ctx, drawX + 3, drawY + drawH * 0.14, drawW - 6, drawH * 0.28, 4)
      ctx.fill()
      ctx.restore()
      return
    }

    ctx.fillStyle = '#d9dee6'
    ctx.strokeStyle = '#a2adbb'
    ctx.lineWidth = 1
    roundRect(ctx, drawX + 1, drawY + 1, drawW - 2, drawH - 2, 4)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  const drawDecor = (ctx: CanvasRenderingContext2D, layer: 'below' | 'above') => {
    decorProps
      .filter((prop) => prop.zLayer === layer)
      .forEach((prop) => {
        const sprite = decorSpritesRef.current.get(prop.kind)
        const image = decorImagesRef.current.get(prop.kind)
        const atlas = decorAtlasRef.current

        const targetW = prop.width * TILE_SIZE
        const targetH = prop.height * TILE_SIZE

        if (!sprite || (!image && !(atlas && sprite.frame))) {
          drawDecorFallback(ctx, prop.kind, prop.x * TILE_SIZE, prop.y * TILE_SIZE, targetW, targetH)
          return
        }

        const drawW = sprite.drawWidth * TILE_SIZE
        const drawH = sprite.drawHeight * TILE_SIZE
        const anchorWorldX = prop.x * TILE_SIZE + targetW * sprite.anchorX
        const anchorWorldY = prop.y * TILE_SIZE + targetH * sprite.anchorY
        const drawX =
          anchorWorldX - drawW * sprite.anchorX + (sprite.offsetX ?? 0) * TILE_SIZE
        const drawY =
          anchorWorldY - drawH * sprite.anchorY + (sprite.offsetY ?? 0) * TILE_SIZE

        if (sprite.shadowOffset > 0) {
          ctx.save()
          ctx.fillStyle = `rgba(0, 0, 0, ${sprite.shadowOpacity ?? 0.14})`
          ctx.beginPath()
          ctx.ellipse(
            anchorWorldX,
            anchorWorldY + sprite.shadowOffset,
            drawW * 0.34,
            Math.max(3, drawH * 0.08),
            0,
            0,
            Math.PI * 2,
          )
          ctx.fill()
          ctx.restore()
        }

        if (atlas && sprite.frame) {
          ctx.drawImage(
            atlas,
            sprite.frame.x,
            sprite.frame.y,
            sprite.frame.width,
            sprite.frame.height,
            drawX,
            drawY,
            drawW,
            drawH,
          )
          return
        }

        if (image) {
          ctx.drawImage(image, drawX, drawY, drawW, drawH)
        }
      })
  }

  const drawSectionAmbience = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    const ambienceBySection: Record<string, string> = {
      conference: 'rgba(115, 169, 232, 0.08)',
      desks: 'rgba(147, 197, 114, 0.06)',
      lounge: 'rgba(232, 161, 98, 0.08)',
      cafeteria: 'rgba(244, 200, 120, 0.07)',
      'focus-a': 'rgba(204, 175, 245, 0.07)',
      'focus-b': 'rgba(204, 175, 245, 0.07)',
      'focus-c': 'rgba(204, 175, 245, 0.07)',
      'focus-d': 'rgba(204, 175, 245, 0.07)',
    }

    sections.forEach((section) => {
      const fill = ambienceBySection[section.id]
      if (!fill) {
        return
      }
      const x = section.x * TILE_SIZE + 1
      const y = section.y * TILE_SIZE + 1
      const w = section.width * TILE_SIZE - 2
      const h = section.height * TILE_SIZE - 2
      ctx.fillStyle = fill
      ctx.fillRect(x, y, w, h)
    })

    ctx.restore()
  }

  const drawSeats = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    seats.forEach((seat) => {
      const occupant = seatStateRef.current.get(seat.id)
      const x = seat.x * TILE_SIZE
      const y = seat.y * TILE_SIZE
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16)
      if (occupant) {
        ctx.fillStyle = occupant === 'you' ? '#3182ce' : '#6b7280'
        ctx.beginPath()
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    ctx.restore()
  }

  const drawFocusRooms = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    sections
      .filter((section) => section.focus)
      .forEach((section) => {
        const x = section.x * TILE_SIZE
        const y = section.y * TILE_SIZE
        const w = section.width * TILE_SIZE
        const h = section.height * TILE_SIZE
        ctx.fillStyle = 'rgba(255, 120, 120, 0.18)'
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = '#d1d5db'
        ctx.font = '10px "Press Start 2P", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('DO NOT DISTURB', x + w / 2, y + h / 2)
      })
    ctx.restore()
  }

  const drawInteractionHighlight = (
    ctx: CanvasRenderingContext2D,
    object: WorldObject,
  ) => {
    const pulse = (Math.sin(highlightRef.current.elapsedMs / 600) + 1) / 2
    const opacity = 0.7 + pulse * 0.3
    const drawX = object.x * TILE_SIZE
    const drawY = object.y * TILE_SIZE
    const drawW = object.width * TILE_SIZE
    const drawH = object.height * TILE_SIZE

    ctx.save()
    ctx.strokeStyle = `rgba(255, 220, 50, ${opacity})`
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(255, 220, 50, 0.4)'
    ctx.shadowBlur = 8
    ctx.strokeRect(drawX + 1, drawY + 1, drawW - 2, drawH - 2)

    const corner = 8
    ctx.beginPath()
    ctx.moveTo(drawX, drawY + corner)
    ctx.lineTo(drawX, drawY)
    ctx.lineTo(drawX + corner, drawY)
    ctx.moveTo(drawX + drawW - corner, drawY)
    ctx.lineTo(drawX + drawW, drawY)
    ctx.lineTo(drawX + drawW, drawY + corner)
    ctx.moveTo(drawX, drawY + drawH - corner)
    ctx.lineTo(drawX, drawY + drawH)
    ctx.lineTo(drawX + corner, drawY + drawH)
    ctx.moveTo(drawX + drawW - corner, drawY + drawH)
    ctx.lineTo(drawX + drawW, drawY + drawH)
    ctx.lineTo(drawX + drawW, drawY + drawH - corner)
    ctx.stroke()
    ctx.restore()
  }

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) => {
    const clampedRadius = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(x + clampedRadius, y)
    ctx.lineTo(x + width - clampedRadius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadius)
    ctx.lineTo(x + width, y + height - clampedRadius)
    ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - clampedRadius,
      y + height,
    )
    ctx.lineTo(x + clampedRadius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadius)
    ctx.lineTo(x, y + clampedRadius)
    ctx.quadraticCurveTo(x, y, x + clampedRadius, y)
    ctx.closePath()
  }

  const getObjectColor = (type: WorldObject['type']) => {
    switch (type) {
      case 'whiteboard':
        return '#edf2f7'
      case 'tv':
        return '#1a202c'
      case 'converter':
        return '#c6f6d5'
      case 'door':
        return '#805ad5'
      case 'plant':
        return '#2f855a'
      case 'desk':
        return '#975a16'
      default:
        return '#718096'
    }
  }

  const getObjectLabel = (type: WorldObject['type']) => {
    switch (type) {
      case 'whiteboard':
        return 'Whiteboard'
      case 'tv':
        return 'Presentation Screen'
      case 'converter':
        return 'File Converter'
      case 'door':
        return 'Door'
      case 'plant':
        return 'Plant'
      case 'desk':
        return 'Desk'
      case 'poster':
        return 'Poster'
      case 'note':
        return 'Note'
      case 'game':
        return 'Mini Game'
      default:
        return 'Object'
    }
  }

  const findNearestInteractable = (playerState: PlayerState) => {
    let nearest: WorldObject | null = null
    let nearestDistance = Infinity
    for (const object of objects) {
      if (!object.interactive) {
        continue
      }
      const centerX = object.x + object.width / 2
      const centerY = object.y + object.height / 2
      const dx = centerX - playerState.x
      const dy = centerY - playerState.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= object.interactRadius && distance < nearestDistance) {
        nearest = object
        nearestDistance = distance
      }
    }
    return nearest
  }

  const updateInteractionState = (nearest: WorldObject | null) => {
    nearestInteractableRef.current = nearest
    const hint = nearest ? `Press X to use ${getObjectLabel(nearest.type)}` : ''
    if (hint !== lastHintRef.current) {
      lastHintRef.current = hint
      onHintChange(hint)
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.cursor = nearest ? 'pointer' : 'default'
    }
  }

  function getSectionAt(x: number, y: number) {
    return (
      sections.find(
        (section) =>
          x >= section.x &&
          x < section.x + section.width &&
          y >= section.y &&
          y < section.y + section.height,
      ) ?? null
    )
  }

  const updateVoiceLabel = (label: string) => {
    if (label !== lastVoiceLabelRef.current) {
      lastVoiceLabelRef.current = label
      onVoiceChannelChange(label)
    }
  }

  const updateProximity = (
    playerState: PlayerState,
    peers: Array<{
      id: string
      name: string
      x: number
      y: number
      roomId: string
      proximityState: 'outside' | 'entering' | 'connected' | 'leaving'
      proximityTimerMs: number
      distance: number
      muted: boolean
      cameraOff: boolean
    }>,
    deltaMs: number,
  ) => {
    let participantsChanged = false
    const room = rooms.find((item) => item.id === playerState.roomId)
    const proximityRadius = room?.proximityRadius ?? 5

    peers.forEach((peer) => {
      if (peer.roomId !== playerState.roomId) {
        peer.distance = Infinity
        if (peer.proximityState !== 'outside') {
          peer.proximityState = 'outside'
          peer.proximityTimerMs = 0
          participantsChanged = true
        }
        return
      }

      const dx = peer.x - playerState.x
      const dy = peer.y - playerState.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      peer.distance = distance

      if (distance <= proximityRadius) {
        if (peer.proximityState === 'outside') {
          peer.proximityState = 'entering'
          peer.proximityTimerMs = 0
          participantsChanged = true
        }
        if (peer.proximityState === 'entering') {
          peer.proximityTimerMs += deltaMs
          if (peer.proximityTimerMs >= 300) {
            peer.proximityState = 'connected'
            peer.proximityTimerMs = 0
            participantsChanged = true
          }
        }
        if (peer.proximityState === 'leaving') {
          peer.proximityState = 'connected'
          peer.proximityTimerMs = 0
          participantsChanged = true
        }
      } else {
        if (peer.proximityState === 'connected') {
          peer.proximityState = 'leaving'
          peer.proximityTimerMs = 0
          participantsChanged = true
        }
        if (peer.proximityState === 'leaving') {
          peer.proximityTimerMs += deltaMs
          if (peer.proximityTimerMs >= 500) {
            peer.proximityState = 'outside'
            peer.proximityTimerMs = 0
            participantsChanged = true
          }
        }
      }
    })

    if (participantsChanged || peersDirtyRef.current) {
      peersDirtyRef.current = false
      onParticipantsUpdate(
        peers.map((peer) => ({
          id: peer.id,
          name: peer.name,
          muted: peer.muted,
          cameraOff: peer.cameraOff,
          nearby: peer.proximityState === 'connected',
          distance: peer.distance,
          roomId: peer.roomId,
          inSameRoom: peer.roomId === playerState.roomId,
        })),
      )
    }
  }

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ) => {
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = testLine
      }
    })

    if (line) {
      lines.push(line)
    }

    return lines
  }

  const getLabelOffsets = (
    playerState: PlayerState,
    peers: Array<{ id: string; x: number; y: number }>,
  ) => {
    const map = new Map<string, number>()
    const grouped = new Map<string, Array<{ id: string }>>()

    const entities = [
      { id: 'you', x: playerState.x, y: playerState.y },
      ...peers.map((peer) => ({ id: peer.id, x: peer.x, y: peer.y })),
    ]

    entities.forEach((entity) => {
      const key = `${entity.x},${entity.y}`
      const list = grouped.get(key) ?? []
      list.push({ id: entity.id })
      grouped.set(key, list)
    })

    grouped.forEach((group) => {
      if (group.length <= 1) {
        return
      }
      group.forEach((entity, index) => {
        const offset = (index - group.length / 2) * 20
        map.set(entity.id, offset)
      })
    })

    return map
  }

  const updateCamera = (playerX: number, playerY: number) => {
    const { width, height } = frameRef.current
    const zoom = zoomRef.current.current
    const mapWidth = TILE_SIZE * collisionMap[0].length
    const mapHeight = TILE_SIZE * collisionMap.length
    const targetX = width / 2 - (playerX * TILE_SIZE + TILE_SIZE / 2) * zoom
    const targetY = height / 2 - (playerY * TILE_SIZE + TILE_SIZE / 2) * zoom

    const clamped = clampCamera(
      targetX,
      targetY,
      width,
      height,
      zoom,
      mapWidth,
      mapHeight,
    )
    const camera = cameraRef.current
    const lastPlayer = lastPlayerPosRef.current
    const playerJump =
      Math.hypot(playerX - lastPlayer.x, playerY - lastPlayer.y) * TILE_SIZE
    const useLerp = playerJump > CAMERA_TELEPORT_THRESHOLD

    if (useLerp) {
      camera.x += (clamped.x - camera.x) * 0.12
      camera.y += (clamped.y - camera.y) * 0.12
    } else {
      camera.x = clamped.x
      camera.y = clamped.y
    }

    lastPlayerPosRef.current = { x: playerX, y: playerY }
  }

  const clampCamera = (
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number,
    zoom: number,
    mapWidth: number,
    mapHeight: number,
  ) => {
    const maxX = 0
    const maxY = 0
    const minX = -(mapWidth * zoom - viewportWidth)
    const minY = -(mapHeight * zoom - viewportHeight)

    const clampedX = Math.min(maxX, Math.max(minX, x))
    const clampedY = Math.min(maxY, Math.max(minY, y))

    const finalX =
      mapWidth * zoom <= viewportWidth
        ? (viewportWidth - mapWidth * zoom) / 2
        : clampedX
    const finalY =
      mapHeight * zoom <= viewportHeight
        ? (viewportHeight - mapHeight * zoom) / 2
        : clampedY

    return { x: finalX, y: finalY }
  }

  useGameLoop((deltaMs) => {
    const player = playerRef.current
    const keysHeld = keysHeldRef.current
    const movementLocked = interaction || isTyping
    let moveKey = movementLocked ? null : getMoveInput(keysHeld)
    const usingPath = !movementLocked && !moveKey && player.path.length > 0

    if (selectedSeatRef.current) {
      const seat = seats.find((item) => item.id === selectedSeatRef.current)
      if (seat && (player.x !== seat.x || player.y !== seat.y)) {
        seatStateRef.current.set(seat.id, null)
        selectedSeatRef.current = null
      }
    }

    if (movementLocked && player.path.length > 0) {
      player.path = []
    }

    if (moveKey) {
      player.path = []
    } else if (usingPath) {
      const nextStep = player.path[0]
      const dx = nextStep.x - player.x
      const dy = nextStep.y - player.y
      if (dx === 0 && dy === 0) {
        player.path.shift()
      } else if (Math.abs(dx) + Math.abs(dy) === 1) {
        moveKey = {
          dx,
          dy,
          direction: dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up',
        }
      } else {
        player.path = []
      }
    }

    if (moveKey) {
      player.direction = moveKey.direction
      player.moveAccumulatorMs += deltaMs
      while (player.moveAccumulatorMs >= MOVE_INTERVAL_MS) {
        player.moveAccumulatorMs -= MOVE_INTERVAL_MS
        const targetX = player.x + moveKey.dx
        const targetY = player.y + moveKey.dy
        if (canMoveTo(targetX, targetY)) {
          player.prevX = player.x
          player.prevY = player.y
          player.x = targetX
          player.y = targetY
          player.moveElapsedMs = 0
          player.isMoving = true
          if (usingPath && player.path.length > 0) {
            const nextStep = player.path[0]
            if (player.x === nextStep.x && player.y === nextStep.y) {
              player.path.shift()
            }
          }
        } else {
          player.isMoving = false
          if (usingPath) {
            player.path = []
          }
        }
      }
    } else {
      player.isMoving = false
      player.moveAccumulatorMs = 0
    }

    if (player.isMoving) {
      player.moveElapsedMs = Math.min(
        player.moveElapsedMs + deltaMs,
        MOVE_INTERVAL_MS,
      )
      player.walkElapsedMs += deltaMs
      if (player.walkElapsedMs >= WALK_FRAME_INTERVAL_MS) {
        player.walkElapsedMs -= WALK_FRAME_INTERVAL_MS
        player.walkFrameIndex =
          (player.walkFrameIndex + 1) % WALK_FRAMES.length
      }
    } else {
      player.moveElapsedMs = MOVE_INTERVAL_MS
      player.walkElapsedMs = 0
      player.walkFrameIndex = 0
    }

    const door = objects.find((object) => object.type === 'door')
    if (
      door &&
      player.x === door.x &&
      player.y === door.y &&
      Date.now() - lastDoorTriggerRef.current > 1000
    ) {
      lastDoorTriggerRef.current = Date.now()
      player.prevX = player.x
      player.prevY = player.y
      player.x = door.targetX ?? player.x
      player.y = door.targetY ?? player.y
      player.path = []
      if (door.targetRoom) {
        player.roomId = getRoomIdFromName(door.targetRoom)
      }
      if (door.targetRoom) {
        onRoomTransition(door.targetRoom)
      }
    }

    if (pendingSeatRef.current) {
      const seat = seats.find((item) => item.id === pendingSeatRef.current)
      if (seat && player.x === seat.x && player.y === seat.y) {
        seatStateRef.current.set(seat.id, 'you')
        selectedSeatRef.current = seat.id
        pendingSeatRef.current = null
      }
    }

    const peers = Array.from(peersRef.current.values())
    peers.forEach((peer) => {
      peer.moveElapsedMs = Math.min(peer.moveElapsedMs + deltaMs, MOVE_INTERVAL_MS)
    })

    updateProximity(player, peers, deltaMs)

    onLocalPresence({
      x: player.x,
      y: player.y,
      roomId: player.roomId,
      muted: localMuted,
    })

    highlightRef.current.elapsedMs += deltaMs

    const zoomState = zoomRef.current
    if (zoomState.current !== zoomState.target) {
      zoomState.elapsedMs = Math.min(
        zoomState.elapsedMs + deltaMs,
        ZOOM_ANIMATION_MS,
      )
      const t = zoomState.elapsedMs / ZOOM_ANIMATION_MS
      zoomState.current =
        zoomState.start + (zoomState.target - zoomState.start) * t
      if (zoomState.elapsedMs >= ZOOM_ANIMATION_MS) {
        zoomState.current = zoomState.target
      }
    }

    const now = Date.now()
    const lerpFactor = Math.min(player.moveElapsedMs / MOVE_INTERVAL_MS, 1)
    const visualX = player.prevX + (player.x - player.prevX) * lerpFactor
    const visualY = player.prevY + (player.y - player.prevY) * lerpFactor
    const labelOffsets = getLabelOffsets(player, peers)
    updateCamera(visualX, visualY)

    const activeSeatId = selectedSeatRef.current
    if (activeSeatId) {
      const seat = seats.find((item) => item.id === activeSeatId)
      if (seat) {
        const modeLabel = seat.channelMode === 'common' ? 'auto' : 'private'
        updateVoiceLabel(`Voice: ${seat.channelName} (${modeLabel})`)
      }
    } else {
      const section = getSectionAt(player.x, player.y)
      if (section?.voiceMode === 'common') {
        updateVoiceLabel(`Voice: ${section.name} (auto)`)
      } else if (section?.voiceMode === 'private') {
        updateVoiceLabel(`Voice: ${section.name} (private)`)
      } else {
        updateVoiceLabel('Voice: Main Room (auto)')
      }
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }

    const { width, height } = frameRef.current
    ctx.clearRect(0, 0, width, height)

    ctx.save()
    ctx.translate(cameraRef.current.x, cameraRef.current.y)
    ctx.scale(zoomRef.current.current, zoomRef.current.current)

    const mapWidth = collisionMap[0].length * TILE_SIZE
    const mapHeight = collisionMap.length * TILE_SIZE
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, mapWidth, mapHeight)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    for (let x = 0; x <= mapWidth; x += TILE_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, mapHeight)
      ctx.stroke()
    }
    for (let y = 0; y <= mapHeight; y += TILE_SIZE) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(mapWidth, y)
      ctx.stroke()
    }

    drawFocusRooms(ctx)
    drawWalls(ctx)
    drawSectionAmbience(ctx)
    drawSectionLabels(ctx)
    drawDecor(ctx, 'below')
    drawFurniture(ctx)
    drawSeats(ctx)

    drawObjects(ctx, 'below')

    peers
      .filter((peer) => peer.roomId === player.roomId)
      .forEach((peer) =>
        drawPeer(ctx, peer, labelOffsets.get(peer.id) ?? 0, now),
      )

    drawPlayer(ctx, labelOffsets.get('you') ?? 0)

    drawDecor(ctx, 'above')

    drawObjects(ctx, 'above')

    if (tileLayersReadyRef.current && tileLayersRef.current.roof) {
      ctx.drawImage(tileLayersRef.current.roof, 0, 0)
    }

    const nearest = findNearestInteractable(player)
    if (nearest) {
      drawInteractionHighlight(ctx, nearest)
    }

    drawSpeechBubbles(ctx, visualX, visualY, now)

    drawEmojiReactions(ctx, visualX, visualY, now)

    updateInteractionState(nearest)

    ctx.restore()
  }, true)

  return <canvas ref={canvasRef} className="game-canvas" />
}

function getMoveInput(keysHeld: Set<string>) {
  if (keysHeld.has('ArrowUp') || keysHeld.has('w') || keysHeld.has('W')) {
    return { dx: 0, dy: -1, direction: 'up' as const }
  }
  if (keysHeld.has('ArrowDown') || keysHeld.has('s') || keysHeld.has('S')) {
    return { dx: 0, dy: 1, direction: 'down' as const }
  }
  if (keysHeld.has('ArrowLeft') || keysHeld.has('a') || keysHeld.has('A')) {
    return { dx: -1, dy: 0, direction: 'left' as const }
  }
  if (keysHeld.has('ArrowRight') || keysHeld.has('d') || keysHeld.has('D')) {
    return { dx: 1, dy: 0, direction: 'right' as const }
  }
  return null
}

function canMoveTo(x: number, y: number) {
  if (y < 0 || y >= collisionMap.length) {
    return false
  }
  if (x < 0 || x >= collisionMap[0].length) {
    return false
  }
  return collisionMap[y][x]
}

function getNearestWalkableTile(x: number, y: number) {
  if (canMoveTo(x, y)) {
    return { x, y }
  }

  const visited = new Set<string>()
  const queue: Array<{ x: number; y: number }> = [{ x, y }]
  visited.add(`${x},${y}`)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      break
    }
    const neighbors = getNeighbors(current)
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`
      if (visited.has(key)) {
        continue
      }
      if (canMoveTo(neighbor.x, neighbor.y)) {
        return neighbor
      }
      visited.add(key)
      queue.push(neighbor)
    }
  }

  return null
}

function findPath(
  start: { x: number; y: number },
  goal: { x: number; y: number },
) {
  if (start.x === goal.x && start.y === goal.y) {
    return []
  }

  const openSet: Array<{ x: number; y: number }> = [start]
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()

  const startKey = `${start.x},${start.y}`
  const goalKey = `${goal.x},${goal.y}`
  gScore.set(startKey, 0)
  fScore.set(startKey, manhattan(start, goal))

  while (openSet.length > 0) {
    openSet.sort(
      (a, b) =>
        (fScore.get(`${a.x},${a.y}`) ?? Infinity) -
        (fScore.get(`${b.x},${b.y}`) ?? Infinity),
    )
    const current = openSet.shift()
    if (!current) {
      break
    }
    const currentKey = `${current.x},${current.y}`
    if (currentKey === goalKey) {
      return reconstructPath(cameFrom, currentKey)
    }

    const neighbors = getNeighbors(current)
    for (const neighbor of neighbors) {
      if (!canMoveTo(neighbor.x, neighbor.y)) {
        continue
      }
      const neighborKey = `${neighbor.x},${neighbor.y}`
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1
      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, currentKey)
        gScore.set(neighborKey, tentativeG)
        fScore.set(neighborKey, tentativeG + manhattan(neighbor, goal))
        if (!openSet.some((node) => node.x === neighbor.x && node.y === neighbor.y)) {
          openSet.push(neighbor)
        }
      }
    }
  }

  return []
}

function reconstructPath(cameFrom: Map<string, string>, currentKey: string) {
  const path: Array<{ x: number; y: number }> = []
  let key = currentKey
  while (cameFrom.has(key)) {
    const [x, y] = key.split(',').map(Number)
    path.unshift({ x, y })
    const prevKey = cameFrom.get(key)
    if (!prevKey) {
      break
    }
    key = prevKey
  }
  return path
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function getNeighbors(node: { x: number; y: number }) {
  const neighbors = [
    { x: node.x, y: node.y - 1 },
    { x: node.x, y: node.y + 1 },
    { x: node.x - 1, y: node.y },
    { x: node.x + 1, y: node.y },
  ]
  return neighbors.filter(
    (neighbor) =>
      neighbor.y >= 0 &&
      neighbor.y < collisionMap.length &&
      neighbor.x >= 0 &&
      neighbor.x < collisionMap[0].length,
  )
}

function getRoomIdFromName(name: string) {
  const match = rooms.find(
    (room) => room.name.toLowerCase() === name.toLowerCase(),
  )
  return match?.id ?? 'main'
}

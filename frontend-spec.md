# Gather.town Frontend UI — Complete Reverse-Engineering & Implementation Specification

> **Document Purpose:** Single source of truth for recreating the Gather.town frontend UI as a pixel-level, behavior-level replica. This document is written for an AI agent (e.g., Codex) with zero prior knowledge of Gather.town.

---

## 1. PRODUCT OVERVIEW

### 1.1 What Gather.town Is (Functional Explanation)

Gather.town is a **browser-based, 2D top-down virtual office/event platform** where users are represented as pixel-art avatars on a tile-based map. The platform combines:

- A **2D game-like canvas** (similar to classic RPG overworld maps) as the primary environment
- **WebRTC video/audio communication** that activates automatically when avatars are spatially close to each other
- **Collaborative tools** (whiteboards, screen shares, embedded apps) attached to in-world objects

Users navigate their avatar using keyboard controls, walk around the 2D space, and automatically enter audio/video conversations with other users whose avatars are within a configurable proximity radius — without clicking "join call". This is the defining UX mechanic.

### 1.2 Core Concept: 2D Spatial Virtual Office

- The world is a **tile grid** (each tile = 32×32 pixels at 100% zoom)
- The map is typically **50–200 tiles wide × 50–150 tiles tall** (varies by room template)
- The player's avatar is always **centered on screen** (camera follows player)
- Other users' avatars are visible as they move in real-time
- **Proximity radius** = typically a circular zone of **~5 tiles radius** around your avatar
- When two avatars overlap within proximity radius → WebRTC audio/video activates
- **Rooms** are sub-areas within the map, delineated by walls/doors, that can have their own proximity rules

### 1.3 UX Philosophy

| Principle                    | Implementation                                             |
| ---------------------------- | ---------------------------------------------------------- |
| Serendipitous encounter      | Walk near someone → auto-connect, no click required        |
| Spatial presence             | Your avatar's position communicates availability           |
| Gamified workspace           | RPG aesthetics lower psychological barriers to interaction |
| Ambient awareness            | See who's around without being forced to interact          |
| Context-driven collaboration | Objects (whiteboard, TV) are interactive, spatially placed |

---

## 2. CORE FRONTEND ARCHITECTURE

### 2.1 Rendering Approach

Gather uses a **hybrid Canvas + DOM rendering model**:

| Layer         | Technology                    | Purpose                                       |
| ------------- | ----------------------------- | --------------------------------------------- |
| World/Tilemap | HTML5 Canvas 2D               | Tile rendering, avatar sprites, objects       |
| UI Overlays   | React DOM                     | HUD elements, modals, sidebars, video bubbles |
| Video streams | HTML `<video>` elements (DOM) | Positioned over canvas using absolute layout  |

**Critical Detail:** The `<canvas>` element fills the full viewport. React UI components are absolutely positioned on top using a `z-index` stacking strategy. The canvas does NOT render UI controls — those are DOM.

### 2.2 Recommended Stack

```
Rendering:     HTML5 Canvas 2D API (no WebGL required for base tilemap)
Framework:     React 18+ with hooks
State:         Zustand or Redux Toolkit (global: players, map, UI state)
Realtime:      WebSocket connection (simulated via local state for frontend-only build)
Sprites:       Pre-loaded Image assets via HTMLImageElement
Audio/Video:   WebRTC (use mock for frontend-only)
Styling:       CSS Modules or Tailwind for DOM UI layers
Build:         Vite
```

### 2.3 Component Hierarchy (Top-Down)

```
<App>
  ├── <GameCanvas />              ← Full-viewport canvas element (z-index: 0)
  ├── <VideoOverlay />            ← Video bubble grid (z-index: 10, pointer-events: none)
  ├── <TopBar />                  ← Navigation HUD (z-index: 20)
  ├── <BottomBar />               ← Action prompts + chat input (z-index: 20)
  ├── <RightSidebar />            ← Participant list + chat panel (z-index: 20)
  ├── <InteractionModal />        ← Appears over canvas for object interactions (z-index: 30)
  ├── <NotificationToast />       ← Temporary notifications (z-index: 40)
  └── <EmojiReaction />          ← Floating emoji animations (z-index: 15)
```

### 2.4 State Management Strategy

Define a global store with these slices:

```
store/
  playerSlice        → { id, x, y, direction, isMoving, name, avatarId, isMuted, isCamOff }
  worldSlice         → { tilemap[][], objects[], rooms[], collisionMap[][] }
  peersSlice         → { [peerId]: { x, y, name, avatarId, stream, isNearby, distance } }
  uiSlice            → { activePanel, isChatOpen, isParticipantsOpen, currentInteraction }
  chatSlice          → { messages[], unreadCount, isTyping }
  proximitySlice     → { nearbyPeers[], inConversation: bool }
```

### 2.5 Real-Time Update Handling (UI Perspective)

For frontend simulation without a real backend:

- Use a `useGameLoop` hook that calls `requestAnimationFrame` continuously
- Each frame: process input → update player position → check collisions → check proximity → update canvas
- Peer positions update via a simulated WebSocket dispatcher that fires position events
- All state mutations from the game loop go through the store's `dispatch`

---

## 3. SCREEN BREAKDOWN (PIXEL-LEVEL)

### 3.1 Main Game Canvas

**Canvas Dimensions:**

- Width: `window.innerWidth` (100vw)
- Height: `window.innerHeight` (100vh)
- The canvas element has `position: fixed; top: 0; left: 0; width: 100%; height: 100%`
- `image-rendering: pixelated` CSS applied to preserve sprite crispness

**Pixel Scale Factor:**

- Default zoom = 2× (each game tile renders at 64×64 CSS pixels on screen)
- User can zoom: 1×, 1.5×, 2×, 3× via `+`/`-` keys or scroll wheel
- At 2× zoom: 32px tile × 2 = 64px on screen

**What the Canvas Renders Each Frame (in draw order):**

1. Floor tiles (bottom layer)
2. Floor decals/rugs/shadows
3. In-world objects below-avatar layer (furniture bottoms, floor objects)
4. Avatars (all players, including local player)
5. In-world objects above-avatar layer (walls, tall furniture tops)
6. Interaction highlight overlays (glowing borders on interactive objects)
7. Name labels above avatars
8. Proximity radius debug circle (dev mode only)
9. Chat bubble popups (canvas-rendered speech bubbles above avatars)

**Rendering Loop:**

```
clearRect(0, 0, canvas.width, canvas.height)
ctx.save()
ctx.translate(cameraOffsetX, cameraOffsetY)  // apply camera transform
ctx.scale(zoomFactor, zoomFactor)
// draw all layers in order above
ctx.restore()
// draw any non-transformed UI elements (minimap, etc.)
```

---

### 3.2 Top Navigation Bar

**Position:** Fixed, top of viewport  
**Dimensions:** Full viewport width × 52px height  
**Background:** `rgba(15, 15, 25, 0.92)` with `backdrop-filter: blur(8px)`  
**Z-index:** 20

**Left Section (Logo + Room Name):**

- Gather "G" logo icon: 28×28px, positioned 16px from left, vertically centered
- Room name text: font-size 13px, font-weight 600, color `#FFFFFF`, 8px left of logo

**Center Section (empty or room title):**

- Room name displayed in center on large screens (hidden below 768px)

**Right Section (Control Buttons):**
All buttons in a horizontal flex row, 8px gap, 16px from right edge:

| Button          | Icon             | Size    | Behavior                                                                                     |
| --------------- | ---------------- | ------- | -------------------------------------------------------------------------------------------- |
| Mute/Unmute     | Microphone icon  | 36×36px | Toggle mic; icon changes to mic-with-slash when muted; background turns `#E53E3E` when muted |
| Camera On/Off   | Camera icon      | 36×36px | Toggle camera; icon changes to camera-with-slash; background turns `#E53E3E` when off        |
| Screen Share    | Monitor icon     | 36×36px | Toggle screen share; turns `#48BB78` when active                                             |
| Emoji Reactions | Smiley face icon | 36×36px | Opens emoji picker popover below button                                                      |
| Participants    | People icon      | 36×36px | Toggles right sidebar participant panel; shows participant count badge                       |
| Chat            | Chat bubble icon | 36×36px | Toggles right sidebar chat panel; shows unread badge (red dot, count)                        |
| Settings        | Gear icon        | 36×36px | Opens settings modal                                                                         |

**Button Visual Spec:**

- Default state: `background: rgba(255,255,255,0.08)`, `border-radius: 8px`, icon color `#CBD5E0`
- Hover state: `background: rgba(255,255,255,0.16)`, transition duration `150ms ease`
- Active/toggled state: `background: rgba(255,255,255,0.24)`, icon color `#FFFFFF`
- Muted/disabled state: `background: #E53E3E` (red), icon color `#FFFFFF`

**Participant Count Badge:**

- Small red circle, `18px × 18px`, positioned top-right of Participants button
- Font: 10px bold white
- Only visible when `participants.length > 0`

**Unread Chat Badge:**

- Same spec as participant badge
- Disappears when chat panel is open

---

### 3.3 Bottom Interaction Bar

**Position:** Fixed, bottom of viewport  
**Dimensions:** Full viewport width × 56px height  
**Background:** `rgba(15, 15, 25, 0.85)` with `backdrop-filter: blur(8px)`  
**Z-index:** 20  
**Visibility:** Always visible

**Left Section — Keyboard Hint Strip:**

- Displays contextual hint text, e.g. `"Press X to interact"` when near interactive object
- Font: 12px, color `#A0AEC0`, italic
- Animates in with `opacity: 0 → 1` over `200ms` when hint changes
- Positioned 16px from left, vertically centered

**Center Section — Chat Input:**

- Placeholder text: `"Say something..."`
- Width: `min(480px, 50vw)`
- Height: 36px
- Background: `rgba(255,255,255,0.10)`
- Border: `1px solid rgba(255,255,255,0.15)`
- Border-radius: `20px` (pill shape)
- Font: 13px, color `#FFFFFF`
- Padding: `0 16px`
- On click/focus: border becomes `1px solid rgba(255,255,255,0.40)`, background `rgba(255,255,255,0.15)`
- On focus, player avatar enters "typing" state (stops movement until Escape or blur)
- Enter key sends message; message appears in chat panel AND as speech bubble above avatar

**Right Section — Current Room Indicator:**

- Room name pill: background `rgba(255,255,255,0.08)`, border-radius `12px`, padding `4px 12px`
- Font: 11px, color `#A0AEC0`
- Icon: door/room icon 12×12px to the left of text
- Positioned 16px from right edge

---

### 3.4 Sidebar / Panels

**Overall Sidebar Container:**

- Position: fixed, right: 0, top: 52px (below top bar), bottom: 56px (above bottom bar)
- Width: 280px
- Background: `rgba(10, 10, 20, 0.96)`
- Border-left: `1px solid rgba(255,255,255,0.08)`
- Transition: `transform 250ms cubic-bezier(0.4, 0, 0.2, 1)`
- Open state: `transform: translateX(0)`
- Closed state: `transform: translateX(100%)`
- Only ONE panel can be visible at a time (participants OR chat); toggle between them using top bar buttons

**Participant List Panel:**

Header:

- Text: `"Participants (N)"` where N = total count
- Font: 14px bold, color `#FFFFFF`
- 16px padding on all sides
- Border-bottom: `1px solid rgba(255,255,255,0.08)`

Search input (below header):

- Height: 32px, width: calc(100% - 32px), margin: 0 16px 12px
- Placeholder: `"Search..."`
- Background: `rgba(255,255,255,0.08)`, border-radius: `6px`

Participant List Item:

- Height: 48px
- Layout: flex row, align-center
- Avatar thumbnail: 32×32px circle, left: 16px
- Name: 13px, font-weight 500, color `#E2E8F0`, truncated with ellipsis
- Status icons (right side): mic muted icon, camera off icon (each 14×14px, color `#FC8181`)
- If user is "nearby" (in proximity): left border `3px solid #48BB78`
- If user is in same room: no special indicator
- Hover: background `rgba(255,255,255,0.05)`

**Chat Panel:**

Header: `"Chat"`, same styling as Participants header

Messages Area:

- Scrollable, `overflow-y: auto`
- Padding: `12px 16px`
- Each message block:
  - Avatar: 24×24px circle, top-aligned
  - Username: 12px bold, color `#63B3ED`
  - Timestamp: 11px, color `#718096`, right-aligned, format `HH:MM`
  - Message text: 13px, color `#E2E8F0`, line-height 1.5
  - 8px vertical gap between messages from different users
  - 4px gap between consecutive messages from same user (username/avatar hidden for subsequent)

Typing Indicator:

- Three animated dots (•••) when peer is typing
- Dot animation: sequential opacity pulse, 400ms cycle, offset 0/133/266ms
- Text: `"[Name] is typing..."`

---

## 4. TILEMAP & WORLD SYSTEM

### 4.1 Grid System

- **Tile size (source):** 32×32 pixels in the spritesheet
- **Tile size (rendered):** 32 × zoomFactor pixels on canvas (e.g., 64px at 2× zoom)
- **Map data format:** A 2D array `tilemap[row][col]` where each cell = tile ID (integer)
- **Coordinate system:** Origin (0,0) at top-left of map; X increases rightward, Y increases downward

```
tilemap[0][0]  = top-left tile
tilemap[y][x]  = tile at column x, row y
pixel position = { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE }
```

### 4.2 Layer Hierarchy

The map is composed of multiple layers rendered in order:

| Layer Index | Name           | Description                                                          |
| ----------- | -------------- | -------------------------------------------------------------------- |
| 0           | Floor          | Base ground texture (grass, wood, carpet)                            |
| 1           | Floor Detail   | Rugs, mats, floor markings                                           |
| 2           | Object (below) | Furniture below avatar height (chairs, tables — bottom half)         |
| 3           | Avatar Layer   | All player avatars render here                                       |
| 4           | Object (above) | Furniture above avatar (chair backs, walls, tall objects — top half) |
| 5           | Roof/Ceiling   | Optional ceiling tiles for indoor areas                              |
| 6           | Overlay        | Interaction highlights, proximity circles                            |

### 4.3 Walkable vs Non-Walkable Tiles

Maintain a separate `collisionMap[row][col]` boolean array:

- `true` = passable (player can walk)
- `false` = blocked (wall, water, object)

Objects placed on the map also mark their grid cells as non-walkable in collisionMap.

### 4.4 Object Placement

Each world object has:

```
{
  id: string,
  type: string,          // "whiteboard" | "tv" | "door" | "plant" | "desk" | etc.
  x: number,             // tile column
  y: number,             // tile row
  width: number,         // tiles wide
  height: number,        // tiles tall
  spriteX: number,       // px position in spritesheet
  spriteY: number,
  spriteW: number,
  spriteH: number,
  interactive: boolean,
  interactRadius: number, // tile distance to trigger "Press X" prompt
  zLayer: "below" | "above"
}
```

### 4.5 Tileset / Spritesheet

- Single PNG spritesheet containing all tiles in a grid
- Example: 512×512px sheet with 32×32px tiles = 16×16 = 256 tiles
- Load via `new Image()`, draw sub-regions using `ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh)`

---

## 5. AVATAR SYSTEM

### 5.1 Avatar Structure

Each avatar is a **sprite sheet** with:

- 4 directional sets: Down, Left, Right, Up (in that row order)
- 3 frames per direction: idle (frame 0), walk-1 (frame 1), walk-2 (frame 2)
- Sprite frame size: 48×48 pixels (larger than tile to show body overlap)
- Sheet layout: 3 columns × 4 rows = 12 frames total per character

```
Row 0 (y=0):   Facing Down   → frame 0 (idle), frame 1, frame 2
Row 1 (y=48):  Facing Left   → frame 0 (idle), frame 1, frame 2
Row 2 (y=96):  Facing Right  → frame 0 (idle), frame 1, frame 2
Row 3 (y=144): Facing Up     → frame 0 (idle), frame 1, frame 2
```

### 5.2 Avatar Positioning on Canvas

Avatar is drawn centered on its tile:

```
drawX = (avatar.x * TILE_SIZE) - (SPRITE_WIDTH - TILE_SIZE) / 2
drawY = (avatar.y * TILE_SIZE) - (SPRITE_HEIGHT - TILE_SIZE)  // top-aligned to tile row
```

Avatar renders at tile coordinates. Sub-tile interpolation is applied during movement (see §6).

### 5.3 Directional State

```
direction: "down" | "left" | "right" | "up"
```

- Default direction on spawn: `"down"`
- Direction updates on first input keypress
- Direction does NOT change if movement is blocked (collision)

### 5.4 Animation Frame Logic

- Walking animation cycles through frames 0 → 1 → 2 → 1 → 0 (ping-pong), NOT 0 → 1 → 2 → 0
- Frame duration: 150ms per frame
- Frame timer: incremented each game loop tick
- When `isMoving = false`: snap to frame 0 (idle) immediately
- Idle breathing effect: NOT present (avatar is static on idle frame)

### 5.5 Name Label

- Rendered above avatar sprite on canvas
- Font: `"12px 'Press Start 2P'"` or `"bold 11px Arial"` (pixel-art aesthetic)
- Color: `#FFFFFF` with `2px black text shadow (0 1px 2px rgba(0,0,0,0.9))`
- Centered horizontally above sprite
- Y position: `spriteDrawY - 14px`
- Background: semi-transparent rounded pill `rgba(0,0,0,0.5)`, padding `2px 6px`, border-radius `10px`

### 5.6 Speech Bubble (Canvas-Rendered)

Triggered when a user sends a chat message:

- Appears above name label
- Rounded rectangle background: `rgba(255,255,255,0.95)`, border-radius `8px`
- Text: 11px dark text, max 200px wide, word-wrapped
- Speech bubble tail: small downward-pointing triangle at bubble bottom-center
- Duration: visible for `(text.length * 80ms)`, minimum `3000ms`, maximum `6000ms`
- Fade out: last `500ms` of duration, opacity `1 → 0`

---

## 6. MOVEMENT & CONTROLS

### 6.1 Input Mapping

| Key                 | Action                                             |
| ------------------- | -------------------------------------------------- |
| `ArrowUp` or `W`    | Move up (decrease Y)                               |
| `ArrowDown` or `S`  | Move down (increase Y)                             |
| `ArrowLeft` or `A`  | Move left (decrease X)                             |
| `ArrowRight` or `D` | Move right (increase X)                            |
| `X` or `Space`      | Interact with nearby object                        |
| `Escape`            | Cancel interaction / close modal / blur chat input |
| `Enter`             | Submit chat message (when input focused)           |
| `+` / `=`           | Zoom in                                            |
| `-`                 | Zoom out                                           |

**Input handling:**

- Track pressed keys in a `Set<string>` called `keysHeld`
- On `keydown`: add to set; on `keyup`: remove from set
- Movement evaluated each game loop tick against `keysHeld`, NOT on each keydown event
- When chat input is focused: ALL movement keys are disabled (prevent avatar movement while typing)

### 6.2 Movement Rules

- Movement is **tile-based with smooth interpolation**
- Player occupies exactly one tile at a time logically
- Movement speed: player moves **one tile every 200ms** (5 tiles/sec)
- Between tile transitions: avatar visually interpolates position (smooth sliding)

**Per-tick movement logic:**

```
if (timeSinceLastMove >= MOVE_INTERVAL) {
  targetX = player.x + dx
  targetY = player.y + dy
  if (collisionMap[targetY][targetX] === true && inBounds(targetX, targetY)) {
    player.prevX = player.x
    player.prevY = player.y
    player.x = targetX
    player.y = targetY
    player.moveProgress = 0   // reset interpolation
    timeSinceLastMove = 0
  } else {
    // blocked: do NOT update position; keep facing direction updated
  }
}
```

### 6.3 Smooth Interpolation

Each frame, compute visual position:

```
lerpFactor = min(timeSinceLastMove / MOVE_INTERVAL, 1.0)
visualX = lerp(player.prevX, player.x, lerpFactor) * TILE_SIZE
visualY = lerp(player.prevY, player.y, lerpFactor) * TILE_SIZE
```

This makes movement fluid at 60fps even though logical position updates at 5 steps/sec.

### 6.4 Boundary Constraints

- Player cannot move to tiles where `x < 0`, `x >= mapWidth`, `y < 0`, `y >= mapHeight`
- Player cannot move to tiles where `collisionMap[y][x] === false`
- If blocked, direction still updates (avatar faces attempted direction)

### 6.5 Diagonal Movement

- NOT supported (no simultaneous X+Y movement)
- If two directional keys pressed simultaneously, priority order: Up > Down > Left > Right

---

## 7. PROXIMITY-BASED INTERACTION SYSTEM

### 7.1 Proximity Radius Definition

- Default proximity radius: **5 tiles** (Euclidean distance)
- This is configurable per room (stored in room metadata)
- Distance calculation:
  ```
  distance = sqrt((peerX - playerX)² + (peerY - playerY)²)
  inProximity = distance <= PROXIMITY_RADIUS
  ```
- Proximity is checked every game loop tick (every frame at 60fps)

### 7.2 Proximity State Machine

Each peer has a proximity state:

```
"outside"  →  (enter radius)   →  "entering"  →  (grace period 300ms)  →  "connected"
"connected" →  (exit radius)   →  "leaving"   →  (grace period 500ms)  →  "outside"
```

The grace periods prevent rapid connect/disconnect flickering when avatars hover at the boundary.

### 7.3 Visual Changes When In Proximity Range

**Canvas Layer (on nearby peers):**

- A soft glow ring appears around nearby avatars: circular gradient `rgba(72, 187, 120, 0.3)` (green), radius = `TILE_SIZE * 0.8`, rendered BELOW the avatar sprite
- Opacity of ring: scales from 0 at `distance = PROXIMITY_RADIUS` to 0.6 at `distance = 0`
- Ring animation: pulsing scale `1.0 → 1.15 → 1.0` over 2000ms loop

**Video Bubble Activation:**

- When peer enters "connected" state: their video bubble appears in the VideoOverlay layer
- Bubble appears with animation: scale `0.5 → 1.0`, opacity `0 → 1`, duration `300ms ease-out`

**DOM Layer:**

- Nearby users in participant list get green left border indicator
- Count badge in top bar updates

### 7.4 Gradual Audio Falloff Visual Representation

For UI feedback (no actual WebRTC volume changes needed for frontend-only):

- Display a visual audio indicator bar that represents "signal strength"
- 5 bars (like mobile signal strength), full = close, 1 bar = at boundary
- Bar fill: `#48BB78` (green) for strong signal, `#ECC94B` (yellow) for 3+ tiles away
- This indicator appears inside the video bubble of each nearby peer
- Calculation: `signalStrength = max(0, 1 - (distance / PROXIMITY_RADIUS))`

### 7.5 Proximity Circle Visual (Optional Dev/Accessibility Mode)

- Dashed circle drawn on canvas around player avatar
- Radius = `PROXIMITY_RADIUS * TILE_SIZE` pixels
- Stroke: `rgba(72, 187, 120, 0.4)`, dash pattern `[4, 4]`
- No fill
- Visible in accessibility/settings toggle mode

---

## 8. OBJECT INTERACTION SYSTEM

### 8.1 Interactive Object Types

| Object Type | Trigger      | Action                                   |
| ----------- | ------------ | ---------------------------------------- |
| Whiteboard  | `X` key      | Opens fullscreen whiteboard modal        |
| TV Screen   | `X` key      | Opens video/embed modal                  |
| Door        | Walk into it | Teleports player to linked room/position |
| Portal      | Walk into it | Teleports player (immediate, no prompt)  |
| Note/Sign   | `X` key      | Opens text card modal                    |
| Poster      | `X` key      | Shows image modal                        |
| Spawn Point | (passive)    | No interaction                           |
| Game Object | `X` key      | Opens mini-game modal                    |

### 8.2 Interaction Detection

Each game loop tick:

1. Iterate all `world.objects` where `object.interactive === true`
2. Calculate Euclidean distance from player tile to object center tile
3. If `distance <= object.interactRadius` (typically 1.5 tiles): object is "in range"
4. Track `nearestInteractableObject` — only the closest object is actionable at once

### 8.3 Hover / In-Range State Visual

When object is in range:

- Canvas draws a pulsing highlight border around the object sprite
- Border: `2px solid rgba(255, 220, 50, 0.9)` (yellow/gold)
- Corner brackets drawn at object corners (L-shaped brackets, 8px long, 2px wide)
- Pulse animation: opacity `0.7 → 1.0 → 0.7`, period `1200ms`
- Shadow glow: `blur(8px) rgba(255, 220, 50, 0.4)` (achieved via offscreen canvas or ctx.shadowBlur)

Bottom bar hint updates:

- Text changes to `"Press X to [action]"` e.g., `"Press X to use whiteboard"`
- Text fades in over 200ms

### 8.4 Interaction Trigger

On `X` key press when `nearestInteractableObject !== null`:

1. Set player state: `isInteracting = true`
2. Disable player movement
3. Open the appropriate modal with a scale-in animation: `transform: scale(0.9) → scale(1.0)`, opacity `0 → 1`, duration `200ms ease-out`
4. Dispatch `currentInteraction: object` to UI state

### 8.5 Modal/Popup Behavior

**Modal Container:**

- Position: fixed, centered in viewport
- Width: `min(900px, 90vw)`, Height: `min(700px, 85vh)`
- Background: `rgba(15, 15, 25, 0.98)`
- Border: `1px solid rgba(255,255,255,0.12)`
- Border-radius: `12px`
- Box-shadow: `0 25px 80px rgba(0,0,0,0.7)`
- Backdrop: full-viewport semi-transparent overlay `rgba(0,0,0,0.6)` behind modal
- Close button: `×` in top-right corner, 32×32px

**Close Modal:**

- Press `Escape` OR click `×` button OR click outside modal area
- Close animation: scale `1.0 → 0.95`, opacity `1 → 0`, duration `150ms`
- After close: `isInteracting = false`, movement re-enabled

---

## 9. CHAT SYSTEM (UI ONLY)

### 9.1 Chat Panel Layout

- Width: 280px (sidebar, see §3.4)
- Messages area: `flex-direction: column`, newest at bottom, `overflow-y: auto`
- Auto-scrolls to bottom on new message UNLESS user has manually scrolled up
- If user has scrolled up: show "New message ↓" button at bottom, clicking it scrolls to bottom

### 9.2 Message Rendering

Each message object:

```
{
  id: string,
  senderId: string,
  senderName: string,
  senderAvatarColor: string,
  text: string,
  timestamp: Date,
  type: "text" | "system"  // system = join/leave notifications
}
```

**Visual grouping:** Consecutive messages from the same sender within 5 minutes = "message group":

- First message in group: show avatar circle + name + timestamp
- Subsequent messages: no avatar/name (12px indent to align with text column)

**System messages:**

- Centered, italic, 11px, color `#718096`
- Example: `"Alex joined the space"`

### 9.3 Message Input (Bottom Bar)

Already detailed in §3.3. Additional behavior:

- Maximum message length: 500 characters
- Character counter appears when `length > 400`: `"N/500"` in 11px `#A0AEC0`
- Emoji picker button (smiley icon) to the right of input, 24×24px
- On send (Enter key):
  1. Message added to `chatSlice.messages`
  2. Input cleared
  3. Chat panel scrolls to bottom
  4. Speech bubble appears above player avatar (see §5.6)

### 9.4 Typing Indicator

- When local player types in input: broadcast "typing" state (for frontend-only: no broadcast needed)
- When a peer is typing: display indicator in chat panel above input area
- Indicator: `"[Name] is typing"` with animated ellipsis dots
- Ellipsis animation: dot 1 bounces at 0ms, dot 2 at 200ms, dot 3 at 400ms — using translateY `-4px → 0px`, loop 1200ms

### 9.5 Unread Badge

- When chat panel is closed and new message arrives: increment `chatSlice.unreadCount`
- Badge on top bar chat button: red circle, number inside
- When chat panel opened: `unreadCount = 0`, badge disappears with fade `opacity 1 → 0, 200ms`

---

## 10. VIDEO/AUDIO UI ELEMENTS

### 10.1 Video Bubble Layout

Each nearby user gets a video bubble in the `<VideoOverlay>` component (DOM layer, positioned over canvas bottom-right area).

**Bubble Container:**

- Width: 160px, Height: 120px (16:9 aspect ratio — NO, Gather uses 4:3 thumbnails → 160×120)
- Border-radius: `12px`
- Background: `#1A202C` (dark fallback when video is off)
- Border: `2px solid rgba(255,255,255,0.15)`
- Box-shadow: `0 4px 20px rgba(0,0,0,0.5)`
- Overflow: hidden

**Video Element inside bubble:**

- `<video autoplay playsinline>` filling full bubble (160×120)
- `object-fit: cover`

**Bubble Positioning:**

- Bubbles stack in a grid in the bottom-right of the viewport
- First bubble: `bottom: 72px, right: 16px`
- Additional bubbles: stack left or upward depending on count
- Layout grid:
  - 1 peer: 1 column
  - 2–4 peers: 2 columns
  - 5–9 peers: 3 columns
  - 10+ peers: scroll becomes available or bubbles shrink

**Local Player Bubble:**

- Always visible in bottom-right corner (bottommost, rightmost position)
- Labeled "You" in bottom-left of bubble, 11px, white
- Slightly smaller: 140×105px to visually differentiate

### 10.2 Bubble Appearance Animation

On peer entering proximity:

- Start: `transform: scale(0.5) translateY(20px)`, `opacity: 0`
- End: `transform: scale(1) translateY(0)`, `opacity: 1`
- Duration: `300ms`, easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight spring)

On peer leaving proximity:

- Start: `transform: scale(1)`, `opacity: 1`
- End: `transform: scale(0.8)`, `opacity: 0`
- Duration: `200ms ease-in`
- Remove from DOM after animation completes

### 10.3 Mute/Camera-Off Indicators on Bubbles

**Muted (audio off):**

- Mic-slash icon overlaid in bottom-right of bubble, 16×16px, white, `background: rgba(229,62,62,0.8)` circle
- Icon: SVG microphone with diagonal slash line

**Camera off:**

- Video element hidden, replaced by avatar image (large circular avatar thumbnail, 64px centered)
- Background: `#2D3748`
- Name text centered below avatar thumbnail

**Speaking indicator:**

- When peer audio is active and non-zero volume: green pulsing border on bubble
- Border: `2px solid #48BB78` (green), pulse effect: `box-shadow: 0 0 0 0 rgba(72,187,120,0.4) → 0 0 0 6px rgba(72,187,120,0)`
- Pulse animation: `1.5s` CSS keyframe, loops while speaking

**Name label on bubble:**

- Bottom-left of bubble
- Text: `"[Name]"`, 11px, white
- Background: linear-gradient from bottom `rgba(0,0,0,0.7) → transparent`, height 32px

---

## 11. CAMERA SYSTEM

### 11.1 Follow-Player Logic

The camera transform is applied via `ctx.translate()` before drawing the world:

```
cameraX = (canvas.width / 2) - (player.visualX + TILE_SIZE/2) * zoomFactor
cameraY = (canvas.height / 2) - (player.visualY + TILE_SIZE/2) * zoomFactor
```

This keeps the player's visual center at the canvas center.

### 11.2 Smooth Camera Transitions

For teleports or rapid position jumps:

- Do NOT instantly jump camera; lerp camera over `300ms`
- Camera lerp factor per frame: `0.12` (exponential smoothing)

```
camera.x = lerp(camera.x, targetCameraX, 0.12)
camera.y = lerp(camera.y, targetCameraY, 0.12)
```

For normal movement: camera follows instantly (since player position is already interpolated, camera tracking at 1.0 lerpFactor is fine during movement)

### 11.3 Boundary Constraints

The camera should NOT show space outside the map:

```
minCameraX = -(mapWidthPx * zoomFactor - canvas.width)
maxCameraX = 0
minCameraY = -(mapHeightPx * zoomFactor - canvas.height)
maxCameraY = 0

cameraX = clamp(cameraX, minCameraX, maxCameraX)
cameraY = clamp(cameraY, minCameraY, maxCameraY)
```

If the map is smaller than the viewport: center the map (camera stays fixed).

### 11.4 Zoom Behavior

- Zoom levels: `[1.0, 1.5, 2.0, 2.5, 3.0]`
- Default: `2.0`
- Zoom via scroll wheel: `deltaY < 0` = zoom in, `deltaY > 0` = zoom out
- Zoom via `+`/`-` keys
- On zoom change:
  - Recalculate camera so player stays visually centered
  - Smooth zoom transition: animate `currentZoom → targetZoom` over `200ms`

---

## 12. ANIMATION SYSTEM

### 12.1 Avatar Animation Timing

- Walking: 150ms per frame, ping-pong cycle (frames: 0,1,2,1,0,1,2…)
- Direction change: instant (no transition between directional sprite rows)
- Idle: frame 0, completely static

### 12.2 UI Transition Timings Reference

| Transition             | Duration             | Easing                                     |
| ---------------------- | -------------------- | ------------------------------------------ |
| Sidebar open/close     | 250ms                | `cubic-bezier(0.4, 0, 0.2, 1)`             |
| Modal open             | 200ms                | `ease-out`                                 |
| Modal close            | 150ms                | `ease-in`                                  |
| Video bubble appear    | 300ms                | spring `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Video bubble disappear | 200ms                | `ease-in`                                  |
| Interaction hint fade  | 200ms                | `ease`                                     |
| Proximity glow pulse   | 2000ms               | `ease-in-out`, infinite                    |
| Speaking border pulse  | 1500ms               | `ease-out`, infinite                       |
| Unread badge appear    | 200ms                | scale `0.5 → 1`, `ease-out`                |
| Notification toast     | 300ms in / 200ms out | `ease-out` / `ease-in`                     |
| Chat message appear    | 150ms                | `opacity 0 → 1`, slide up 8px              |

### 12.3 Emoji Reaction Animations

When user triggers an emoji reaction:

- Large emoji (48px) appears above player avatar on canvas
- Animation: float upward 60px over 2000ms, opacity `1 → 0` during last 500ms
- `transform: translateY(0) → translateY(-60px)` + `scale(1.0 → 0.8)` during float

### 12.4 Notification Toast

Appears top-right, below top bar:

- Width: `280px`, min-height: `52px`
- Background: `rgba(26, 32, 44, 0.95)`
- Border: `1px solid rgba(255,255,255,0.1)`
- Border-radius: `8px`
- `right: 16px`, `top: 68px`
- Slide in from right: `transform: translateX(120%) → translateX(0)`, `300ms ease-out`
- Auto-dismiss after `4000ms`
- Slide out: `transform: translateX(120%)`, `200ms ease-in`

---

## 13. STATE MANAGEMENT (FRONTEND)

### 13.1 All UI States

**Player States:**

| State             | Description                 | Trigger                                            |
| ----------------- | --------------------------- | -------------------------------------------------- |
| `idle`            | Not moving, not interacting | No input, no proximity interaction                 |
| `moving`          | Walking animation active    | Movement key held                                  |
| `interacting`     | Stopped, modal/object open  | `X` pressed near object                            |
| `inProximityChat` | Nearby peer connected       | Peer within proximity radius                       |
| `typingChat`      | Chat input focused          | Click on chat input or `T` key (optional shortcut) |
| `viewingObject`   | Modal open with content     | Object interaction triggered                       |
| `muted`           | Mic disabled                | Mute button pressed                                |
| `cameraOff`       | Camera disabled             | Camera button pressed                              |

**Combined states are possible:**

- `moving + inProximityChat`: walking while in conversation
- `inProximityChat + typingChat`: typing while in conversation

### 13.2 State Transitions

```
idle  ──[key pressed]──────────────────────────────────────► moving
moving ──[key released]────────────────────────────────────► idle
idle/moving ──[approach peer within radius]───────────────► + inProximityChat
idle/moving ──[leave radius]──────────────────────────────► - inProximityChat
idle ──[X pressed near object]────────────────────────────► interacting + viewingObject
interacting ──[Escape / close button]─────────────────────► idle
idle/moving ──[click chat input]──────────────────────────► typingChat (movement disabled)
typingChat ──[Escape / blur]──────────────────────────────► idle/moving (movement re-enabled)
typingChat ──[Enter]──────────────────────────────────────► idle (message sent, chat clears)
```

### 13.3 State Visual Outputs

| State             | Visual Effect                                                |
| ----------------- | ------------------------------------------------------------ |
| `moving`          | Walking animation frames cycle                               |
| `interacting`     | Movement keys ignored; modal visible                         |
| `inProximityChat` | Glow ring on nearby peers; video bubbles visible             |
| `typingChat`      | Chat input has focus ring; keyboard events consumed by input |
| `muted`           | Mute button red; mic-slash icon on local video bubble        |
| `cameraOff`       | Camera button red; camera-off state in local video bubble    |

---

## 14. EVENT SYSTEM

### 14.1 All Frontend Events

**Input Events (from browser):**

- `keydown` → add key to `keysHeld` set
- `keyup` → remove key from `keysHeld` set
- `wheel` → zoom in/out
- `click` on canvas → (future: object click interaction)
- `focus` on chat input → enter `typingChat` state
- `blur` on chat input → exit `typingChat` state
- `submit` on chat form → send message
- `click` on UI buttons → toggle features

**Game Loop Events (internal, every frame):**

- `MOVEMENT_TICK`: evaluate `keysHeld`, compute next position
- `COLLISION_CHECK`: before position update, validate against collisionMap
- `PROXIMITY_UPDATE`: recalculate all peer distances, update proximity states
- `ANIMATION_TICK`: advance sprite animation frame
- `CAMERA_UPDATE`: recalculate cameraX/cameraY based on player visual position
- `SPEECH_BUBBLE_TICK`: decrement timers, trigger fade on expiry
- `INTERACTION_RANGE_UPDATE`: find nearest interactable object

**Proximity Events:**

- `PEER_ENTER_PROXIMITY` → create video bubble, play proximity-enter sound cue (UI only: visual pulse), update participant list
- `PEER_EXIT_PROXIMITY` → animate out video bubble, update participant list

**Object Interaction Events:**

- `INTERACTION_ENTER_RANGE` → update bottom bar hint text
- `INTERACTION_EXIT_RANGE` → clear bottom bar hint text
- `INTERACTION_TRIGGER` → open modal, set `isInteracting = true`
- `INTERACTION_CLOSE` → close modal, set `isInteracting = false`

**WebSocket Simulation Events (for peer state):**

- `PEER_POSITION_UPDATE` → update `peersSlice[id].x`, `.y`
- `PEER_JOIN` → add peer to slice, show toast notification
- `PEER_LEAVE` → remove peer from slice, show toast notification
- `PEER_CHAT_MESSAGE` → add to `chatSlice.messages`, update unread count
- `PEER_TYPING_START` / `PEER_TYPING_STOP` → update typing indicator

---

## 15. RESPONSIVENESS & SCALING

### 15.1 Canvas Scaling

The canvas always fills the viewport. On window resize:

```
canvas.width = window.innerWidth * devicePixelRatio
canvas.height = window.innerHeight * devicePixelRatio
canvas.style.width = window.innerWidth + 'px'
canvas.style.height = window.innerHeight + 'px'
ctx.scale(devicePixelRatio, devicePixelRatio)
```

Recalculate camera after resize to keep player centered.

### 15.2 UI Responsiveness

| Viewport Width | Behavior                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| > 1200px       | Full sidebar (280px), all top bar icons shown                                 |
| 768–1200px     | Sidebar still 280px, some top bar labels hidden (icon only)                   |
| < 768px        | Sidebar slides over canvas (not beside), reduced icon sizes in top bar        |
| < 480px        | Bottom bar stacks, chat input reduced width; video bubbles shrink to 120×90px |

### 15.3 Minimum Supported Resolution

- Minimum: 360×640px (mobile portrait)
- Canvas is still fully functional; HUD elements compress
- Video bubbles: display max 2 at minimum resolution

---

## 16. EDGE CASES

### 16.1 Multiple Users Overlapping

- Multiple avatars can occupy the same tile (no avatar collision with other avatars)
- When >3 avatars on same tile: name labels fan out horizontally to prevent stacking
  - Calculate `labelOffset = (index - count/2) * 20px` for each avatar sharing a tile
  - Labels offset horizontally by this amount while avatars overlap visually

### 16.2 Rapid Movement

- Movement minimum interval: 200ms. If key is held, movement fires reliably every 200ms
- No input buffer (if player releases key before interval completes, movement stops at current tile)
- Ensure lerp factor doesn't overshoot: `min(progress, 1.0)` always clamped

### 16.3 Entering/Exiting Rooms (Teleport)

- Door/portal triggers teleport to `{ targetX, targetY, targetRoom }`
- If same room: camera lerps to new position over 300ms, player appears at target
- If different room (room transition):
  1. Full canvas fades to black: `opacity: 0 → 1` over `300ms`
  2. World data switches to new room tilemap
  3. Player position set to target
  4. Canvas fades back in: `opacity: 1 → 0` over `300ms`
  5. Proximity states reset (all peers recalculated for new room context)

### 16.4 Simultaneous Interactions

- Only ONE modal can be open at a time
- If user tries to trigger second interaction while one is open: ignored
- If user is typing in chat and presses `X`: `X` is consumed by input (no interaction trigger)
- If user is in interaction modal and proximity triggers: video bubbles still appear (non-blocking)

### 16.5 Map Load Lag

- Before map data loads: show loading spinner centered on dark canvas
- Loading animation: spinning circle, `#48BB78` color, 40px diameter, 1000ms rotation loop
- Once map loaded: fade in from black (same as room transition)

---

## 17. UX DETAILS THAT MUST NOT BE MISSED

### 17.1 Micro-Interactions

- **Button press feedback:** All top bar buttons have `transform: scale(0.92)` on `mousedown`, releases on `mouseup` → perceived physical click
- **Chat input grow:** Input height auto-expands for long messages up to 3 lines before scrolling (not fixed single-line)
- **Participant list item hover:** Background transition `150ms`, slight left padding increase `16px → 20px`
- **Modal close button hover:** `×` rotates `0deg → 90deg` over `200ms`
- **Emoji picker:** opens with scale `0.8 → 1.0` + opacity `0 → 1` in `150ms`

### 17.2 Hover States (All Interactive Elements)

| Element                     | Hover Effect                                                  |
| --------------------------- | ------------------------------------------------------------- |
| Top bar buttons             | `background: rgba(255,255,255,0.16)`, `200ms`                 |
| Sidebar participant items   | `background: rgba(255,255,255,0.05)`, `150ms`                 |
| Modal close button          | `background: rgba(255,255,255,0.1)`, rotate `+90deg`, `200ms` |
| Chat message                | slight `background: rgba(255,255,255,0.02)` on hover          |
| Interactive object (canvas) | Pulsing gold highlight (see §8.3)                             |

### 17.3 Visual/Sound Cues (UI Representation)

Gather uses audio cues that should have visual equivalents in frontend-only mode:

| Audio Cue               | Visual Alternative                             |
| ----------------------- | ---------------------------------------------- |
| Proximity enter sound   | Green flash pulse on nearby avatar for `300ms` |
| Object interaction open | Ripple effect on interaction icon for `200ms`  |
| Chat message receive    | Subtle bounce animation on chat badge          |
| Room transition         | Black fade in/out (see §16.3)                  |
| Mute toggle             | Red flash on mute button for `150ms`           |

### 17.4 Cursor States

| Context                           | Cursor                              |
| --------------------------------- | ----------------------------------- |
| Over canvas (walking area)        | `default`                           |
| Over interactive object on canvas | `pointer` (when object highlighted) |
| Over UI buttons                   | `pointer`                           |
| Over non-interactive UI           | `default`                           |
| Over video bubbles                | `default`                           |
| Dragging (if implemented)         | `grabbing`                          |

### 17.5 Timing Details

- Proximity grace period (enter): `300ms` — prevents micro-connects on border-crossing
- Proximity grace period (exit): `500ms` — prevents dropped calls from brief exits
- Chat bubble auto-dismiss minimum: `3000ms`
- Toast notification auto-dismiss: `4000ms`
- Typing indicator timeout: disappears if no keystroke for `3000ms`
- Button active state (scale-down): `80ms` duration on mousedown
- Camera lerp per frame: `0.12` (approximately 12% of remaining distance per frame at 60fps = ~7 frames to visually settle)

---

## 18. IMPLEMENTATION GUIDELINES FOR NEXT AI

### 18.1 Recommended Build Order

**Phase 1 — World Foundation (no UI, no peers)**

1. Set up Vite + React project
2. Create `<GameCanvas>` component with `useRef` canvas, `useEffect` game loop using `requestAnimationFrame`
3. Define tilemap data structure, implement tileset loading with `new Image()`
4. Render a static 20×20 tile grid on canvas
5. Implement `collisionMap` boolean grid
6. Add camera transform (`ctx.translate`)

**Phase 2 — Player Avatar** 7. Load player sprite sheet (or placeholder colored rectangle for now) 8. Implement `keysHeld` input tracking 9. Implement tile-based movement with 200ms interval 10. Implement smooth lerp interpolation 11. Implement collision checking before move 12. Implement directional sprite row selection 13. Implement walking animation frame cycling (150ms per frame) 14. Render name label above avatar on canvas

**Phase 3 — Camera** 15. Implement camera follow (player always centered) 16. Implement boundary clamping 17. Implement zoom (mouse wheel + keys) 18. Implement camera lerp for teleports

**Phase 4 — Objects & Interaction** 19. Add world objects to tilemap data, render object sprites 20. Implement interaction range detection each frame 21. Update bottom bar hint text on enter/exit range 22. Implement modal open/close on `X` key 23. Implement `isInteracting` → disable movement

**Phase 5 — UI Overlays (DOM/React)** 24. Build `<TopBar>` component with all buttons and toggle logic 25. Build `<BottomBar>` with chat input and hint text 26. Build `<RightSidebar>` with participant list and chat panel tabs 27. Wire chat input to send messages, render in chat panel 28. Render speech bubbles on canvas when message sent

**Phase 6 — Peers & Proximity (Simulated)** 29. Create fake peer data with position (x, y, name, avatar) 30. Simulate peer movement (random walk or scripted path) 31. Render peer avatars on canvas 32. Implement proximity distance calculation each frame 33. Implement proximity state machine (outside → entering → connected → leaving → outside) 34. Show/hide video bubbles based on proximity state 35. Render proximity glow ring on nearby peers

**Phase 7 — Polish** 36. Add all animation transitions (sidebar open, modal open, bubble appear/disappear) 37. Add micro-interactions (button scale on press, hover states) 38. Add notification toast system 39. Add emoji reactions 40. Implement unread badge logic 41. Handle edge cases (overlapping avatars, rapid movement) 42. Implement room transition (fade to black)

### 18.2 Testing Strategy

| Test                                             | Method                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Avatar stays in map bounds                       | Move to all edges; verify no wrap or overshoot                              |
| Collision works                                  | Place collision tiles; verify avatar blocks                                 |
| Proximity state fires                            | Script a fake peer to walk to/from player; verify bubble appears/disappears |
| Interaction modal                                | Place object; walk to it; press X; verify modal and movement lock           |
| Chat message shows in panel AND as speech bubble | Send message; verify both                                                   |
| Zoom recalculates camera correctly               | Zoom in/out; verify player stays centered                                   |
| Sidebar toggle doesn't break canvas              | Open/close sidebar repeatedly                                               |
| Typing state blocks movement                     | Focus chat input; press movement keys; verify avatar does NOT move          |
| Room transition                                  | Trigger door/portal; verify black fade and position reset                   |
| Resize                                           | Resize window; verify canvas fills viewport, player remains centered        |

### 18.3 Performance Guidelines

- The game loop should budget: **< 4ms for canvas draw** (for stable 60fps on 16ms budget)
- Use `ctx.save()` / `ctx.restore()` around camera transform only — not per-tile
- Pre-render static tile layers to an offscreen canvas; composite each frame (dirty-flag optimization)
- Only re-render if state changed (position, animation frame, peer update) — use `isDirty` flag
- Video bubbles: use React's virtual DOM; only update on proximity state change
- Sprite images: pre-load ALL assets before game loop starts; show loading screen during preload

---

_End of Gather.town Frontend Specification — Version 1.0_

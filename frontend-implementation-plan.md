# Gather Frontend Implementation Plan (Replica-Exact)

This plan is rebuilt from frontend-spec.md and the current codebase state. It tracks what is already implemented, what is partial, and what is missing to reach a pixel- and behavior-level replica.

Legend:

- [x] Done
- [~] Partial
- [ ] Not started

## 0) Baseline Project Setup

- [x] Vite + React app scaffolded
- [x] Tailwind configured
- [x] Full-viewport canvas element and global layout
- [x] Global CSS for pixel rendering and base animations

## 1) World Rendering (Canvas)

- [x] Tilemap data structure and collision map
- [x] Offscreen tile layer cache
- [x] Multi-layer tile rendering (floor, details, objects below/above)
- [x] Tileset asset support (placeholder tiles only)
- [x] Spritesheet tileset import and correct indexing
- [x] Floor decal layer and roof/ceiling layer

## 2) Player Avatar System

- [x] Tile-based movement with 200ms interval
- [x] Smooth interpolation between tiles
- [x] Directional facing updates
- [x] Walking animation timing and ping-pong frames
- [x] Name label rendering with pill background
- [x] Sprite sheet rendering (placeholder sprites only)
- [x] Real avatar sprite sheets and asset loading (path + fallback in place)
- [x] Pixel-art font for name labels

## 3) Input & Controls

- [x] Keyboard movement (WASD/Arrows) with priority order
- [x] Click-to-move pathfinding with obstacle avoidance
- [x] Zoom controls (wheel, +, -) with smooth zoom
- [x] Movement lock during typing/interactions
- [ ] Optional input shortcuts (T to focus chat)

## 4) Camera System

- [x] Camera follow centered on player
- [x] Camera bounds clamping
- [x] Teleport camera smoothing
- [x] Zoom keeps player centered

## 5) Objects & Interaction

- [x] World objects with metadata
- [x] Interaction range detection
- [x] Press X to interact hint
- [x] Highlight glow + corner brackets
- [x] Modal open/close with timing
- [x] Object sprites (placeholder blocks only)
- [x] Object-specific modal content (whiteboard, TV, poster, note, game)

## 6) Chat System

- [x] Bottom bar input and send
- [x] Chat panel with grouping rules
- [x] New message jump button
- [x] Speech bubble on canvas
- [x] Typing indicator animation (UI exists, no state updates)
- [x] Unread badge logic (basic count only)
- [x] System messages (join/leave)
- [x] Emoji picker for chat input

## 7) Peers & Proximity

- [x] Simulated peers and random walk
- [x] Proximity distance check each frame
- [x] Proximity state machine with grace periods
- [x] Nearby glow ring with pulse
- [x] Video bubbles appear/disappear
- [x] Speaking indicator and mute/cam icons (placeholder states)
- [x] Per-room proximity radius support
- [x] Room-specific peer visibility rules

## 8) UI Overlays (Top/Bottom/Sidebar)

- [x] Top bar layout with buttons and badges (text placeholders)
- [x] Bottom bar hint and input
- [x] Right sidebar panels
- [x] Iconography (mic, camera, screen, emoji, people, chat, settings)
- [x] Button toggle states (mute/cam/share colors and icons)
- [x] Emoji picker popover
- [x] Settings modal

## 9) Visual Fidelity & Micro-Interactions

- [x] Bubble enter/leave animations
- [x] Toast slide in/out
- [x] Emoji float animation
- [x] Button press scale (top bar only)
- [x] Hover states for all interactive elements
- [x] Chat badge bounce animation
- [x] Cursor states for all contexts
- [x] Room transition fade timing alignment

## 10) Responsiveness & Accessibility

- [ ] Breakpoints for <1200, <768, <480
- [ ] Sidebar overlay behavior on small screens
- [ ] Video bubble size reduction at small widths
- [ ] Optional proximity circle toggle (accessibility/dev)

## 11) Assets & Styling Parity

- [ ] Import real tileset and object sprites
- [ ] Import real avatar sprites
- [ ] Use specified fonts (Press Start 2P for labels)
- [ ] Replace placeholders with exact colors, sizes, and spacing
- [ ] Apply exact opacity, blur, and border specs

## 12) QA Pass (Spec Parity)

- [ ] Confirm canvas sizing and DPR handling
- [ ] Validate movement, collisions, and boundaries
- [ ] Validate proximity transitions and video bubble rules
- [ ] Validate chat behavior (grouping, typing, unread)
- [ ] Validate interactions and modal behavior
- [ ] Validate responsive behavior on mobile sizes

---

## Next Focus Recommendation

Prioritize Phase 8 (UI iconography and toggle states) + Phase 11 (assets) to move from functional prototype to exact visual replica.

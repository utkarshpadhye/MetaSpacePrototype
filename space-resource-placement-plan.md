# Space Resource Placement Plan (GLB -> Baked 2D Props)

This plan maps the six GLB resources to exact map sections and tile coordinates already used by the app world.

## Source Assets

- chairDesk.glb
- lampRoundFloor.glb
- loungeDesignSofaCorner.glb
- loungeSofa.glb
- pottedPlant.glb
- rugSquare.glb

## Placement Rules

- Keep all decor non-interactive unless a feature needs interaction.
- Preserve current walkability and seat usage paths.
- Bake and place props as 2D sprites in existing draw layers.
- Favor symmetry in shared spaces (lounge/cafeteria/conference).

## Exact Mapping

### 1) Lounge (section: x=1..9, y=8..13)

- loungeSofa.glb
  - Replace sofa-1 at anchor tile (2, 9), footprint 3x1.
  - Replace sofa-2 at anchor tile (6, 9), footprint 3x1.
- loungeDesignSofaCorner.glb
  - Replace sofa-3 area at anchor tile (4, 11), footprint 3x1.
  - Optional variant for corner look: use footprint 2x2 anchored at (4, 10) if sprite framing allows.
- rugSquare.glb
  - Primary lounge rug centered at tile (5, 10), footprint 3x3 (covers x=4..6, y=9..11).
- lampRoundFloor.glb
  - Accent lamps at (2, 12) and (8, 12), footprint 1x1.
- pottedPlant.glb
  - Plants at (1, 9), (9, 9), (1, 13), (9, 13), footprint 1x1.

### 2) Desk Area (section: x=12..28, y=1..6)

- chairDesk.glb
  - Replace each desk table visually:
    - desk-1 anchor (13, 2), 2x1
    - desk-2 anchor (17, 2), 2x1
    - desk-3 anchor (21, 2), 2x1
    - desk-4 anchor (13, 4), 2x1
    - desk-5 anchor (17, 4), 2x1
    - desk-6 anchor (21, 4), 2x1
- pottedPlant.glb
  - Add visual separators at (16, 2), (20, 2), (24, 2), (16, 4), (20, 4), (24, 4), 1x1.
- lampRoundFloor.glb
  - Add ambient lamps at (28, 2) and (28, 4), 1x1.

### 3) Cafeteria (section: x=12..28, y=8..13)

- rugSquare.glb
  - Place one rug under converter table at anchor (20, 10), footprint 3x3.
- lampRoundFloor.glb
  - Place at (13, 9) and (27, 9), 1x1.
- pottedPlant.glb
  - Place at (13, 13) and (27, 13), 1x1.
- chairDesk.glb
  - Optional cafe workstation cluster at (15, 10), footprint 2x1 (decor-only).

### 4) Conference Room (section: x=1..10, y=1..6)

- rugSquare.glb
  - Center under conference table around (6, 3), footprint 3x3.
- pottedPlant.glb
  - Place at (2, 2), (9, 2), (2, 5), (9, 5), 1x1.
- lampRoundFloor.glb
  - Place at (1, 3) and (10, 3), 1x1.

### 5) Focus Rooms A-D (private sections)

- chairDesk.glb
  - Replace each focus desk:
    - focus-a at (2, 17), 2x1
    - focus-b at (9, 17), 2x1
    - focus-c at (16, 17), 2x1
    - focus-d at (23, 17), 2x1
- lampRoundFloor.glb
  - One lamp per room near back wall:
    - A: (5, 17)
    - B: (12, 17)
    - C: (19, 17)
    - D: (26, 17)
- pottedPlant.glb
  - One plant per room near entrance side:
    - A: (3, 19)
    - B: (10, 19)
    - C: (17, 19)
    - D: (24, 19)

## Layering and Collision

- Layering:
  - Rugs: floor layer draw pass.
  - Sofas/desks/plants/lamps: above furniture pass but below player label pass.
- Collision:
  - Keep existing collisionMap behavior from current furniture footprints.
  - If a baked sprite footprint differs from current rect, update collision rectangles to match the rendered footprint.

## Integration Order

1. Bake all six GLBs into sprite outputs (top-down orthographic profile).
2. Replace current lounge/desk visual rectangles with sprite draws.
3. Add cafeteria and conference decor pass.
4. Validate seat access and pathfinding.
5. Tune visual offsets and shadows.

## Implementation Status (Current)

- Decor placement has been wired in code with the exact room mapping above.
- Renderer now supports both:
  - Per-sprite sources via `manifest.json`
  - Atlas-based frame extraction via `atlas` + `frame` metadata (see `manifest.atlas.example.json`)
- Subtle per-section ambience overlay has been added for spatial mood separation.

# Sprite Bake Checklist (GLB -> 2D Isometric/Top-Down Props)

Use this checklist to produce clean, consistent 2D assets from the six GLB files for the MetaSpace map.

## 1) Pre-Bake Setup

- Confirm all source GLBs import cleanly in Blender.
- Apply transforms on each model: location/rotation/scale.
- Normalize real-world scale relative to tile units (target: 1 tile ~= 1 meter visual feel).
- Set naming convention:
  - prop_chair_desk
  - prop_lamp_floor_round
  - prop_sofa_lounge
  - prop_sofa_corner_design
  - prop_plant_potted
  - prop_rug_square

## 2) Camera and Framing

- Choose a single consistent render angle for all props:
  - Preferred: top-down slight angle (2.5D), camera tilt 35-45 degrees.
- Orthographic camera for consistency.
- Keep pivot centered at logical foot point (where prop touches floor).
- Frame with tight margins but preserve shadow room (6-12 px).

## 3) Lighting and Material Pass

- Use one neutral key light + one soft fill + optional rim.
- Avoid harsh specular highlights that clash with flat UI.
- Bake subtle ambient occlusion for grounding.
- Keep palette saturation moderate to match existing world colors.

## 4) Output Specs

- Export PNG with transparency.
- Baseline sizes (can adjust after in-app test):
  - rugs: 256x256
  - sofas/desks: 192x128 or 256x160
  - plants/lamps: 96x128 or 128x128
- Also export @2x variants if crispness is needed on high-DPI displays.
- Use sRGB color space.

## 5) Post-Processing

- Trim excessive transparent borders.
- Add soft contact shadow layer if not baked strongly enough.
- Ensure edge anti-aliasing is clean on dark and light backgrounds.
- Verify no color fringing from alpha premultiplication.

## 6) Sprite Metadata

- Create a small manifest JSON for each sprite:
  - id
  - image path
  - drawWidth / drawHeight
  - anchorX / anchorY (foot pivot)
  - collisionWidth / collisionHeight
  - shadowOffset
- Keep anchor at bottom-center for tall props (lamps/plants), center for rugs.

## 7) In-App Visual QA

- Test each prop in target section:
  - Lounge: sofas + rug + plants + lamps
  - Desk area: desk-chairs + separators
  - Cafeteria: rug accents + plants/lamps
  - Conference: rug + perimeter decor
  - Focus rooms: desk + lamp + plant
- Verify players do not visually clip through foreground areas incorrectly.
- Verify label readability around tall props.

## 8) Performance QA

- Confirm texture memory remains low (atlas where practical).
- Prefer combining static decor into one atlas per zone:
  - atlas_lounge.png
  - atlas_work.png
  - atlas_focus.png
- Avoid runtime scaling per frame when possible; pre-size assets.

## 9) Final Acceptance Criteria

- Visual consistency: all props share perspective and lighting language.
- Spatial clarity: walk paths and interactive hotspots remain obvious.
- Theme fit: cozy modern collaborative office vibe.
- No regressions in FPS or interaction hit targets.

## 10) Recommended Folder Layout

- app/public/assets/sprites/props/
  - chair-desk.png
  - lamp-round-floor.png
  - lounge-sofa.png
  - lounge-sofa-corner.png
  - potted-plant.png
  - rug-square.png
- app/public/assets/sprites/props/manifest.json
- Optional atlas mode:
  - app/public/assets/sprites/props/atlas-props.png
  - app/public/assets/sprites/props/manifest.atlas.example.json
  - Replace manifest.json with atlas + frame coordinates once baking is complete.

## 11) Nice-to-Have Enhancements

- Alternate colorways for sofas/plants to avoid repetition.
- Subtle idle lighting variation in lounge lamps at night mode (if added later).
- Seasonal decor variant pack as optional theme overlay.

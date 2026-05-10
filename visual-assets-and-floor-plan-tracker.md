# MetaSpace Visual Assets and Floor Plan Tracker

Version: 1.0  
Date: 9 May 2026  
Goal: Upgrade MetaSpace from the current basic floor plan into a cozy startup-style pixel-art workspace, while preserving the existing working character movement and interaction systems.

---

## 1. Direction Decisions

- Visual style: cozy startup office, pastel pixel-art, similar to Gather-style office maps.
- Design language: upgrade current look without making it feel like a completely different product.
- Character scope: 2 selectable default characters total.
  - 1 male avatar
  - 1 female avatar
- Character format: variants of the current working character.
- Character movement: same animation behavior as current app, 4-direction movement.
- Character customization: not required for this iteration.
- Floor strategy for POC: use one large baked background image with furniture and room objects included.
- Collision strategy: keep collision and interaction zones code-driven, even when objects are baked into the background.
- Required common areas:
  - Conference room
  - Lounge
  - Library / knowledge area
  - Cafeteria
  - Hallway
  - Admin / reception table
  - Desk work area
- Interaction strategy: furniture and room features should have logical hotspots.
- Asset source: AI-generated raster assets.
- Target tile logic: 32x32 tile-friendly layout.
- Layout goal: fill the horizontal space better; reduce the current empty side padding.

---

## 2. Implementation Strategy

## 2.1 Characters

Characters should remain modular sprite sheets because they move, animate, face directions, and may be selectable by the user.

Expected output:

- Male character sprite sheet
- Female character sprite sheet
- Same frame structure as the current working avatar, after audit confirms exact dimensions and frame layout
- Transparent PNG or chroma-key source converted to transparent PNG

## 2.2 Floor Plan

For the first proof of concept, use a large baked background image for the full workspace.

Benefits:

- Faster visual upgrade
- Easier to test overall art direction
- Fewer individual prop assets required immediately
- Existing collision and interaction logic can remain code-driven

Important constraint:

- Do not bake characters, labels, speech bubbles, UI, text, or room names into the background.

## 2.3 Interactions

Even if furniture is baked into the map image, interaction zones should remain separate data in code.

Potential hotspots:

- Reception desk
- Conference table / presentation screen
- Library shelves
- Cafeteria counter / coffee machine
- Lounge sofa / coffee table
- PM board
- CRM desk / board
- Docs / library terminal

## 2.4 Future Customizable Areas

This is a separate future iteration.

Common areas should remain fixed:

- Cafeteria
- Conference room
- Library
- Lounge
- Hallway
- Reception

Customizable areas planned later:

- Desk work areas
- Occupancy slots
- Admin-controlled add/remove occupancy
- Possibly admin-controlled desk/furniture placement

Likely backend/frontend additions later:

- `workspace_layout`
- `layout_zone`
- `placeable_object`
- `desk_assignment`
- Permission: `workspace.layout.manage`
- Admin layout editor UI
- Saved layout preview
- Collision regeneration or persisted collision rectangles

---

## 3. POC Todo

## 3.1 Audit Current Renderer

- [x] Confirm current tile size and scaling.
- [x] Confirm current character sprite sheet dimensions.
- [x] Confirm current animation frame order and frame count.
- [x] Confirm world dimensions and camera bounds.
- [x] Review current floor/wall/furniture rendering in `GameCanvas.tsx`.
- [x] Review current collision and interaction definitions in `world.ts`.
- [x] Decide POC background image dimensions.
- [x] Decide whether the POC background should replace all current tile rendering or sit underneath some existing layers.

Validation:

- [x] We know the exact sprite sheet format needed.
- [x] We know the exact map/background dimensions needed.
- [x] We know which existing map objects should remain code-rendered vs baked into the image.

## 3.2 Generate POC Background

- [x] Generate first full office background using Prompt 1 or Prompt 2.
- [x] Check that the image has no characters, labels, UI, or speech bubbles.
- [x] Check that common areas are visually clear.
- [x] Check that paths are open and readable.
- [x] Check that furniture aligns reasonably to a 32px tile grid.
- [x] Save selected source image into project assets.

Suggested path:

```text
app/public/assets/maps/cozy-startup-office-poc.png
```

Validation:

- [x] Background looks consistent with MetaSpace.
- [x] Background can be used as a game map, not just concept art.
- [x] Horizontal layout feels filled.

## 3.3 Wire POC Background Into Canvas

- [x] Add background image loading to the canvas renderer.
- [x] Render the POC background as the base map layer.
- [x] Preserve player rendering.
- [x] Preserve remote peer rendering.
- [x] Preserve speech bubbles, emoji reactions, and UI overlays.
- [x] Update world bounds to match the new background image.
- [x] Adjust camera bounds to reduce/avoid side padding.

Validation:

- [x] Background renders at correct scale.
- [x] Player appears on top of background.
- [x] Camera follows player correctly.
- [x] No blank side padding at common viewport sizes.

## 3.4 Collision and Walkability

- [x] Define collision rectangles matching baked walls/furniture.
- [x] Keep major corridors walkable.
- [x] Keep room entrances clear.
- [x] Ensure desks, sofas, shelves, counters, and conference furniture block movement.
- [x] Verify player cannot walk through visually solid objects.
- [x] Verify player can reach every required common area.

Validation:

- [x] Movement feels natural.
- [x] Collision matches what users visually expect.
- [x] No trapped spawn points.

## 3.5 Interaction Hotspots

- [x] Add or update hotspot zones for mandatory common areas.
- [x] Add reception/admin interaction.
- [x] Add conference interaction.
- [x] Add lounge interaction.
- [x] Add library/docs interaction.
- [x] Add cafeteria interaction.
- [x] Add PM interaction.
- [x] Add CRM interaction.
- [x] Keep interaction prompts intuitive.

Validation:

- [x] Nearby interaction hints appear at the right objects.
- [x] Existing overlays still open correctly.
- [x] Permission-gated areas still behave correctly.

## 3.6 Generate Character Sprite Sheets

- [x] Generate male character sprite sheet.
- [x] Generate female character sprite sheet.
- [x] Remove chroma-key background or otherwise produce transparent PNGs.
- [x] Slice/check frame alignment.
- [x] Compare against current character size and motion.
- [x] Save selected assets into project.

Suggested paths:

```text
app/public/assets/avatars/player-male.png
app/public/assets/avatars/player-female.png
```

Validation:

- [x] Both characters animate correctly.
- [x] Both characters face 4 directions correctly.
- [x] Both characters are readable at current zoom.
- [x] Both characters feel like variants of the current avatar style.

## 3.7 Character Selection POC

- [x] Add simple character selection UI.
- [x] Allow user to choose male or female avatar.
- [x] Persist selection locally first.
- [x] Load selected sprite sheet into `GameCanvas`.
- [x] Keep current default behavior if no selection exists.

Validation:

- [x] Selection persists after refresh.
- [x] Character changes without breaking movement.
- [x] Remote/user identity logic is not disrupted.

## 3.8 Visual QA

- [x] Check desktop viewport.
- [x] Check narrower viewport.
- [x] Check movement near map edges.
- [x] Check all rooms and interactions.
- [x] Check map readability at current zoom.
- [x] Check that UI overlays do not obscure important map areas excessively.

Validation:

- [x] POC is good enough to decide whether to proceed to full map replacement.

---

## 4. Generation Prompts

## 4.1 Full POC Office Background

```text
Use case: stylized-concept
Asset type: 2D pixel-art game map background for a browser-based virtual office
Primary request: Create a large cozy startup office floor plan background in pastel pixel-art style, top-down / slightly isometric Gather-style perspective.

Scene/backdrop:
A warm open-plan startup office with clearly readable zones: reception/admin desk, wide hallway, desk work area, focus rooms, conference room, lounge, library/knowledge area, and cafeteria. The layout should feel filled, friendly, and intuitive, with open walking paths between all zones.

Subject:
A complete office floor map with furniture and decor baked into the background. Include desks with monitors, chairs, plants, sofas, bookshelves, meeting table, whiteboard/screen, cafeteria counter, coffee machine, small dining tables, reception desk, rugs, lamps, wall dividers, and decorative office objects.

Style/medium:
Pixel art, cozy startup vibe, pastel colors, clean readable game environment, similar to Gather.town-style office maps. 32x32 tile-friendly proportions. Crisp pixel edges, no painterly blur, no realistic lighting.

Composition/framing:
Wide horizontal floor plan, open layout, orthographic top-down game view. The full map should be usable as a 2D canvas background. Leave clear walkable corridors at least 2 tiles wide. Furniture should align to an invisible 32px grid. No perspective distortion.

Color palette:
Warm cream floors, soft lavender/blue rugs, pale grey office carpet, peach and light wood furniture, muted green plants, slate-blue dividers, small accent colors.

Constraints:
No characters. No people. No speech bubbles. No UI overlays. No labels. No readable text. No logos. No shadows that break pixel-art readability. No dark cyberpunk theme. No empty large blank areas. Keep paths visibly walkable.

Avoid:
Photorealism, 3D render, anime characters, text labels, watermarks, clutter that blocks paths, random fantasy objects, outdoor scene.
```

## 4.2 Cleaner Tile-Aligned Background

```text
Create a tile-aligned 2D pixel-art office floor map for a browser virtual workspace game.

The map must use a cozy startup office style with pastel colors and 32x32 tile-friendly geometry. It should be a wide horizontal layout with the following zones clearly visible but unlabeled:
- reception/admin desk near entrance
- main desk work area
- conference room with table, chairs, presentation screen, and whiteboard
- lounge with sofas, rug, coffee table, plants, lamps
- library/knowledge area with bookshelves and reading chairs
- cafeteria with counter, coffee machine, fridge, small tables
- hallway/open walking paths
- focus rooms with small desks

Generate the whole map as one clean background image with all furniture baked in. No characters, no UI, no labels, no speech bubbles, no text. Keep walkable paths open and intuitive. Use crisp pixel art, orthographic top-down perspective, soft pastel office palette, and clean readable object silhouettes.
```

## 4.3 Male Character Sprite Sheet

```text
Use case: stylized-concept
Asset type: pixel-art game character sprite sheet
Primary request: Create a male avatar sprite sheet matching an existing cozy 2D virtual office pixel-art game.

Subject:
One male office avatar, friendly startup employee style. Short dark hair, casual smart outfit, neutral shirt or hoodie, pants, shoes. Default character only, no customization parts.

Style/medium:
Pixel art sprite sheet, crisp edges, transparent-ready background, 32x32 tile-compatible character scale, matching Gather-style top-down office avatars.

Composition/framing:
Sprite sheet with 4-direction movement: down, left, right, up. Include idle and walking frames matching a typical compact game character sheet. Character should be centered in each frame with consistent proportions and padding.

Animation:
Use the same general animation set as the current project character: idle and walk cycles for 4 directions. Keep body proportions consistent across all frames.

Constraints:
No weapons, no fantasy armor, no exaggerated anime style, no background scene, no labels, no text, no shadows. Character must remain readable at small size.

Background:
Perfectly flat solid #00ff00 chroma-key background for background removal. Do not use #00ff00 anywhere in the character.
```

## 4.4 Female Character Sprite Sheet

```text
Use case: stylized-concept
Asset type: pixel-art game character sprite sheet
Primary request: Create a female avatar sprite sheet matching an existing cozy 2D virtual office pixel-art game.

Subject:
One female office avatar, friendly startup employee style. Medium hair, casual smart outfit, top/jacket, pants or skirt with leggings, shoes. Default character only, no customization parts.

Style/medium:
Pixel art sprite sheet, crisp edges, transparent-ready background, 32x32 tile-compatible character scale, matching Gather-style top-down office avatars.

Composition/framing:
Sprite sheet with 4-direction movement: down, left, right, up. Include idle and walking frames matching a compact virtual office avatar sheet. Character should be centered in each frame with consistent proportions and padding.

Animation:
Use the same general animation set as the current project character: idle and walk cycles for 4 directions. Keep body proportions consistent across all frames.

Constraints:
No weapons, no fantasy armor, no exaggerated anime style, no background scene, no labels, no text, no shadows. Character must remain readable at small size.

Background:
Perfectly flat solid #00ff00 chroma-key background for background removal. Do not use #00ff00 anywhere in the character.
```

## 4.5 Optional Prop Sheet For Later

```text
Create a pixel-art office prop sheet for a cozy startup virtual office game.

Include individual props on a flat solid #00ff00 chroma-key background:
office desk, standing desk, monitor, laptop, office chair, conference table, whiteboard, presentation screen, bookshelf, sofa, armchair, coffee table, potted plant, rug, lamp, cafeteria counter, coffee machine, fridge, reception desk, file cabinet, focus room desk, wall divider.

Style:
Crisp pastel pixel art, top-down / slightly isometric Gather-style perspective, 32x32 tile-friendly scale, clean silhouettes, consistent lighting and palette.

Constraints:
Each object should be separated with padding. No characters. No text. No logos. No shadows baked into the background. Do not use #00ff00 inside the objects.
```

---

## 5. Open Notes

- First implementation should start with a single POC map, not a full asset system.
- Character selection can be local-only initially.
- Admin-customizable desks and focus rooms are intentionally deferred.
- If AI-generated sprite sheets do not align cleanly, create a manual slicing/cleanup step before integration.
- If baked background collision becomes too hard to maintain, switch to a layered approach: floor background + separate prop sprites + collision generated from object definitions.

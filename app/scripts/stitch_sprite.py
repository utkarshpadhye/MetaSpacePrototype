from pathlib import Path

from PIL import Image

SRC = Path(
    "/Users/utkarsh/Documents/code/MetaSpacePrototype/sprite-resources/"
    "craftpix-net-439247-free-fantasy-chibi-male-sprites-pixel-art/"
    "Swordsman/Walk.png"
)
OUT_DIR = Path(
    "/Users/utkarsh/Documents/code/MetaSpacePrototype/app/public/assets/avatars"
)

if not SRC.exists():
    raise SystemExit(f"Missing source: {SRC}")

img = Image.open(SRC).convert("RGBA")
width, height = img.size
frame_size = height
columns = width // frame_size
if columns < 3:
    raise SystemExit("Source sheet has fewer than 3 frames.")

frames = [
    img.crop((i * frame_size, 0, (i + 1) * frame_size, frame_size))
    for i in range(3)
]

out = Image.new("RGBA", (frame_size * 3, frame_size * 4))
for row in range(4):
    for col in range(3):
        out.paste(frames[col], (col * frame_size, row * frame_size))

OUT_DIR.mkdir(parents=True, exist_ok=True)
output_path = OUT_DIR / "player.png"
out.save(output_path)
print(f"Wrote {output_path} ({out.size[0]}x{out.size[1]})")

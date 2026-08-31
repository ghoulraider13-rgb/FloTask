"""Generate FloTask PWA icons (Nothing-OS style: black, white glyph)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (10, 10, 20)       # theme #0a0a14
FG = (255, 255, 255)
GRID = (42, 42, 42)     # #2a2a2a

def make_icon(size, path, maskable=False):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)

    # subtle dot grid like the app background
    step = max(size // 24, 4)
    for y in range(0, size, step):
        for x in range(0, size, step):
            d.ellipse([x, y, x+1, y+1], fill=GRID)

    # font
    fsize = int(size * 0.55)
    font = None
    for name in ("SpaceMono-Bold.ttf", "Cousine-Bold.ttf", "Courier New Bold.ttf"):
        try:
            font = ImageFont.truetype(f"C:/Windows/Fonts/{name}", fsize)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default(size=fsize)

    text = "F"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    # maskable icons need more inner padding (safe zone = 80% circle)
    shrink = 0.72 if maskable else 0.9
    cx, cy = size / 2, size / 2
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, font=font, fill=FG)

    # white ring border for identity
    margin = int(size * (0.06 if not maskable else 0.12))
    d.rounded_rectangle([margin, margin, size - margin, size - margin],
                        radius=int(size * 0.18), outline=FG, width=max(size // 128, 2))

    img.save(path, "PNG")
    print("wrote", path)

make_icon(192, os.path.join(OUT, "icon-192.png"))
make_icon(512, os.path.join(OUT, "icon-512.png"))
make_icon(512, os.path.join(OUT, "icon-maskable-512.png"), maskable=True)
print("done")

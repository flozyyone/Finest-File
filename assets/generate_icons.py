"""
Generates clean raster PNG and Windows .ico assets for FinestFile logo using PIL.
Draws the exact geometry of the folder logo at high resolution with anti-aliasing.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

def draw_folder(size):
    # Draw at 4x supersampling
    scale = 4
    w, h = size * scale, size * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Coordinates scaled to canvas
    def s(val):
        return val * (w / 256.0)

    # 1. Back folder tab and body
    back_color = (37, 99, 178, 255) # #2563b2
    draw.rounded_rectangle(
        [s(28), s(52), s(228), s(212)],
        radius=s(14),
        fill=back_color
    )
    # Folder tab top
    draw.rounded_rectangle(
        [s(28), s(44), s(124), s(90)],
        radius=s(12),
        fill=back_color
    )

    # 2. Document sheet peek
    sheet_color = (248, 250, 252, 245)
    draw.rounded_rectangle(
        [s(52), s(66), s(204), s(146)],
        radius=s(6),
        fill=sheet_color
    )
    line_col1 = (148, 163, 184, 255)
    line_col2 = (203, 213, 225, 255)
    draw.rounded_rectangle([s(68), s(82), s(116), s(86)], radius=s(2), fill=line_col1)
    draw.rounded_rectangle([s(68), s(96), s(148), s(100)], radius=s(2), fill=line_col2)

    # 3. Front folder flap shadow
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [s(28), s(104), s(228), s(212)],
        radius=s(14),
        fill=(15, 23, 42, 70)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=s(4)))
    img.alpha_composite(shadow)

    # 4. Front folder flap
    front_color = (43, 120, 235, 255) # #2b78eb
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        [s(28), s(104), s(228), s(212)],
        radius=s(14),
        fill=front_color
    )

    # 5. Front top-edge highlight line
    highlight_color = (147, 197, 253, 200)
    draw.line([s(36), s(106), s(220), s(106)], fill=highlight_color, width=int(max(1, s(2))))

    # Downsample with high-quality Lanczos
    return img.resize((size, size), Image.Resampling.LANCZOS)

out_dir = r"c:\Users\katsu\Desktop\Yeni klasör (2)\FinestFile\assets"
os.makedirs(out_dir, exist_ok=True)

# Generate master PNG
master = draw_folder(256)
master.save(os.path.join(out_dir, "finestfile-logo.png"), "PNG")
print("Saved finestfile-logo.png")

# Generate standard multi-resolution Windows ICO (16, 24, 32, 48, 64, 128, 256)
sizes = [16, 24, 32, 48, 64, 128, 256]
icons = [draw_folder(sz) for sz in sizes]
icons[-1].save(
    os.path.join(out_dir, "finestfile-logo.ico"),
    format="ICO",
    sizes=[(sz, sz) for sz in sizes],
    append_images=icons[:-1]
)
print("Saved finestfile-logo.ico with resolutions:", sizes)

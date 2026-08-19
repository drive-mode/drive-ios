#!/usr/bin/env python3
"""Generate every Drive icon from one canonical transparent mark.

Requires Pillow. `--import-reference` is the one-time normalization path for an
approved single mark or a wide side-by-side light/dark reference sheet. Regular
generation and `--check` use Brand/DriveMarkSource.png only.
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Brand" / "DriveMarkSource.png"
APP_ICON_DIR = ROOT / "Assets.xcassets" / "AppIcon.appiconset"
RUNTIME_ICON_DIR = ROOT / "Assets.xcassets" / "DriveMark.imageset"
ICONS_DIR = ROOT / "Icons"
CANVAS = 1024


def _reference_mask(image: Image.Image) -> Image.Image:
    """Extract foreground from a single mark or wide light/dark sheet."""

    image = image.convert("L")
    if image.width >= image.height * 1.5:
        # The approved sheet is a light/dark pair split down the middle. Leave
        # a small gutter so the divider cannot enter the mask.
        image = image.crop((0, 0, image.width // 2 - 8, image.height))

    corner_values = [
        image.getpixel((0, 0)),
        image.getpixel((image.width - 1, 0)),
        image.getpixel((0, image.height - 1)),
        image.getpixel((image.width - 1, image.height - 1)),
    ]
    background_is_light = sum(corner_values) / len(corner_values) >= 128
    if background_is_light:
        mask = image.point(lambda value: 255 if value < 128 else 0)
    else:
        mask = image.point(lambda value: 255 if value >= 128 else 0)
    return mask


def _import_reference(path: Path) -> None:
    """Normalize an approved monochrome mark without changing its geometry."""

    mask = _reference_mask(Image.open(path))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.65))
    mask = mask.point(lambda value: 255 if value >= 128 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("reference does not contain a dark mark")

    cropped = mask.crop(bounds)
    content_side = max(cropped.size)
    padding = round(content_side * 0.06)
    canvas_side = content_side + 2 * padding
    canvas = Image.new("L", (canvas_side, canvas_side), 0)
    canvas.paste(
        cropped,
        ((canvas_side - cropped.width) // 2, (canvas_side - cropped.height) // 2),
    )
    alpha = canvas.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)

    source = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    source.paste((0, 0, 0, 255), mask=alpha)
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    SOURCE.write_bytes(_png_bytes(source))


def _source_mask() -> Image.Image:
    if not SOURCE.exists():
        raise FileNotFoundError(
            f"missing {SOURCE.relative_to(ROOT)}; import the approved reference first"
        )
    return Image.open(SOURCE).convert("RGBA").getchannel("A")


def _transparent_mark(size: int, color: tuple[int, int, int, int]) -> Image.Image:
    mask = _source_mask().resize((size, size), Image.Resampling.LANCZOS)
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    image.paste(color, mask=mask)
    return image


def _rendered_images() -> dict[Path, Image.Image]:
    black = _transparent_mark(CANVAS, (0, 0, 0, 255))
    white = _transparent_mark(CANVAS, (255, 255, 255, 255))

    light = Image.new("RGB", (CANVAS, CANVAS), "white")
    light.paste("black", mask=black.getchannel("A"))

    return {
        # The app runtime loads one template image and DriveBrand supplies the
        # appropriate foreground for its actual container.
        RUNTIME_ICON_DIR / "DriveMark.png": _transparent_mark(256, (0, 0, 0, 255)),
        RUNTIME_ICON_DIR / "DriveMark@2x.png": _transparent_mark(512, (0, 0, 0, 255)),
        RUNTIME_ICON_DIR / "DriveMark@3x.png": _transparent_mark(768, (0, 0, 0, 255)),
        # Apple app-icon appearances: Any is opaque; Dark keeps transparency
        # for the system background; Tinted is a one-color grayscale mask.
        APP_ICON_DIR / "AppIcon-Any.png": light,
        APP_ICON_DIR / "AppIcon-Dark.png": white,
        APP_ICON_DIR / "AppIcon-Tinted.png": white,
        # Lightweight direct-compiler fallback retained by build.sh.
        ICONS_DIR / "AppIcon1024.png": light,
        ICONS_DIR / "AppIcon60x60@2x.png": light.resize(
            (120, 120), Image.Resampling.LANCZOS
        ),
        ICONS_DIR / "AppIcon60x60@3x.png": light.resize(
            (180, 180), Image.Resampling.LANCZOS
        ),
    }


def _png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if committed outputs differ from the canonical mark",
    )
    parser.add_argument(
        "--import-reference",
        type=Path,
        metavar="PNG",
        help="replace the canonical mark from an approved mark or light/dark sheet",
    )
    args = parser.parse_args()
    if args.check and args.import_reference:
        parser.error("--check and --import-reference cannot be combined")
    if args.import_reference:
        _import_reference(args.import_reference)

    rendered = _rendered_images()
    mismatches: list[Path] = []
    for path, image in rendered.items():
        expected = _png_bytes(image)
        if args.check:
            if not path.exists() or path.read_bytes() != expected:
                mismatches.append(path.relative_to(ROOT))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(expected)

    if mismatches:
        for path in mismatches:
            print(f"out of date: {path}", file=sys.stderr)
        print("run Brand/generate-brand-assets.py", file=sys.stderr)
        return 1

    action = "verified" if args.check else "generated"
    print(f"{action} {len(rendered)} Drive brand assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

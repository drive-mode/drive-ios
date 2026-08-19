#!/usr/bin/env python3
"""Regression tests for Drive brand reference normalization."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


MODULE_PATH = Path(__file__).with_name("generate-brand-assets.py")
SPEC = importlib.util.spec_from_file_location("generate_brand_assets", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"unable to load {MODULE_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReferenceMaskTests(unittest.TestCase):
    @staticmethod
    def light_mark() -> Image.Image:
        image = Image.new("L", (64, 64), 255)
        ImageDraw.Draw(image).rounded_rectangle((12, 8, 51, 55), radius=8, fill=0)
        return image

    def test_square_single_mark_is_not_mistaken_for_a_two_up_sheet(self) -> None:
        reference = self.light_mark()

        mask = MODULE._reference_mask(reference)

        self.assertEqual(mask.size, reference.size)
        self.assertEqual(mask.getbbox(), (12, 8, 52, 56))

    def test_square_inverse_sheet_uses_its_light_left_appearance(self) -> None:
        light = self.light_mark()
        light_panel = Image.new("L", (64, 128), 255)
        dark_panel = Image.new("L", (64, 128), 0)
        light_panel.paste(light, (0, 32))
        dark_panel.paste(ImageOps.invert(light), (0, 32))
        sheet = Image.new("L", (128, 128), 0)
        sheet.paste(light_panel, (0, 0))
        sheet.paste(dark_panel, (64, 0))

        mask = MODULE._reference_mask(sheet)

        self.assertEqual(mask.size, light_panel.size)
        self.assertEqual(
            mask.tobytes(), MODULE._reference_mask(light_panel).tobytes()
        )

    def test_light_and_dark_references_extract_the_same_geometry(self) -> None:
        light = self.light_mark()
        dark = ImageOps.invert(light)

        self.assertEqual(
            MODULE._reference_mask(light).tobytes(),
            MODULE._reference_mask(dark).tobytes(),
        )

    def test_wide_sheet_uses_its_light_left_appearance(self) -> None:
        light = self.light_mark()
        sheet = Image.new("L", (144, 64), 0)
        sheet.paste(light, (0, 0))
        sheet.paste(ImageOps.invert(light), (80, 0))

        mask = MODULE._reference_mask(sheet)

        self.assertEqual(mask.size, light.size)
        self.assertEqual(mask.tobytes(), MODULE._reference_mask(light).tobytes())

    def test_install_icon_appearances_keep_their_compositing_contract(self) -> None:
        rendered = MODULE._rendered_images()
        any_icon = rendered[MODULE.APP_ICON_DIR / "AppIcon-Any.png"]
        self.assertEqual(any_icon.mode, "RGB")

        for filename in ("AppIcon-Dark.png", "AppIcon-Tinted.png"):
            image = rendered[MODULE.APP_ICON_DIR / filename]
            self.assertEqual(image.mode, "RGBA")
            self.assertEqual(image.getchannel("R").getextrema(), (255, 255))
            self.assertEqual(image.getchannel("G").getextrema(), (255, 255))
            self.assertEqual(image.getchannel("B").getextrema(), (255, 255))
            self.assertEqual(image.getchannel("A").getextrema(), (0, 255))


if __name__ == "__main__":
    unittest.main()

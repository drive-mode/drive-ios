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

    def test_square_reference_is_not_mistaken_for_a_two_up_sheet(self) -> None:
        reference = self.light_mark()

        mask = MODULE._reference_mask(reference)

        self.assertEqual(mask.size, reference.size)
        self.assertEqual(mask.getbbox(), (12, 8, 52, 56))

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


if __name__ == "__main__":
    unittest.main()

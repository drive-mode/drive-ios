# Drive mark production principles

## Locked metaphor and geometry

- The Drive mark is the steering wheel with the Cline head at its hub.
- `Brand/DriveMarkReference.png` is the exact approved 1254×1254 light/dark
  reference (SHA-256 `d7f89cad545dfbb87cb0e119c56d5fbd3baa1bb23f5b0de2ca919f7a36f0bcb3`).
  Its black-on-white left half is canonical; the inverse right half is a
  presentation proof, not a second geometry.
- `Brand/DriveMarkSource.png` is the generated, normalized runtime source.
  Feature code must use
  `DriveMark` or a rendering exposed by `DriveBrand`; it must not introduce
  another logo file.
- Runtime and install assets are generated from that source. Loading motion is
  a small steering wiggle; the complete mark never tumbles.

## Two coordinated outputs

- **Runtime mark (20–192 pt):** the full vector, black on light surfaces and
  white on dark surfaces. Known nonadaptive containers use an explicit
  `DriveBrand.Contrast` value.
- **Install icon (1024 px source):** the same geometry with icon-safe optical
  padding. The asset catalog carries Any, Dark, and Tinted appearances plus
  generated legacy simulator fallbacks.

## Hard constraints

- Monochrome only. Do not fill the Drive mark purple or use agent colors.
- Preserve the steering-wheel silhouette, flat bottom, antenna nub, eye
  cutouts, angular head shoulders, and notched horizontal spokes.
- App-icon variants may change figure/ground treatment, never the core form.
- Dark and tinted app-icon files retain transparency for the system-provided
  background and treatment.

## Production rubric

- Recognizable at 20–25 pt in the Work tab and Home control.
- Clear figure/ground at 1024, 180, and 120 px.
- Black-on-light and white-on-dark variants preserve the same silhouette.
- Tinted appearance remains a one-color grayscale mask.
- `Brand/VERIFY.html` shows the committed assets at 16–192 pt and across both
  surface themes for repeatable visual QA.
- A geometry change must update the approved-reference hash deliberately and
  pass `Brand/generate-brand-assets.py --check` after regenerating the
  committed outputs.

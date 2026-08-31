# Microbes Live Wallpaper for Wallpaper Engine

An interactive WebGL wallpaper that recreates the Microbes Android live wallpaper
for Wallpaper Engine and ultrawide desktop displays.

## Current status

Milestone 1 is ready for Wallpaper Engine validation: a deterministic WebGL 2 vertical slice renders the
fog, corpse, food, and four-color microbe layers with the original procedural
shader formulas. It supports Wallpaper Engine FPS changes, pause/resume, render
quality scaling, normalized pointer input, resize, and WebGL context restoration.

The ecosystem simulation and final click-to-feed behavior are planned next. The
current entities are fixed Android-reference fixtures used to validate rendering
and performance. Final visual parity and target-PC performance remain live test
gates. The first live Wallpaper Engine measurements are recorded in
[docs/MILESTONE_1_VALIDATION.md](docs/MILESTONE_1_VALIDATION.md).
See [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) for the complete roadmap and gates.

## Installation

1. Copy the project folder to your Wallpaper Engine projects directory: `steamapps/common/wallpaper_engine/projects/myprojects/`
2. In Wallpaper Engine, click "Create Wallpaper" and select the `index.html` file
3. Apply and customize via properties

## Development

Install the development dependency and run the browser smoke suite:

```text
npm install
npm test
```

The production wallpaper has no runtime package or network dependencies. Open
`index.html` through a local static server for browser development, or import it
directly into Wallpaper Engine.

## Technical Details

- **Type**: Web-based wallpaper
- **Rendering**: WebGL 2 instanced quads with four additive layers
- **Performance**: Wallpaper Engine FPS limit plus adaptive drawing-buffer scale
- **Browser**: Embedded Chromium (Wallpaper Engine)
- **Target layouts**: Standard, ultrawide, per-monitor, cloned, and spanned

## Customization

The current project properties expose Auto, High, Balanced, and Performance render
quality modes plus an interaction toggle. Additional ecosystem properties arrive
with milestone 2. The wallpaper also respects Wallpaper Engine's general FPS limit
and pause events.

# Microbes Live Wallpaper for Wallpaper Engine

An interactive WebGL wallpaper that recreates the Microbes Android live wallpaper
for Wallpaper Engine and ultrawide desktop displays.

## Current status

The wallpaper runs an interactive, fixed-timestep ecosystem rendered with WebGL 2.
Microbes wander, avoid neighbors, seek and consume drifting food, grow, reproduce,
starve, and leave sinking corpses. Clicking adds food, while dragging attracts
nearby microbes. The simulation supports Wallpaper Engine FPS changes, pause/resume,
render quality scaling, resize, and WebGL context restoration.

The original procedural shader formulas and Android-exported fixtures remain in the
repository for visual parity checks. Final Android side-by-side acceptance remains
a live test gate. The first live Wallpaper Engine performance measurements are in
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

Project properties control render quality, zoom, interaction, movement speed,
lifecycle speed, ambient food, population density, and background decorations. The
wallpaper also respects Wallpaper Engine's general FPS limit and pause events.

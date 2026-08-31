# Microbes Live Wallpaper for Wallpaper Engine

An interactive live wallpaper featuring animated microbes that move around your desktop. Built for Wallpaper Engine.

## Features

- Real-time animated microbes with physics-based movement
- Adjustable microbe density and speed
- Customizable microbe color
- Optimized performance with FPS limiting
- Pause when fullscreen apps are active

## Installation

1. Copy the project folder to your Wallpaper Engine projects directory: `steamapps/common/wallpaper_engine/projects/myprojects/`
2. In Wallpaper Engine, click "Create Wallpaper" and select the `index.html` file
3. Apply and customize via properties

## Development

Run locally by opening `index.html` in a browser. Wallpaper Engine properties can be simulated by modifying `window.wallpaperSettings` in the console.

## Technical Details

- **Type**: Web-based wallpaper
- **Rendering**: HTML5 Canvas 2D
- **Performance**: 30 FPS (user-configurable)
- **Browser**: Embedded Chromium (Wallpaper Engine)

## Customization

Edit `project.json` to add more user properties. The wallpaper respects Wallpaper Engine''s general settings including FPS limiting and pause events.

// Wallpaper Engine API bridge
window.wallpaperSettings = {
  fps: 30,
  speed: 1.0,
  density: 100,
  color: '#00ff00'
};

window.wallpaperPropertyListener = {
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) {
      window.wallpaperSettings.fps = properties.fps;
    }
  },
  applyUserProperties(properties) {
    if (properties.speed !== undefined) {
      window.wallpaperSettings.speed = properties.speed.value;
    }
    if (properties.density !== undefined) {
      window.wallpaperSettings.density = properties.density.value;
    }
    if (properties.color !== undefined) {
      window.wallpaperSettings.color = properties.color.value;
    }
  },
  setPaused(paused) {
    if (window.app) {
      window.app.paused = paused;
    }
  }
};

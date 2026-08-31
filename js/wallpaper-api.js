// Wallpaper Engine API bridge
window.wallpaperSettings = {
  fps: 30,
  renderQuality: 'auto',
  interaction: true
};

window.wallpaperPropertyListener = {
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) {
      window.wallpaperSettings.fps = properties.fps;
      window.app?.applyFpsLimit(properties.fps);
    }
  },
  applyUserProperties(properties) {
    if (properties.renderquality !== undefined) {
      window.wallpaperSettings.renderQuality = properties.renderquality.value;
      window.app?.applyRenderQuality(properties.renderquality.value);
    }
    if (properties.zoom !== undefined) {
      window.app?.applyZoom(properties.zoom.value);
    }
    if (properties.interaction !== undefined) {
      window.wallpaperSettings.interaction = properties.interaction.value;
      window.app?.applyInteraction(properties.interaction.value);
    }
    const ecosystemProperties = [
      'movementspeed',
      'lifecyclespeed',
      'ambientfood',
      'population',
      'decorations'
    ];
    if (ecosystemProperties.some(name => properties[name] !== undefined)) {
      window.app?.applyEcosystemSettings(properties);
    }
  },
  setPaused(paused) {
    window.app?.setPaused(paused);
  }
};

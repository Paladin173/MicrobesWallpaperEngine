// Wallpaper Engine API bridge
window.wallpaperSettings = {
  fps: 30,
  renderQuality: 'auto',
  zoom: 1,
  interaction: true,
  movementSpeed: 0.6,
  lifecycleSpeed: 1,
  ambientFood: true,
  population: 'normal',
  decorations: true
};

function wallpaperPropertyValue(property) {
  return property && typeof property === 'object' && 'value' in property
    ? property.value
    : property;
}

function wallpaperBooleanValue(property) {
  const value = wallpaperPropertyValue(property);
  return value === true || value === 1 || value === '1' || value === 'true';
}

window.wallpaperPropertyListener = {
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) {
      window.wallpaperSettings.fps = properties.fps;
      window.app?.applyFpsLimit(properties.fps);
    }
  },
  applyUserProperties(properties) {
    if (properties.renderquality !== undefined) {
      window.wallpaperSettings.renderQuality = wallpaperPropertyValue(properties.renderquality);
      window.app?.applyRenderQuality(window.wallpaperSettings.renderQuality);
    }
    if (properties.zoom !== undefined) {
      window.wallpaperSettings.zoom = wallpaperPropertyValue(properties.zoom);
      window.app?.applyZoom(window.wallpaperSettings.zoom);
    }
    if (properties.interaction !== undefined) {
      window.wallpaperSettings.interaction = wallpaperBooleanValue(properties.interaction);
      window.app?.applyInteraction(window.wallpaperSettings.interaction);
    }
    const ecosystemSettings = {};
    for (const [propertyName, settingName] of [
      ['movementspeed', 'movementSpeed'],
      ['lifecyclespeed', 'lifecycleSpeed'],
      ['ambientfood', 'ambientFood'],
      ['population', 'population'],
      ['decorations', 'decorations']
    ]) {
      if (properties[propertyName] === undefined) continue;
      const value = propertyName === 'ambientfood' || propertyName === 'decorations'
        ? wallpaperBooleanValue(properties[propertyName])
        : wallpaperPropertyValue(properties[propertyName]);
      window.wallpaperSettings[settingName] = value;
      ecosystemSettings[settingName] = value;
    }
    window.app?.applyEcosystemSettings(ecosystemSettings);
  },
  setPaused(paused) {
    window.app?.setPaused(paused);
  }
};

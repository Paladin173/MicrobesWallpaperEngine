class WallpaperApp {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.paused = false;
    this.interaction = window.wallpaperSettings.interaction;
    this.fps = window.wallpaperSettings.fps;
    this.lastTime = performance.now() / 1000;
    this.fpsAccumulator = 0;
    this.simulationAccumulator = 0;
    this.elapsedSeconds = 0;
    this.frameCount = 0;
    this.pointerEvents = 0;
    this.lastPointer = null;
    this.scene = new MicrobeWorld();
    this.renderer = new MicrobesWebGLRenderer(
      this.canvas,
      this.scene,
      window.wallpaperSettings.renderQuality
    );

    this.resizeObserver = new ResizeObserver(() => this.renderer.resize());
    this.resizeObserver.observe(this.canvas);
    this.installPointerDiagnostics();
    requestAnimationFrame(time => this.run(time));
  }

  run(timestamp) {
    requestAnimationFrame(time => this.run(time));
    const now = timestamp / 1000;
    const delta = Math.min(Math.max(now - this.lastTime, 0), 0.1);
    this.lastTime = now;
    if (this.paused || this.renderer.contextLost) return;
    this.elapsedSeconds += delta;
    this.simulationAccumulator = Math.min(this.simulationAccumulator + delta, 0.1);
    while (this.simulationAccumulator >= 1 / 60) {
      this.scene.update(1 / 60);
      this.simulationAccumulator -= 1 / 60;
    }
    if (this.fps > 0) {
      this.fpsAccumulator += delta;
      const threshold = 1 / this.fps;
      if (this.fpsAccumulator < threshold) return;
      this.fpsAccumulator %= threshold;
    }
    this.renderer.draw(this.elapsedSeconds);
    this.frameCount++;
  }

  applyFpsLimit(fps) {
    this.fps = Math.max(0, Number(fps) || 0);
    this.fpsAccumulator = 0;
  }

  applyRenderQuality(quality) {
    this.renderer.setQuality(quality);
  }

  applyInteraction(enabled) {
    this.interaction = Boolean(enabled);
  }

  applyEcosystemSettings(settings) {
    if (settings.movementspeed !== undefined) {
      this.scene.setMovementScale(settings.movementspeed.value);
    }
    if (settings.lifecyclespeed !== undefined) {
      this.scene.setLifecycleScale(settings.lifecyclespeed.value);
    }
    if (settings.ambientfood !== undefined) {
      this.scene.setAmbientFoodEnabled(settings.ambientfood.value);
    }
    if (settings.population !== undefined) {
      this.scene.setPopulationDensity(settings.population.value);
    }
    if (settings.decorations !== undefined) {
      this.scene.setDecorationsEnabled(settings.decorations.value);
    }
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.lastTime = performance.now() / 1000;
    this.fpsAccumulator = 0;
    this.simulationAccumulator = 0;
  }

  installPointerDiagnostics() {
    const record = event => {
      if (!this.interaction) return;
      const rect = this.canvas.getBoundingClientRect();
      this.lastPointer = {
        type: event.type,
        id: event.pointerId,
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))
      };
      if (event.type === 'click') {
        this.scene.feed(this.lastPointer.x, this.lastPointer.y);
      } else if (event.type === 'pointermove') {
        this.scene.motion(this.lastPointer.x, this.lastPointer.y);
      }
      this.pointerEvents++;
    };
    for (const type of ['click', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      this.canvas.addEventListener(type, record);
    }
  }

  getDiagnostics() {
    return {
      ...this.renderer.getDiagnostics(),
      paused: this.paused,
      fpsLimit: this.fps,
      frameCount: this.frameCount,
      pointerEvents: this.pointerEvents,
      lastPointer: this.lastPointer,
      ecosystem: this.scene.getDiagnostics()
    };
  }
}

window.addEventListener('load', () => {
  try {
    window.app = new WallpaperApp();
  } catch (error) {
    const message = document.getElementById('error');
    message.textContent = error instanceof Error ? error.message : String(error);
    message.hidden = false;
    console.error(error);
  }
});

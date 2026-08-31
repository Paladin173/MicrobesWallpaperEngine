class WallpaperApp {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.paused = false;
    this.interaction = window.wallpaperSettings.interaction;
    this.fps = window.wallpaperSettings.fps;
    this.lastTime = performance.now() / 1000;
    this.fpsAccumulator = 0;
    this.elapsedSeconds = 0;
    this.frameCount = 0;
    this.pointerEvents = 0;
    this.lastPointer = null;
    this.scene = new MicrobeFixtureScene();
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

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.lastTime = performance.now() / 1000;
    this.fpsAccumulator = 0;
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
      this.pointerEvents++;
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
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
      lastPointer: this.lastPointer
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

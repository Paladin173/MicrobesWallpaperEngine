class WallpaperApp {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.microbes = [];
    this.paused = false;
    this.lastFrameTime = 0;
    this.frameTime = 1000 / window.wallpaperSettings.fps;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    this.initMicrobes();
    this.run();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initMicrobes() {
    this.microbes = [];
    const count = Math.max(10, Math.min(500, window.wallpaperSettings.density));
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      this.microbes.push(new Microbe(x, y));
    }
  }

  run() {
    const now = performance.now();
    const delta = now - this.lastFrameTime;

    if (delta >= this.frameTime) {
      this.update();
      this.draw();
      this.lastFrameTime = now;
    }

    requestAnimationFrame(() => this.run());
  }

  update() {
    if (this.paused) return;

    const settings = window.wallpaperSettings;
    
    // Check if density changed and adjust microbe count
    const targetCount = Math.max(10, Math.min(500, settings.density));
    if (this.microbes.length < targetCount) {
      for (let i = this.microbes.length; i < targetCount; i++) {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        this.microbes.push(new Microbe(x, y));
      }
    } else if (this.microbes.length > targetCount) {
      this.microbes.splice(targetCount);
    }

    this.microbes.forEach(m => m.update(this.canvas.width, this.canvas.height, settings.speed));
  }

  draw() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const color = window.wallpaperSettings.color;
    this.microbes.forEach(m => m.draw(this.ctx, color));
  }
}

window.addEventListener('load', () => {
  window.app = new WallpaperApp();
});

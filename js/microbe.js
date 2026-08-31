class Microbe {
  constructor(x, y, radius = 3) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
  }

  update(width, height, speed) {
    this.x += this.vx * speed;
    this.y += this.vy * speed;

    // Bounce off edges
    if (this.x - this.radius < 0 || this.x + this.radius > width) {
      this.vx *= -1;
      this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
    }
    if (this.y - this.radius < 0 || this.y + this.radius > height) {
      this.vy *= -1;
      this.y = Math.max(this.radius, Math.min(height - this.radius, this.y));
    }

    // Random direction change
    if (Math.random() < 0.01) {
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 2;
    }
  }

  draw(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

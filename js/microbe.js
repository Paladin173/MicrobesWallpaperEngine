class MicrobeFixtureScene {
  constructor() {
    const fixture = window.microbeReferenceFixture;
    this.decorations = MicrobeFixtureScene.expandTriples(fixture.decorations, 60);
    this.corpses = MicrobeFixtureScene.decode(fixture.corpses, 31 * 4);
    this.food = MicrobeFixtureScene.expandTriples(fixture.food, 50);
    this.microbes = MicrobeFixtureScene.decode(fixture.microbes, 30 * 8);
  }

  static decode(encoded, expectedLength) {
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const values = new Float32Array(bytes.byteLength / 4);
    for (let index = 0; index < values.length; index++) {
      values[index] = view.getFloat32(index * 4, true);
    }
    if (values.length !== expectedLength) {
      throw new Error(`Reference fixture has ${values.length} values; expected ${expectedLength}.`);
    }
    return values;
  }

  static expandTriples(encoded, count) {
    const source = MicrobeFixtureScene.decode(encoded, count * 3);
    const values = new Float32Array(count * 4);
    for (let index = 0; index < count; index++) {
      values.set(source.subarray(index * 3, index * 3 + 3), index * 4);
      values[index * 4 + 3] = 1;
    }
    return values;
  }
}
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

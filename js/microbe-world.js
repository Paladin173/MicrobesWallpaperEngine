class JavaRandom {
  static MULTIPLIER = 0x5deece66dn;
  static ADDEND = 0xbn;
  static MASK = (1n << 48n) - 1n;

  constructor(seed) {
    this.seed = (BigInt(Math.trunc(seed)) ^ JavaRandom.MULTIPLIER) & JavaRandom.MASK;
  }

  next(bits) {
    this.seed = (this.seed * JavaRandom.MULTIPLIER + JavaRandom.ADDEND) & JavaRandom.MASK;
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextFloat() {
    return this.next(24) / 16777216;
  }

  nextInt(bound) {
    if (bound <= 0) throw new Error('Random bound must be positive.');
    if ((bound & (bound - 1)) === 0) return Math.floor((bound * this.next(31)) / 2147483648);
    return this.next(31) % bound;
  }
}

class MicrobeWorld {
  static MAX_COUNT = 300;
  static INITIAL_COUNT = 30;
  static FOOD_CAPACITY = 600;
  static CORPSE_CAPACITY = 80;
  static DECORATION_CAPACITY = 60;
  static MOTION_CAPACITY = 15;
  static INVALID = -10;
  static TYPES = [
    [0.83203125, 0.19531, 0.14453, 0.68],
    [0.9296875, 0.6953125, 0.066406, 0.68],
    [0.05078125, 0.5976525, 0.22266, 0.68],
    [0.19921875, 0.41015625, 0.90625, 0.68]
  ];

  constructor(seed = Date.now(), ambientFoodEnabled = true) {
    this.random = new JavaRandom(seed);
    this.ambientFoodEnabled = ambientFoodEnabled;
    this.decorationsEnabled = true;
    this.movementScale = 0.6;
    this.lifecycleScale = 1;
    this.minimumPopulation = MicrobeWorld.INITIAL_COUNT;
    this.elapsedSeconds = 0;
    this.foodRespawnTimer = 0;
    this.activeCount = 0;
    this.activeFoodCount = 0;
    this.activeCorpseCount = 0;
    this.consumedFoodCount = 0;
    this.reproductionCount = 0;
    this.deathCount = 0;

    this.microbeSlots = Array.from({ length: MicrobeWorld.MAX_COUNT }, () => ({
      active: false,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      angle: 0,
      phase: this.random.nextFloat(),
      typeScale: 0.68,
      energy: 0,
      breed: 0.7,
      pulseTime: -10,
      red: 0,
      green: 0,
      blue: 0,
      type: 0
    }));
    this.corpseSlots = Array.from({ length: MicrobeWorld.CORPSE_CAPACITY }, () => ({
      active: false,
      x: 0,
      y: 0,
      startY: 0,
      angle: 0,
      size: 0
    }));
    this.foodX = new Float32Array(MicrobeWorld.FOOD_CAPACITY);
    this.foodY = new Float32Array(MicrobeWorld.FOOD_CAPACITY);
    this.foodPhase = new Float32Array(MicrobeWorld.FOOD_CAPACITY);
    this.motionX = new Float32Array(MicrobeWorld.MOTION_CAPACITY);
    this.motionY = new Float32Array(MicrobeWorld.MOTION_CAPACITY);
    this.motionExpiry = new Float32Array(MicrobeWorld.MOTION_CAPACITY);
    this.decorationX = new Float32Array(MicrobeWorld.DECORATION_CAPACITY);
    this.decorationY = new Float32Array(MicrobeWorld.DECORATION_CAPACITY);
    this.decorationDepth = new Float32Array(MicrobeWorld.DECORATION_CAPACITY);
    this.microbes = new Float32Array(MicrobeWorld.MAX_COUNT * 8);
    this.food = new Float32Array(MicrobeWorld.FOOD_CAPACITY * 4);
    this.corpses = new Float32Array(MicrobeWorld.CORPSE_CAPACITY * 4);
    this.decorations = new Float32Array(MicrobeWorld.DECORATION_CAPACITY * 4);
    this.microbeCount = 0;
    this.foodCount = 0;
    this.corpseCount = 0;
    this.decorationCount = MicrobeWorld.DECORATION_CAPACITY;

    this.foodX.fill(MicrobeWorld.INVALID);
    for (let index = 0; index < MicrobeWorld.FOOD_CAPACITY; index++) {
      this.foodPhase[index] = this.random.nextFloat();
    }
    for (let index = 0; index < MicrobeWorld.INITIAL_COUNT; index++) {
      this.activateMicrobe(index, this.random.nextFloat(), this.random.nextFloat());
    }
    if (this.ambientFoodEnabled) {
      for (let index = 0; index < 50; index++) {
        this.placeFood(this.random.nextFloat(), this.random.nextFloat());
      }
    }
    for (let index = 0; index < MicrobeWorld.DECORATION_CAPACITY; index++) {
      this.decorationX[index] = this.random.nextFloat();
      this.decorationY[index] = this.random.nextFloat();
      this.decorationDepth[index] = this.random.nextFloat();
    }
    this.writeRenderData();
  }

  setMovementScale(value) {
    this.movementScale = MicrobeWorld.clamp(Number(value), 0.25, 1.5);
  }

  setLifecycleScale(value) {
    this.lifecycleScale = MicrobeWorld.clamp(Number(value), 0.5, 2);
  }

  setAmbientFoodEnabled(enabled) {
    this.ambientFoodEnabled = Boolean(enabled);
  }

  setDecorationsEnabled(enabled) {
    this.decorationsEnabled = Boolean(enabled);
    this.writeDecorations();
  }

  setPopulationDensity(mode) {
    this.minimumPopulation = mode === 'low' ? 20 : mode === 'high' ? 45 : 30;
  }

  motion(x, y) {
    let slot = 0;
    for (let index = 0; index < MicrobeWorld.MOTION_CAPACITY; index++) {
      if (this.motionExpiry[index] <= this.elapsedSeconds) {
        slot = index;
        break;
      }
    }
    this.motionX[slot] = MicrobeWorld.clamp(x, 0, 1);
    this.motionY[slot] = MicrobeWorld.clamp(y, 0, 1);
    this.motionExpiry[slot] = this.elapsedSeconds + 0.5;
  }

  feed(x, y) {
    for (let index = 0; index < 5; index++) {
      const foodX = x + (this.random.nextFloat() * 2 - 1) * 0.044;
      const foodY = y + (this.random.nextFloat() * 2 - 1) * 0.044;
      if (!this.placeFood(
        MicrobeWorld.clamp(foodX, 0, 1),
        MicrobeWorld.clamp(foodY, 0, 1)
      )) break;
    }
    this.motion(x, y);
    this.writeFood();
  }

  update(deltaSeconds) {
    const delta = Math.min(0.05, Math.max(0, deltaSeconds));
    this.elapsedSeconds += delta;
    const lifeDelta = delta * this.lifecycleScale;
    this.updateWandering();
    this.avoidNeighbors();
    this.chaseAndEatFood();
    this.followTouchMotion();
    this.integrateMicrobes(delta, lifeDelta);
    this.updateFood(delta);
    this.updateCorpses(lifeDelta);
    this.updateLifecycle();
    this.writeRenderData();
  }

  updateWandering() {
    for (const microbe of this.microbeSlots) {
      if (!microbe.active) continue;
      let boundaryX = MicrobeWorld.boundaryForce(microbe.x);
      const boundaryY = MicrobeWorld.boundaryForce(microbe.y);
      const turn = Math.cos(this.elapsedSeconds * 0.3 + microbe.phase * 30) * 0.01
        + Math.cos(this.elapsedSeconds + microbe.phase * 30) * 0.03;
      microbe.angle += turn;
      boundaryX += 0;
      microbe.velocityX = (boundaryX + Math.cos(microbe.angle) * 0.025) * this.movementScale;
      microbe.velocityY = (boundaryY + Math.sin(microbe.angle) * 0.025) * this.movementScale;
    }
  }

  avoidNeighbors() {
    const limit = 0.038 * 0.038;
    for (let first = 0; first < MicrobeWorld.MAX_COUNT; first++) {
      const a = this.microbeSlots[first];
      if (!a.active) continue;
      let neighbors = 0;
      for (let second = first + 1; second < MicrobeWorld.MAX_COUNT && neighbors < 4; second++) {
        const b = this.microbeSlots[second];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= 0.000001 || distanceSquared >= limit) continue;
        const distance = Math.sqrt(distanceSquared);
        const push = (0.038 - distance) * 0.8 * this.movementScale;
        const pushX = dx / distance * push;
        const pushY = dy / distance * push;
        a.velocityX -= pushX;
        a.velocityY -= pushY;
        b.velocityX += pushX;
        b.velocityY += pushY;
        neighbors++;
      }
    }
  }

  chaseAndEatFood() {
    for (const microbe of this.microbeSlots) {
      if (!microbe.active || microbe.energy > 1) continue;
      let nearby = 0;
      for (let food = 0; food < MicrobeWorld.FOOD_CAPACITY && nearby < 4; food++) {
        if (this.foodX[food] === MicrobeWorld.INVALID) continue;
        const dx = this.foodX[food] - microbe.x;
        const dy = this.foodY[food] - microbe.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= 0.01) continue;
        nearby++;
        if (distanceSquared <= 0.000196) {
          microbe.energy = Math.min(1.2, microbe.energy + (microbe.energy <= 0.25 ? 0.375 : 0.125));
          this.removeFood(food);
          this.consumedFoodCount++;
          microbe.pulseTime = this.elapsedSeconds;
          continue;
        }
        const distance = Math.sqrt(Math.max(distanceSquared, 0.000001));
        const attraction = distance < 0.025 ? 0.055 : distance < 0.05 ? 0.025 : 0.008;
        microbe.velocityX += dx / distance * attraction * this.movementScale;
        microbe.velocityY += dy / distance * attraction * this.movementScale;
      }
    }
  }

  followTouchMotion() {
    for (const microbe of this.microbeSlots) {
      if (!microbe.active) continue;
      for (let motion = 0; motion < MicrobeWorld.MOTION_CAPACITY; motion++) {
        if (this.motionExpiry[motion] <= this.elapsedSeconds) continue;
        const dx = this.motionX[motion] - microbe.x;
        const dy = this.motionY[motion] - microbe.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= 0.000001 || distanceSquared >= 0.01) continue;
        const distance = Math.sqrt(distanceSquared);
        const attraction = distance < 0.025 ? 0.08 : distance < 0.05 ? 0.045 : 0.018;
        microbe.velocityX += dx / distance * attraction * this.movementScale;
        microbe.velocityY += dy / distance * attraction * this.movementScale;
      }
    }
  }

  integrateMicrobes(delta, lifeDelta) {
    for (const microbe of this.microbeSlots) {
      if (!microbe.active) continue;
      let speed = Math.hypot(microbe.velocityX, microbe.velocityY);
      const maximumSpeed = 0.1 * this.movementScale;
      if (speed > maximumSpeed) {
        microbe.velocityX *= maximumSpeed / speed;
        microbe.velocityY *= maximumSpeed / speed;
        speed = maximumSpeed;
      }
      microbe.x = MicrobeWorld.clamp(microbe.x + microbe.velocityX * delta, 0, 1);
      microbe.y = MicrobeWorld.clamp(microbe.y + microbe.velocityY * delta, 0, 1);
      if (speed > 0.0001) microbe.angle = Math.atan2(microbe.velocityY, microbe.velocityX);
      microbe.energy -= 0.0125 * lifeDelta;
      if (microbe.energy > 0.75) {
        microbe.energy -= 0.025 * lifeDelta;
        microbe.breed += 0.02 * lifeDelta;
      }
    }
  }

  updateFood(delta) {
    for (let index = 0; index < MicrobeWorld.FOOD_CAPACITY; index++) {
      if (this.foodX[index] === MicrobeWorld.INVALID) continue;
      const phase = this.foodPhase[index];
      const noise = this.elapsedSeconds + phase * 1000;
      const direction = Math.sin(noise * 0.1) + noise * (phase - 0.5)
        + Math.sin(phase + noise * 0.01);
      this.foodX[index] = MicrobeWorld.clamp(
        this.foodX[index] + Math.cos(direction) * delta * 0.004,
        0,
        1
      );
      this.foodY[index] = MicrobeWorld.clamp(
        this.foodY[index] + Math.sin(direction) * delta * 0.004,
        0,
        1
      );
    }
    this.foodRespawnTimer += delta * this.lifecycleScale;
    if (!this.ambientFoodEnabled) return;
    while (this.foodRespawnTimer >= 0.2) {
      this.foodRespawnTimer -= 0.2;
      if (!this.placeFood(this.random.nextFloat(), this.random.nextFloat())) break;
    }
  }

  updateCorpses(delta) {
    for (const corpse of this.corpseSlots) {
      if (!corpse.active) continue;
      corpse.y += 10 / 800 * delta;
      if (corpse.y > 1.15) {
        corpse.active = false;
        this.activeCorpseCount--;
      }
    }
  }

  updateLifecycle() {
    for (const microbe of this.microbeSlots) {
      if (!microbe.active) continue;
      if (microbe.breed >= 1.2) {
        const child = this.findInactiveMicrobe();
        if (child) this.reproduce(microbe, child);
      }
      if (microbe.energy < 0) {
        this.createCorpse(microbe);
        microbe.active = false;
        this.activeCount--;
        this.deathCount++;
      }
    }
    while (this.activeCount < this.minimumPopulation) {
      const replacement = this.findInactiveMicrobe();
      if (!replacement) break;
      this.activateMicrobeSlot(replacement, this.random.nextFloat(), this.random.nextFloat());
    }
  }

  createCorpse(microbe) {
    let corpse = null;
    for (const candidate of this.corpseSlots) {
      if (!candidate.active) {
        corpse = candidate;
        break;
      }
      if (!corpse || candidate.y > corpse.y) corpse = candidate;
    }
    if (!corpse.active) this.activeCorpseCount++;
    corpse.active = true;
    corpse.x = microbe.x;
    corpse.y = microbe.y;
    corpse.startY = microbe.y;
    corpse.angle = microbe.angle;
    corpse.size = 30 * microbe.typeScale * MicrobeWorld.growthScale(microbe);
  }

  reproduce(parent, child) {
    const offsetX = Math.cos(parent.angle) * 0.003;
    const offsetY = Math.sin(parent.angle) * 0.003;
    child.active = true;
    child.x = MicrobeWorld.clamp(parent.x - offsetX, 0, 1);
    child.y = MicrobeWorld.clamp(parent.y - offsetY, 0, 1);
    child.angle = parent.angle + Math.PI;
    child.phase = this.random.nextFloat();
    child.energy = this.birthEnergy();
    child.breed = 0.7;
    child.type = parent.type;
    child.typeScale = parent.typeScale;
    child.red = parent.red;
    child.green = parent.green;
    child.blue = parent.blue;
    parent.x = MicrobeWorld.clamp(parent.x + offsetX, 0, 1);
    parent.y = MicrobeWorld.clamp(parent.y + offsetY, 0, 1);
    parent.breed = 0.7;
    this.activeCount++;
    this.reproductionCount++;
  }

  activateMicrobe(index, x, y) {
    this.activateMicrobeSlot(this.microbeSlots[index], x, y);
  }

  activateMicrobeSlot(microbe, x, y) {
    if (!microbe.active) this.activeCount++;
    microbe.active = true;
    microbe.x = x;
    microbe.y = y;
    microbe.velocityX = 0;
    microbe.velocityY = 0;
    microbe.angle = this.random.nextFloat() * Math.PI * 2;
    microbe.phase = this.random.nextFloat();
    microbe.energy = this.birthEnergy();
    microbe.breed = 0.7;
    microbe.pulseTime = -10;
    const type = this.random.nextInt(MicrobeWorld.TYPES.length);
    const values = MicrobeWorld.TYPES[type];
    microbe.type = type;
    microbe.red = values[0];
    microbe.green = values[1];
    microbe.blue = values[2];
    microbe.typeScale = values[3];
  }

  placeFood(x, y) {
    for (let index = 0; index < MicrobeWorld.FOOD_CAPACITY; index++) {
      if (this.foodX[index] !== MicrobeWorld.INVALID) continue;
      this.foodX[index] = x;
      this.foodY[index] = y;
      this.activeFoodCount++;
      return true;
    }
    return false;
  }

  removeFood(index) {
    this.foodX[index] = MicrobeWorld.INVALID;
    this.activeFoodCount--;
  }

  findInactiveMicrobe() {
    return this.microbeSlots.find(microbe => !microbe.active) || null;
  }

  birthEnergy() {
    return 0.5 + this.random.nextFloat() * 0.2;
  }

  writeRenderData() {
    this.writeDecorations();
    this.writeCorpses();
    this.writeFood();
    this.writeMicrobes();
  }

  writeDecorations() {
    this.decorationCount = this.decorationsEnabled ? MicrobeWorld.DECORATION_CAPACITY : 0;
    for (let index = 0; index < this.decorationCount; index++) {
      const offset = index * 4;
      this.decorations[offset] = this.decorationX[index] * 2 - 1;
      this.decorations[offset + 1] = 1 - this.decorationY[index] * 2;
      this.decorations[offset + 2] = this.decorationDepth[index];
      this.decorations[offset + 3] = 1;
    }
  }

  writeCorpses() {
    let rendered = 0;
    for (const corpse of this.corpseSlots) {
      if (!corpse.active) continue;
      const offset = rendered * 4;
      const sinkProgress = MicrobeWorld.clamp(
        (corpse.y - corpse.startY) / Math.max(0.001, 1.15 - corpse.startY),
        0,
        1
      );
      this.corpses[offset] = corpse.x * 2 - 1;
      this.corpses[offset + 1] = 1 - corpse.y * 2;
      this.corpses[offset + 2] = -corpse.angle;
      this.corpses[offset + 3] = corpse.size * (0.72 - sinkProgress * 0.22);
      rendered++;
    }
    this.corpseCount = rendered;
  }

  writeFood() {
    let rendered = 0;
    for (let index = 0; index < MicrobeWorld.FOOD_CAPACITY; index++) {
      if (this.foodX[index] === MicrobeWorld.INVALID) continue;
      const offset = rendered * 4;
      this.food[offset] = this.foodX[index] * 2 - 1;
      this.food[offset + 1] = 1 - this.foodY[index] * 2;
      this.food[offset + 2] = this.foodPhase[index];
      this.food[offset + 3] = 1;
      rendered++;
    }
    this.foodCount = rendered;
  }

  writeMicrobes() {
    let rendered = 0;
    for (const microbe of this.microbeSlots) {
      if (!microbe.active) continue;
      const offset = rendered * 8;
      const pulseAge = this.elapsedSeconds - microbe.pulseTime;
      const pulse = pulseAge >= 0 && pulseAge < 1
        ? Math.min(pulseAge * 2, (1 - pulseAge) * 0.5)
        : 0;
      this.microbes[offset] = microbe.x * 2 - 1;
      this.microbes[offset + 1] = 1 - microbe.y * 2;
      this.microbes[offset + 2] = -microbe.angle;
      this.microbes[offset + 3] = 30 * microbe.typeScale * MicrobeWorld.growthScale(microbe);
      this.microbes[offset + 4] = Math.min(1, microbe.red * 1.1 + pulse);
      this.microbes[offset + 5] = Math.min(1, microbe.green * 1.1 + pulse);
      this.microbes[offset + 6] = Math.min(1, microbe.blue * 1.1 + pulse);
      this.microbes[offset + 7] = MicrobeWorld.clamp(microbe.energy, 0, 1);
      rendered++;
    }
    this.microbeCount = rendered;
  }

  getDiagnostics() {
    return {
      activeCount: this.activeCount,
      foodCount: this.activeFoodCount,
      corpseCount: this.activeCorpseCount,
      consumedFoodCount: this.consumedFoodCount,
      reproductionCount: this.reproductionCount,
      deathCount: this.deathCount
    };
  }

  static growthScale(microbe) {
    const progress = MicrobeWorld.clamp((microbe.breed - 0.7) / 0.5, 0, 1);
    return 0.55 + progress * 0.75;
  }

  static boundaryForce(position) {
    if (position < 0.1) return (0.1 - position) * 0.1;
    if (position > 0.9) return (0.9 - position) * 0.1;
    return 0;
  }

  static clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
}
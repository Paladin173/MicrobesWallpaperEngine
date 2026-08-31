const { expect, test } = require('@playwright/test');

async function openWallpaper(page, width = 1280, height = 720) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.waitForFunction(() => window.app?.getDiagnostics().frameCount > 0);
}

async function countLayerPixels(page, layer) {
  return page.evaluate(name => {
    const renderer = window.app.renderer;
    const gl = renderer.gl;
    renderer.setVisibleLayers([name]);
    renderer.draw(1);
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] > 0 || pixels[index + 1] > 0 || pixels[index + 2] > 4) count++;
    }
    return count;
  }, layer);
}

test('uses Wallpaper Engine native project property schema', async ({ request }) => {
  const response = await request.get('/project.json');
  expect(response.ok()).toBe(true);
  const project = await response.json();
  expect(project.file).toBe('index.html');
  expect(project.type).toBe('web');
  expect(Array.isArray(project.general.properties)).toBe(false);
  expect(project.general.properties.renderquality).toMatchObject({
    text: 'Render Quality',
    type: 'combo',
    value: 'auto'
  });
  expect(project.general.properties.renderquality.options).toHaveLength(4);
  expect(project.general.properties.interaction).toMatchObject({
    text: 'Interaction',
    type: 'bool',
    value: true
  });
  expect(project.general.properties.movementspeed.type).toBe('slider');
  expect(project.general.properties.population.options).toHaveLength(3);
});

test('renders every active ecosystem layer without WebGL errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openWallpaper(page);

  const minimumPixels = {
    decoration: 1000,
    food: 20,
    microbe: 100
  };
  for (const [layer, minimum] of Object.entries(minimumPixels)) {
    expect(await countLayerPixels(page, layer), layer).toBeGreaterThan(minimum);
  }

  const state = await page.evaluate(() => {
    const gl = window.app.renderer.gl;
    return {
      diagnostics: window.app.getDiagnostics(),
      blendEnabled: gl.isEnabled(gl.BLEND),
      blendSource: gl.getParameter(gl.BLEND_SRC_RGB),
      blendDestination: gl.getParameter(gl.BLEND_DST_RGB),
      sourceAlpha: gl.SRC_ALPHA,
      one: gl.ONE
    };
  });
  const diagnostics = state.diagnostics;
  expect(diagnostics.glError).toBe(0);
  expect(diagnostics.layerCounts).toEqual({
    decoration: 60,
    corpse: 0,
    food: diagnostics.ecosystem.foodCount,
    microbe: 30
  });
  expect(state.blendEnabled).toBe(true);
  expect(state.blendSource).toBe(state.sourceAlpha);
  expect(state.blendDestination).toBe(state.one);
  expect(pageErrors).toEqual([]);
});

test('advances microbe positions with fixed simulation steps', async ({ page }) => {
  await openWallpaper(page);
  const result = await page.evaluate(() => {
    const beforeX = window.app.scene.microbes[0];
    const beforeY = window.app.scene.microbes[1];
    for (let step = 0; step < 60; step++) window.app.scene.update(1 / 60);
    window.app.renderer.draw(1);
    return {
      beforeX,
      beforeY,
      afterX: window.app.scene.microbes[0],
      afterY: window.app.scene.microbes[1],
      glError: window.app.renderer.gl.getError()
    };
  });
  expect(Math.hypot(result.afterX - result.beforeX, result.afterY - result.beforeY))
    .toBeGreaterThan(0.02);
  expect(result.glError).toBe(0);
});

test('feeds microbes and advances death into the corpse lifecycle', async ({ page }) => {
  await openWallpaper(page, 800, 600);
  await page.evaluate(() => window.app.setPaused(true));
  const beforeFood = await page.evaluate(() => window.app.scene.activeFoodCount);
  await page.mouse.click(400, 300);
  const afterFeed = await page.evaluate(() => window.app.scene.activeFoodCount);
  expect(afterFeed).toBe(beforeFood + 5);

  const lifecycle = await page.evaluate(() => {
    const world = window.app.scene;
    world.minimumPopulation = 0;
    world.microbeSlots[0].energy = -1;
    world.update(1 / 60);
    window.app.renderer.draw(1);
    return {
      diagnostics: world.getDiagnostics(),
      glError: window.app.renderer.gl.getError()
    };
  });
  expect(lifecycle.diagnostics.deathCount).toBe(1);
  expect(lifecycle.diagnostics.corpseCount).toBe(1);
  expect(lifecycle.diagnostics.activeCount).toBe(29);
  expect(lifecycle.glError).toBe(0);
});

test('reproduces mature microbes and attracts them to pointer motion', async ({ page }) => {
  await openWallpaper(page, 800, 600);
  await page.evaluate(() => window.app.setPaused(true));
  await page.mouse.move(600, 150);
  const result = await page.evaluate(() => {
    const world = window.app.scene;
    const parent = world.microbeSlots[0];
    parent.energy = 1;
    parent.breed = 1.2;
    world.update(1 / 60);
    return {
      diagnostics: world.getDiagnostics(),
      activeMotionCount: Array.from(world.motionExpiry)
        .filter(expiry => expiry > world.elapsedSeconds).length
    };
  });
  expect(result.diagnostics.reproductionCount).toBe(1);
  expect(result.diagnostics.activeCount).toBe(31);
  expect(result.activeMotionCount).toBeGreaterThan(0);
});

test('bounds saturated lifecycle and renderer counts to allocated capacity', async ({ page }) => {
  await openWallpaper(page);
  const result = await page.evaluate(() => {
    const world = window.app.scene;
    const source = world.microbeSlots[0];
    for (let index = 0; index < 100; index++) world.createCorpse(source);
    world.writeCorpses();
    world.corpseCount = 1000;
    window.app.renderer.draw(1);
    return {
      activeCorpses: world.activeCorpseCount,
      renderedCorpses: window.app.renderer.layers.corpse.count,
      corpseCapacity: world.corpseSlots.length,
      glError: window.app.renderer.gl.getError()
    };
  });
  expect(result.activeCorpses).toBe(result.corpseCapacity);
  expect(result.renderedCorpses).toBe(result.corpseCapacity);
  expect(result.glError).toBe(0);
});

test('applies live FPS limits and stops drawing while paused', async ({ page }) => {
  await openWallpaper(page);
  await page.evaluate(() => window.wallpaperPropertyListener.applyGeneralProperties({ fps: 10 }));
  const start = await page.evaluate(() => window.app.frameCount);
  const startTime = await page.evaluate(() => window.app.elapsedSeconds);
  await page.waitForTimeout(450);
  const limited = await page.evaluate(() => window.app.frameCount);
  expect(limited - start).toBeGreaterThanOrEqual(3);
  expect(limited - start).toBeLessThanOrEqual(6);
  expect(await page.evaluate(() => window.app.elapsedSeconds) - startTime).toBeGreaterThan(0.35);

  await page.evaluate(() => window.wallpaperPropertyListener.setPaused(true));
  const paused = await page.evaluate(() => window.app.frameCount);
  const pausedWorldTime = await page.evaluate(() => window.app.scene.elapsedSeconds);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.app.frameCount)).toBe(paused);
  expect(await page.evaluate(() => window.app.scene.elapsedSeconds)).toBe(pausedWorldTime);

  await page.evaluate(() => window.wallpaperPropertyListener.setPaused(false));
  await page.waitForTimeout(250);
  const resumed = await page.evaluate(() => window.app.frameCount);
  expect(resumed - paused).toBeGreaterThanOrEqual(1);
  expect(resumed - paused).toBeLessThanOrEqual(3);
});

test('normalizes pointer input and honors the interaction setting', async ({ page }) => {
  await openWallpaper(page, 800, 600);
  await page.mouse.click(200, 450);
  const active = await page.evaluate(() => window.app.getDiagnostics());
  expect(active.pointerEvents).toBeGreaterThanOrEqual(2);
  expect(active.lastPointer.x).toBeCloseTo(0.25, 2);
  expect(active.lastPointer.y).toBeCloseTo(0.75, 2);

  await page.evaluate(() => window.wallpaperPropertyListener.applyUserProperties({
    interaction: { value: false }
  }));
  const disabledCount = await page.evaluate(() => window.app.pointerEvents);
  await page.mouse.click(600, 150);
  expect(await page.evaluate(() => window.app.pointerEvents)).toBe(disabledCount);
});

test('scales every target viewport within the Auto pixel budget', async ({ page }) => {
  await openWallpaper(page);
  const viewports = [
    { width: 2560, height: 1080 },
    { width: 3440, height: 1440 },
    { width: 5120, height: 1440 },
    { width: 10240, height: 1440 }
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const diagnostics = await page.evaluate(() => {
      window.app.renderer.resize();
      window.app.renderer.draw(1);
      return window.app.getDiagnostics();
    });
    const pixels = diagnostics.drawingBufferWidth * diagnostics.drawingBufferHeight;
    expect(pixels, `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(8294400);
    expect(diagnostics.glError).toBe(0);
  }
});

test('maps pointer edges and center across a spanned viewport', async ({ page }) => {
  await openWallpaper(page, 10240, 1440);
  for (const [screenX, worldX] of [[1, 0], [5120, 0.5], [10239, 1]]) {
    await page.mouse.click(screenX, 720);
    const pointer = await page.evaluate(() => window.app.lastPointer);
    expect(pointer.x).toBeCloseTo(worldX, 3);
    expect(pointer.y).toBeCloseTo(0.5, 3);
  }
});

test('restores WebGL resources without replacing scene state', async ({ page }) => {
  await openWallpaper(page);
  const supported = await page.evaluate(() => {
    const extension = window.app.renderer.gl.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    window.testContextExtension = extension;
    window.app.scene.testMarker = 'preserved';
    extension.loseContext();
    return true;
  });
  test.skip(!supported, 'WEBGL_lose_context is unavailable');

  await page.waitForFunction(() => window.app.renderer.contextLost);
  await page.evaluate(() => {
    window.testContextExtension.restoreContext();
  });
  await page.waitForFunction(() => !window.app.renderer.contextLost);
  const result = await page.evaluate(() => {
    window.app.renderer.draw(2);
    return {
      marker: window.app.scene.testMarker,
      diagnostics: window.app.getDiagnostics()
    };
  });
  expect(result.marker).toBe('preserved');
  expect(result.diagnostics.glError).toBe(0);
  expect(result.diagnostics.layerCounts.microbe).toBe(30);
});
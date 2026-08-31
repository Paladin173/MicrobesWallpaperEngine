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
});

test('renders every fixture layer without WebGL errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openWallpaper(page);

  const minimumPixels = {
    decoration: 1000,
    corpse: 20,
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
    corpse: 31,
    food: 50,
    microbe: 30
  });
  expect(state.blendEnabled).toBe(true);
  expect(state.blendSource).toBe(state.sourceAlpha);
  expect(state.blendDestination).toBe(state.one);
  expect(pageErrors).toEqual([]);
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
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.app.frameCount)).toBe(paused);

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
# Microbes Wallpaper Engine build plan

## Goal

Recreate the Android Microbes live wallpaper as an interactive Wallpaper Engine
web wallpaper. Preserve its visual identity and ecosystem mechanics while making
the renderer scale efficiently from one ordinary display to two ultrawide displays.

This is a real-time application, not a video, GIF, or pre-rendered loop. Pointer
input changes the running simulation: clicks deposit food and pointer movement
temporarily attracts nearby microbes.

## Technical direction

Use **WebGL 2** for production rendering and keep the project as a Wallpaper
Engine `web` wallpaper. Do not continue the current Canvas 2D renderer beyond a
temporary reference or debug view.

WebGL 2 is preferred because the original already uses four GPU-rendered layers
with additive blending. Instanced quads avoid implementation-dependent point-size
limits, preserve the procedural shader shapes, and batch each layer into one draw
call. The simulation remains on the CPU because its upper entity count is modest
and its branching lifecycle behavior is easier to test in JavaScript.

No runtime network access or external CDN dependencies should be required. Bundle
all code and assets in the wallpaper project.

## Host decision and portability

Continue with Wallpaper Engine for the first complete ecosystem. Live testing on
the target PC rendered an 8192x1152 WebGL stress surface at approximately 0.3% GPU
and below 1% process CPU, so a native Windows host would currently add complexity
without addressing a measured problem. Wallpaper Engine also already owns startup,
desktop placement, monitor profiles, fullscreen pausing, and user settings.

Keep the simulation, renderer, input adapter, and Wallpaper Engine property bridge
as separate modules. If the completed ecosystem exposes a host limitation, the same
HTML/WebGL application can be hosted in a small WebView2 Windows application before
considering a renderer rewrite. A personal Windows host would be acceptable even if
it relies on Windows-specific desktop-window integration, but that integration must
be treated as a separately tested lifecycle component.

Switch hosts only if one of these gates fails in the real interactive build:

- Wallpaper Engine does not reliably deliver pointer, pause/resume, or property
  events to the assigned desktop wallpaper.
- Its actual grouped-monitor mode cannot provide either two stable independent
  instances or one correctly sized continuous viewport.
- The web runtime resets or loses ecosystem state during ordinary display reconnect,
  sleep/wake, profile changes, or context restoration.
- Measured CPU, GPU, memory, or frame pacing exceeds the milestone 4 budget after
  renderer and simulation profiling.

Do not build and maintain both hosts speculatively. Keep the portable core and make
the host decision from owning-runtime evidence after milestone 2 interaction tests.

## External browser reference

`https://microbes.roilipman.com/` is useful as an interaction and motion reference,
but not as a code source. As inspected on 2026-08-31, it ships an approximately
879 KB monolithic, older Three.js bundle with no application source link, source
map, or explicit application license on the page. Do not copy its implementation.

Its independently reusable design ideas are noise-driven wandering, a brief speed
boost after interaction, health-based maturation, and a short feeding-brightness
pulse. The Android reference already provides the authoritative lifecycle and pulse
behavior. Evaluate a subtle seeded-noise contribution only after parity, and only
if it improves natural motion without changing deterministic ecosystem outcomes.

Do not adopt the external project's per-entity Three.js vectors, meshes, textures,
timeouts, or tweens. They add allocation, draw-call, dependency, and lifecycle cost
that conflicts with continuous dual-ultrawide operation. Keep the typed-array CPU
simulation and four instanced GPU batches described below.

## Current implementation status

As of 2026-08-31, the original Canvas prototype has been replaced by the WebGL 2
vertical slice and is ready for live Wallpaper Engine validation. Fixture
buffers were exported directly from `MicrobeWorld` seed 123: decoration, food, and
microbe data are from the initial state at a 1280x720 viewport with render sizes
normalized to an 800-pixel height; corpse data is from the same seed after a
60-second, 2x-lifecycle starvation run. Browser gates are automated, but Android
screenshot comparison and target-PC GPU measurements remain pending live evidence.

## Source behavior to preserve

The Android implementation in `MicrobesLiveWallpaper` is the behavioral and
visual reference:

- Start with 30 live microbes and 50 food particles.
- Support up to 300 microbes, 600 food particles, 80 corpses, 60 fog decorations,
  and 15 short-lived pointer attractors.
- Use the decoded four-type red, yellow, green, and blue palette.
- Wander with soft boundary steering, avoid nearby microbes, seek and consume
  nearby food, and follow recent pointer motion.
- Spend energy over time. Well-fed microbes grow, split into small offspring, and
  pulse when feeding. Starved microbes die and leave slowly sinking remains.
- Maintain at least the initial population by spawning replacements.
- Drift and pulse food, replenish ambient food, and render a subtle fog layer.
- Clicks scatter five food particles. Pointer movement creates a 0.5-second local
  attraction. Support concurrent pointers where the browser supplies them.
- Preserve the original movement-speed, lifecycle-speed, and background-fog
  settings and their clamped ranges.

The draw order remains fog, corpses, food, then live microbes over the near-black
background. All four layers use source-alpha additive blending.

## Architecture

### Simulation

Create a renderer-independent `MicrobeWorld` module using preallocated typed
arrays and deterministic seeded random generation. Port the Android constants and
formulas directly before attempting any tuning.

Run simulation at a fixed 60 Hz step with an accumulator. Cap catch-up work after
resume or a long frame so the ecosystem does not jump forward or stall the
desktop. Rendering may run at a lower Wallpaper Engine FPS limit while simulation
steps remain stable.

Keep all coordinates in persistent normalized world space. Convert pointer and
render coordinates at the viewport boundary. Resizing must update projection only;
it must not recreate the ecosystem.

Apply an aspect-correct distance metric when evaluating neighbor, food, and pointer
radii so those regions remain visually circular on 21:9, 32:9, and spanned layouts.
Record this as an intentional desktop adaptation if it differs from Android's
normalized-coordinate results.

Begin with the reference neighbor and food loops for parity. If profiling shows
meaningful CPU cost near capacity, replace broad searches with a reusable uniform
spatial grid while retaining deterministic traversal order and regression tests.

### Rendering

Create one WebGL 2 context with alpha, antialiasing, depth, and stencil disabled.
Use four shader programs or a carefully measured shared program, one static unit
quad, dynamic per-instance buffers, and `drawArraysInstanced`:

1. Fog: drifting soft radial fields with depth-scaled size and opacity.
2. Corpses: rotated, shrinking, low-alpha shells.
3. Food: pale blue Gaussian motes with phase-offset pulsing.
4. Microbes: rotated tapered bodies whose width reflects energy, using the
   original shell/body formula, palette, growth, and feeding pulse.

Preallocate every CPU and GPU buffer to its maximum quality-tier capacity. Update
only active instance ranges with `bufferSubData`; allocate no objects in the frame
loop. Cache all locations and GL state during initialization.

Handle `webglcontextlost` by stopping updates and `webglcontextrestored` by
recreating GPU resources without resetting simulation state. Fail visibly in local
development if WebGL 2 is unavailable; optionally provide a reduced WebGL 1
fallback only after the primary version is complete.

### Wallpaper Engine integration

Register `window.wallpaperPropertyListener` before page load so the initial
property event cannot be missed. Implement:

- `applyGeneralProperties`: adopt Wallpaper Engine's current FPS value
  immediately, including changes made while the wallpaper is running.
- `applyUserProperties`: update only properties present in each event.
- `setPaused`: stop scheduling simulation/render work while paused and reset the
  timing accumulator before resuming.

Use `requestAnimationFrame` with Wallpaper Engine's FPS-threshold pattern. Do not
hard-code a second independent FPS cap.

Use Pointer Events on the canvas. Normalize coordinates from its current bounding
rectangle, track pointer-down positions by `pointerId`, attract on movement, feed
on release within the reference tap-distance threshold, and clear state on cancel.

## Dual-ultrawide strategy

Support both Wallpaper Engine arrangements as first-class modes:

- **Per-monitor or cloned wallpaper:** each monitor may host an independent web
  instance and ecosystem. The wallpaper must look complete and interactive in a
  single viewport without relying on cross-window state.
- **Spanned wallpaper:** one very wide viewport hosts one continuous ecosystem.
  Projection, pointer mapping, fog distribution, and population density must use
  the full virtual canvas with no center stretching or seam assumptions.

Do not use `devicePixelRatio` blindly. Add a render-scale quality property with
`Auto`, `100%`, `75%`, and `50%` choices. In Auto, cap the drawing-buffer pixel
count while CSS keeps the canvas full-screen. Start with these targets and tune
them from measured GPU time:

- High: native size, full capacities and fog.
- Balanced: 75% linear resolution, full ecosystem, reduced fog fill cost.
- Performance: 50% linear resolution, reduced fog count before reducing microbes.

Entity density should be based on visible world area relative to a reference
16:9 viewport, with explicit minimum and maximum limits. Keep biological rates
independent of resolution. A spanned pair should gain world area and population,
not enlarge every microbe or stretch one 16:9 scene across both screens.

Because Wallpaper Engine's exact instance and pointer behavior depends on the
selected multi-monitor layout, verify it in the application rather than inferring
it from a normal browser window. Shared state between separate monitor instances
is out of scope for the first release; independent ecosystems are deterministic,
robust, and require no unsupported cross-instance channel.

## User properties

Expose a restrained set of controls through `project.json`:

- Movement speed: 25-150%, default 60%.
- Lifecycle speed: 50-200%, default 100%.
- Ambient food: on by default.
- Background fog: on by default.
- Interaction: on by default.
- Population density: Low, Original, High; default Original.
- Render quality: Auto, High, Balanced, Performance; default Auto.
- Optional deterministic seed: off by default and intended for testing/screenshots.

Keep the original four-type palette as the default. Color customization should be
an optional later feature, not a replacement for visual parity.

## Milestones and acceptance gates

### 1. WebGL vertical slice

- Replace the Canvas 2D dot renderer with the WebGL 2 shell.
- Render fixed seeded samples of all four layers with instanced quads.
- Implement resize, pause/resume, live FPS changes, context restoration, and
  pointer-coordinate diagnostics.

Gate:

- The project loads without console or GL errors in a browser and Wallpaper Engine.
- Shader screenshots match the Android reference at a fixed viewport and seed.
- Changing Wallpaper Engine's FPS limit takes effect without reload.
- Development counters prove that simulation and render frame counts stop while
  paused and that resume does not execute unbounded catch-up steps.
- Test 2560x1080, 3440x1440, 5120x1440, and a two-monitor spanned viewport.

### 2. Deterministic ecosystem port

- Port entity capacities, palette, movement, feeding, energy, pulse, growth,
  reproduction, death, corpses, replacement, ambient food, and attractors.
- Port click, drag, cancel, and multi-pointer behavior.
- Preserve state through resize and render-quality changes.

Gate:

- Automated tests cover initial counts, palette, five-food clicks, consumption,
  food-dependent growth and reproduction, starvation and corpses, minimum
  population, settings clamps, deterministic replay, and resize persistence.
- Negative-control tests prove that reproduction does not occur without consumed
  food, interactions do nothing when disabled, and resize checks retain entity IDs
  and state rather than merely restoring the same counts.
- For fixed seeds and input scripts, browser checkpoints match the Java reference
  counts and positions within documented floating-point tolerances.

### 3. Visual parity

- Port the four Android shader formulas and draw order.
- Match background, additive blend behavior, relative sizes, pulse timing, fog,
  body taper, energy width, growth, and corpse sinking.
- Tune projection for standard, ultrawide, and spanned aspect ratios without
  changing simulation rates.

Gate:

- Capture fixed-seed screenshots from Android and Wallpaper Engine at equivalent
  timestamps and compare them side by side.
- Accept differences only when recorded as intentional desktop adaptations.
- Automated pixel probes confirm that each layer contributes visible non-background
  pixels, so a blank or omitted layer cannot pass a whole-frame screenshot check.
- No clipping, stretching, obvious monitor seam, elliptical interaction radius, or
  pointer offset at any target viewport. Verify pointer placement at the center,
  corners, monitor boundary, and extreme left/right edges in Wallpaper Engine.

### 4. Performance hardening

- Add per-frame CPU and GPU timing diagnostics available only in development.
- Tune Auto render scale and fog cost from measurements.
- Add a spatial grid only if simulation profiling justifies it.
- Verify zero steady-state JavaScript allocations and bounded catch-up after resume.

Gate:

- Profile one monitor, two independent ultrawide instances, and one spanned pair.
- Balanced mode sustains the configured 60 FPS when the desktop is visible on the
  target PC, with stable frame pacing and no unbounded memory growth.
- At 30 FPS, wallpaper load is materially lower than 60 FPS and follows Wallpaper
  Engine's configured limit.
- Fullscreen pause/stop rules produce near-idle wallpaper CPU/GPU work as confirmed
  by Wallpaper Engine diagnostics and the operating system GPU counters.
- A 30-minute capacity stress run has no context loss, errors, simulation reset,
  runaway population, or increasing memory trend.

### 5. Wallpaper Engine release candidate

- Finalize property labels, localization-ready text, preview image, metadata, and
  offline packaging.
- Test editor preview, installed wallpaper, restart, sleep/wake, display reconnect,
  resolution change, monitor-layout change, per-monitor assignment, clone, and span.
- Document recommended quality defaults for dual ultrawide systems.

Gate:

- Read back the imported project's type and properties in Wallpaper Engine.
- Complete an interaction and lifecycle smoke test in every monitor mode.
- Run automated tests and an independent read-only review against the release
  revision, including checks for lifecycle gaps and tests that would pass if the
  implementation were reverted.

## Recommended first implementation slice

Build milestone 1 before porting the complete simulation. Use deterministic fixture
arrays copied from a single Android frame to prove projection and shader parity.
This isolates the highest-risk desktop questions—WebGL compatibility, point-shape
fidelity, fill rate, Wallpaper Engine timing, and ultrawide mapping—before simulation
complexity can obscure them.
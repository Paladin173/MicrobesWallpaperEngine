# Milestone 1 validation

Validation date: 2026-08-31

Revision tested: `c346e640ba83b878f1ef2704b18980e8fe72000f`, followed by the
native `project.json` schema correction documented in this file.

## Test system

- GPU: AMD Radeon RX 9070 XT, driver 32.0.31041.1004.
- Secondary GPU: AMD Radeon Graphics, driver 32.0.21045.5002.
- Ultrawide displays: two 4096x1152 displays.
- Additional display: 1080x1920 portrait.
- Windows display scale observed in Wallpaper Engine UI: 125%.
- Wallpaper Engine: 64-bit web runtime using Chromium and D3D11 ANGLE.
- Wallpaper Engine FPS configuration: 30.
- Playback rules: pause on fullscreen, maximized, and focused applications.

## Authoritative live checks

The project was opened through Wallpaper Engine's documented `openWallpaper`
command in an isolated `playInWindow` instance. Existing desktop wallpaper
assignments were read before testing and were not replaced.

At 4096x1152 Auto quality:

- The physical display capture showed the complete fog, corpse, food, and microbe
  composition across the ultrawide surface.
- No blank strip, clipping, stretching, or shader failure was visible.
- The isolated Chromium log contained no application, JavaScript, or WebGL error.
- Average GPU-engine utilization over 10 samples was 0.237%; peak was 0.244%.
- Isolated process-tree CPU utilization was 0.726%.
- Isolated process-tree working set was 323.5 MB.

At an isolated 8192x1152 two-ultrawide stress surface with Auto quality:

- Average GPU-engine utilization over 10 samples was 0.294%; peak was 0.301%.
- Isolated process-tree CPU utilization was 0.601%.
- Isolated process-tree working set was 297.2 MB.
- The physical displays are stacked in Windows, so the second half of this pop-out
  was off-screen. Wallpaper Engine still created and rendered the requested full
  surface, making this valid performance evidence but not a monitor-seam visual test.

The initial manifest comparison found that the scaffold's custom top-level property
array was not Wallpaper Engine's native schema. It was corrected to the keyed
`general.properties` structure used by installed web wallpapers, and an automated
regression test now covers that contract.

## Automated checks

The Playwright suite exercises the native property manifest, four independent
nonblank layers, additive blend state, FPS throttling, pause/resume timing, pointer
normalization and disablement, all target viewport sizes, spanned pointer edges and
center, the Auto pixel budget, and WebGL context restoration without scene reset.

## Remaining live limitations

- A `playInWindow` instance did not reduce its compositor counters during the global
  pause command, so live `setPaused` delivery remains unverified. Browser-level pause
  behavior is covered by automation.
- Applying Performance quality to the 8192x1152 pop-out measured 0.292% average GPU,
  effectively the same as Auto. The fixture workload is below the compositor noise
  floor, and pop-out property state is not persisted in `config.json`; live property
  delivery is therefore inconclusive rather than failed.
- The 8192x1152 visual seam check remains pending because the two physical ultrawides
  are stacked, not side-by-side, in the current Windows display topology.
- Final Android side-by-side screenshot acceptance remains pending. The browser uses
  fixture buffers exported directly from the Android `MicrobeWorld`, but that is not
  equivalent to a human visual comparison of both owning runtimes.

These limitations do not block starting milestone 2. They must be rechecked against
the real interactive ecosystem before release acceptance.

## Milestone 2 automated evidence

The interactive ecosystem was implemented after the milestone-1 revision recorded
above. The browser suite now verifies fixed-step movement, dynamic GPU buffer
streaming without WebGL errors, click-to-feed behavior, death and corpse creation,
simulation pause semantics, and WebGL context restoration without replacing live
world state. It also verifies heading alignment in screen space, zoom scaling and
inverse pointer mapping, reduced food-particle size, and animated preview metadata.
The complete suite passes 14 tests.

The current repository was also opened by Wallpaper Engine in an isolated
`MicrobesValidation` pop-out using its documented `openWallpaper` command. Two
1294x758 visible-window captures taken at different times changed 2,633 of 58,320
sampled content pixels (4.515%, mean RGB difference 5.269). Visual inspection showed
the same organisms in different positions and lifecycle states, confirming movement
in the owning runtime rather than only in browser automation.

The isolated Wallpaper Engine process tree measured 0.159% average GPU-engine use,
0.164% peak GPU-engine use, and 321.2 MB working set over five samples. Its Chromium
log contained no application, JavaScript, or WebGL errors. The only entries were an
access-denied Chromium usage-statistics registry write and an unrelated USB device
enumeration warning. The named pop-out was closed after validation without replacing
the existing desktop wallpaper assignment.

Live pointer interaction was not exercised because desktop automation was unavailable
in this session; browser automation covers click feeding, pointer attraction, and
interaction disablement. The earlier 4096x1152 and 8192x1152 measurements remain the
authoritative ultrawide evidence because the milestone-2 pop-out was partially clipped
to the visible desktop capture area.
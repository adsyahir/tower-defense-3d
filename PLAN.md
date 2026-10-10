# 3D Tower Defense — Implementation Plan

> **Status (2026-10-10):** Stages 0–11 are implemented. Phone checks on a real device and deployment are still to do. **Next candidates:** pause menu, settings, save/continue, how-to-play, WebGL fallback.
> - **Stage 11 notes:** Kenney models are used for **towers only** (stacked `tower-*` pieces + `weapon-*`, merged into one geometry per type and level in `render/towerModels.ts`). Enemies, map and scenery stay procedural to match the design pass. Ballista uses Kenney's alternate palette (blue). Frost uses the default palette recoloured to ice at load (`render/assets.ts`). Upgrades add a middle section, so higher levels are taller. Sounds are synthesized WAVs (`scripts/gen-sfx.mjs`), played by Howler (`audio/Sound.ts`); mute is saved in `localStorage`. Balance was tuned with a scripted bot: single-type and mixed builds can win, frost-only can't (it's a support tower). Kenney credit: `public/models/LICENSE-kenney.txt` (CC0).
> Implementation notes that differ from the text below:
> - Enemies, health bars and projectiles are drawn with one `InstancedMesh` per kind, rebuilt from the game pools each frame (allocation-free, constant draw calls). `render/MeshPool.ts` was removed. Death effects are pooled particles, not per-enemy "corpse" meshes.
> - **Design pass (2026-10-10):** warm low-poly diorama look. Gradient sky + fog, warm key light; tile colour variation via `instanceColor`, sunken path, cliff base and a 2-tile meadow rim with merged procedural scenery (trees, rocks, bushes, flowers; one draw call; it never touches buildable tiles, so no logic change). Spawn portal and exit castle. Vertex-coloured, merged models from primitives (`render/style3d.ts` `GeoBuilder`): slime/runner/beetle enemies with hop/waddle, a stone cannon tower with recoil. Pooled juice in `render/Effects.ts` (death puffs, hit sparks, muzzle flash, landing dust, portal bursts, floating +gold sprites), hit flash, placement ghost + range ring, CSS wave banner and red edge flash on leak. HUD redone: Fredoka font, inline SVG icons, tower card, stateful wave button, end panel. Draw calls (desktop, shadows on, 7 towers): 53 before with 2 enemies; 51 after with 25 enemies. Before, the count grew with every enemy and projectile.
> - Game state is split into `game.state` (phase/gold/lives/wave/time), `game.enemies`/`game.projectiles` (pools) and `game.towers`.
> - In dev, `window.game` is exposed for console testing.

---

## 0. Ground rules for the implementer

1. **Do one stage at a time.** Finish its "Test" checklist on desktop *and* phone before starting the next.
2. **`src/game/` never imports `three`, DOM, GSAP or Howler.** It is plain TypeScript with plain data. Rendering, input, UI and audio *read* game state and *listen* to game events. They talk back to the game only through command methods (`game.placeTower(...)`, `game.startWave()`).
3. **No allocations in the per-frame loop.** Reuse vectors and objects; pool enemies, projectiles and their meshes.
4. **Stages 1–9 use basic shapes only** (boxes, cylinders, spheres). Kenney models arrive in stage 11.
5. **Path is fixed** (waypoints in a data file). No pathfinding.
6. Keep it simple: no ECS framework, no state library, no class hierarchies deeper than one level.

## 1. Stack

| Purpose | Package |
|---|---|
| Build/dev | `vite`, `typescript` |
| 3D | `three`, `@types/three` (`MapControls`, `GLTFLoader` from `three/addons/...`) |
| Debug sliders | `lil-gui` (dev only, lazy-loaded) |
| Small animations | `gsap` |
| Sound | `howler`, `@types/howler` |
| PWA | `vite-plugin-pwa` |
| Logic tests | `vitest` (only for `src/game/` — pure logic is easy to unit test) |

Hosting: **Netlify or Vercel** (zero config: build `npm run build`, publish `dist`). GitHub Pages also works but needs `base: '/<repo-name>/'` in `vite.config.ts` and the PWA `scope`/`start_url` to match.

## 2. Folder structure

```
tower-defense-3d/
├─ index.html                 # canvas container + HUD markup + overlays
├─ vite.config.ts             # PWA plugin, base path
├─ tsconfig.json              # strict: true
├─ package.json
├─ public/
│  ├─ models/                 # Kenney .glb (+ their Textures/ folder) — stage 11
│  ├─ sounds/                 # .webm + .mp3 pairs — stage 11
│  └─ icons/                  # PWA icons 192/512 + maskable — stage 10
└─ src/
   ├─ main.ts                 # bootstrap: create Game, views, input, HUD; run loop
   ├─ style.css
   ├─ config/
   │  ├─ balance.ts           # tower/enemy stats, economy, wave list (single source of tuning)
   │  └─ map01.ts             # grid size + path waypoints
   ├─ game/                   # PURE LOGIC — no three/DOM
   │  ├─ Game.ts              # owns GameState, update(dt), commands, reset()
   │  ├─ types.ts             # Vec2, Enemy, Tower, Projectile, GameState, Phase
   │  ├─ events.ts            # tiny typed event emitter
   │  ├─ grid.ts              # tile <-> world, path tiles, isBuildable
   │  ├─ path.ts              # waypoint path, positionAt(distance), totalLength
   │  ├─ enemies.ts           # spawn/move/leak/kill
   │  ├─ towers.ts            # place/target/cooldown/fire
   │  ├─ projectiles.ts       # move/hit
   │  ├─ waves.ts             # wave scheduler
   │  ├─ pool.ts              # generic object pool
   │  └─ *.test.ts            # vitest unit tests
   ├─ render/
   │  ├─ Renderer3D.ts        # WebGLRenderer, scene, lights, resize, quality
   │  ├─ CameraRig.ts         # PerspectiveCamera + MapControls + limits
   │  ├─ MapView.ts           # ground tiles (InstancedMesh), path, tile highlight
   │  ├─ EnemyView.ts         # enemy meshes via MeshPool, synced to state
   │  ├─ TowerView.ts         # tower meshes, range ring, selection
   │  ├─ ProjectileView.ts
   │  ├─ HealthBars.ts
   │  ├─ MeshPool.ts
   │  ├─ assets.ts            # GLTF load + cache + clone (stage 11)
   │  └─ effects.ts           # GSAP tweens (stage 11)
   ├─ input/
   │  └─ Picker.ts            # pointer events → tap vs drag → tile
   ├─ ui/
   │  ├─ Hud.ts               # gold/lives/wave, tower buttons, start-wave, panels
   │  └─ overlays.ts          # rotate-device, pause, game over / victory
   ├─ audio/
   │  └─ Sound.ts             # Howler wrapper, listens to game events
   ├─ platform/
   │  └─ device.ts            # isTouch, quality preset, visibility/pause
   └─ debug/
      └─ gui.ts               # lil-gui bound to config/balance + quality
```

## 3. Core architecture (read before stage 1)

### Data flow
```
Pointer/HUD ──commands──▶ Game (src/game) ──events──▶ Views / HUD / Sound
                               │
                          GameState (plain data)
                               │ read every frame
                               ▼
                         Views sync meshes → render
```

### Main loop (`main.ts`)
```ts
renderer.setAnimationLoop(() => {
  let dt = Math.min(clock.getDelta(), 0.1);   // clamp: tab switches / hitches
  if (!paused) {
    dt *= gameSpeed;                           // 1x / 2x
    while (dt > 0) { const step = Math.min(dt, 1/30); game.update(step); dt -= step; }
  }
  enemyView.sync(game.state); towerView.sync(...); projectileView.sync(...); healthBars.sync(...);
  cameraRig.update();
  renderer3D.render();
});
```
Sub-stepping at max 1/30 s keeps fast projectiles from tunnelling at low FPS.

### Game state (`types.ts`) — plain objects, ids are numbers
```ts
type Vec2 = { x: number; z: number };            // ground plane, y is up in render only
type Phase = 'build' | 'wave' | 'gameover' | 'victory';
interface Enemy { id; active; type; hp; maxHp; speed; distance; pos: Vec2; reward }
interface Tower { id; type; level; tile: {col,row}; pos: Vec2; cooldown; targetId: number | null }
interface Projectile { id; active; pos: Vec2; targetId; lastTargetPos: Vec2; speed; damage }
interface GameState { phase; gold; lives; wave; enemies: Enemy[]; towers: Tower[]; projectiles: Projectile[]; time }
```

### Events (`events.ts`)
Small typed emitter: `on(name, fn)`, `off`, `emit`. Events:
`enemySpawned, enemyKilled, enemyLeaked, enemyRemoved, towerPlaced, towerUpgraded, towerSold, projectileFired, projectileHit, waveStarted, waveCleared, goldChanged, livesChanged, phaseChanged, reset`.
Views use `enemySpawned`/`enemyRemoved` to acquire/release meshes; HUD uses `goldChanged` etc. (update DOM **only on change**, never every frame).

### Coordinates
- 1 tile = 1 world unit. Tile `(col,row)` center → world `x = col - W/2 + 0.5`, `z = row - H/2 + 0.5`. Map centered on origin.
- Game uses `Vec2 {x,z}`. Render maps to `Vector3(x, y, z)`.

---

## 4. Stages

Each stage: **Goal → Files → Key logic → Test (desktop / phone)**.
Phone testing during dev: `npm run dev -- --host`, open `http://<LAN-IP>:5173` on the phone (same Wi-Fi). Use Chrome `chrome://inspect` (Android) or Safari Web Inspector (iOS) for console. Add a tiny FPS counter (`?fps` query flag, a DOM div updated twice a second) in stage 1 and keep it.

---

### Stage 0 — Project setup
**Goal:** Empty Vite+TS project builds and deploys.
**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/style.css`, folder skeleton.
**Key logic:**
- `npm create vite@latest . -- --template vanilla-ts`, install deps from §1.
- `tsconfig` `strict: true`. Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest`).
- `index.html` viewport: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`.
- Connect repo to Netlify/Vercel now so every stage can be tested on a real phone over HTTPS.
**Test:** `npm run build` passes; deployed URL shows a blank page with no console errors on desktop and phone.

---

### Stage 1 — Renderer, camera, responsive shell
**Goal:** A 3D scene with a ground plane, controllable camera, correct sizing on any screen, portrait warning, empty HUD.
**Files:** `render/Renderer3D.ts`, `render/CameraRig.ts`, `platform/device.ts`, `ui/overlays.ts`, `ui/Hud.ts` (shell), `index.html`, `style.css`, `main.ts`.
**Key logic:**
- `device.ts`: `isTouch = matchMedia('(pointer: coarse)').matches`; quality preset `{ pixelRatio: Math.min(devicePixelRatio, 2), shadows: !isTouch, antialias: devicePixelRatio < 2 }`.
- Renderer: `setPixelRatio(quality.pixelRatio)`, `outputColorSpace = SRGBColorSpace`. Lights: one `HemisphereLight` + one `DirectionalLight`. Shadows only if `quality.shadows`: map size 1024, tight shadow camera around the map.
- Resize: `ResizeObserver` on the container (more reliable than `window.resize` on mobile URL-bar changes) → `renderer.setSize(w,h,false)`, `camera.aspect`, `updateProjectionMatrix()`.
- CSS: `html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none}`, game container `height:100dvh`, canvas `touch-action:none; display:block`. HUD uses `env(safe-area-inset-*)` padding (iPhone notch). Disable text selection and the iOS tap highlight on HUD (`user-select:none; -webkit-tap-highlight-color:transparent`).
- CameraRig: `PerspectiveCamera(50)` angled ~55° down. `MapControls`: `enableDamping`, `minDistance/maxDistance`, `maxPolarAngle ≈ 1.2` (never look under the ground), `touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }`. Clamp `controls.target` to map bounds each update (and shift camera by the same delta) so players can't pan into the void.
- Portrait overlay: pure CSS `@media (orientation: portrait) { #rotate { display:flex } }`; JS listens to the same `matchMedia` to **pause** the game while portrait.
- HUD shell: top bar (gold, lives, wave), bottom bar (tower buttons, start wave). All buttons `min-width/min-height: 44px`. HUD container `pointer-events:none`; its buttons `pointer-events:auto` so the canvas still gets touches between buttons.
**Test:**
- Desktop: drag pans, wheel zooms, right-drag rotates; resizing window keeps aspect correct, no stretching.
- Phone: one-finger pan, pinch zoom, two-finger rotate; page never scrolls/bounces/zooms; portrait shows "please rotate"; landscape hides it; HUD clears the notch; FPS ~60.

---

### Stage 2 — Map: grid and fixed path
**Goal:** Grid floor with a visible path from spawn to exit.
**Files:** `config/map01.ts`, `game/grid.ts`, `game/path.ts`, `game/types.ts`, `render/MapView.ts`, `game/path.test.ts`.
**Key logic:**
- `map01.ts`: `{ cols: 16, rows: 10, waypoints: [{col,row}, ...] }` — only axis-aligned segments.
- `grid.ts`: `tileToWorld`, `worldToTile`, `pathTiles` (a `Set<string>` of `"col,row"` built by walking between consecutive waypoints), `isInside`, `isBuildable(tile, towers)` = inside && not path && not occupied.
- `path.ts`: precompute world points, segment lengths, cumulative lengths. `positionAt(distance, out: Vec2)` writes into `out` (no allocation). `totalLength`.
- `MapView`: one `InstancedMesh` of flat boxes for grass tiles, another for path tiles (2 draw calls total instead of 160). Small markers at spawn and exit.
**Test:**
- `vitest`: `positionAt(0)` = first waypoint, `positionAt(totalLength)` = last, a mid-point lands on the correct segment; `pathTiles` contains every tile between waypoints.
- Visual: path shape matches `map01.ts`; desktop and phone both render smoothly.

---

### Stage 3 — Tapping tiles (picking)
**Goal:** Tapping/clicking a tile highlights it; dragging/pinching never counts as a tap.
**Files:** `input/Picker.ts`, `render/MapView.ts` (highlight), `main.ts`.
**Key logic:**
- Listen to `pointerdown`/`pointerup`/`pointercancel` on the canvas. Track active pointer count. A **tap** = single pointer, moved < 10 px, held < 400 ms, and no second pointer appeared during the gesture.
- Convert screen → NDC → `Raycaster.ray.intersectPlane(groundPlane)` (a math `Plane(y=0)`, **not** raycasting meshes — cheap and exact) → `worldToTile`.
- Emit `onTapTile(tile | null)` callback. Later stages also check towers (by tile lookup, no mesh raycast needed).
- Highlight: one reusable flat quad moved to the tile; green if buildable, red if not.
**Test:** Desktop click highlights the right tile at any zoom/rotation; a drag doesn't. Phone: tap highlights, pan and pinch don't, tapping a HUD button doesn't hit the tile under it.

---

### Stage 4 — Game core: state, loop, events
**Goal:** The `Game` class exists with state, update loop, events, pause, and reset — nothing to see yet but wired end to end.
**Files:** `game/Game.ts`, `game/types.ts`, `game/events.ts`, `game/pool.ts`, `config/balance.ts`, `ui/Hud.ts`, `main.ts`, `game/pool.test.ts`.
**Key logic:**
- `balance.ts`: `startGold: 100, startLives: 20`, and empty `towers`, `enemies`, `waves` objects to fill later.
- `pool.ts`: `Pool<T>` with `acquire()`, `release(obj)`, `forEachActive(fn)`. Pre-allocate (e.g. 100 enemies, 200 projectiles). Use an `active` flag in the array; no `splice` during iteration.
- `Game`: `state`, `events`, `update(dt)` (calls subsystems in order: waves → enemies → towers → projectiles → check end), `reset()`.
- Pause on `document.visibilitychange` (hidden) and on portrait.
- HUD subscribes to `goldChanged/livesChanged/waveStarted` and writes `textContent`.
**Test:** `vitest` for pool acquire/release reuse. Browser: HUD shows 100 gold / 20 lives; a temporary debug button adding gold updates the HUD; switching tabs pauses.

---

### Stage 5 — Enemies follow the path
**Goal:** Enemies spawn at the start, walk the path, and cost a life when they reach the end.
**Files:** `game/enemies.ts`, `render/MeshPool.ts`, `render/EnemyView.ts`, `config/balance.ts`, `game/enemies.test.ts`.
**Key logic:**
- `balance.enemies`: `{ basic: { hp: 30, speed: 1.5, reward: 5, lifeCost: 1 }, fast: {...}, tank: {...} }`.
- `spawnEnemy(type)`: acquire from pool, set `distance = 0`, emit `enemySpawned`.
- Update: `distance += speed * dt`; `path.positionAt(distance, enemy.pos)`. If `distance >= totalLength` → `lives -= lifeCost`, emit `enemyLeaked` + `livesChanged`, release, emit `enemyRemoved`.
- `MeshPool`: pre-creates N meshes sharing **one geometry and one material per enemy type**, `visible=false` when free. `EnemyView` keeps `Map<enemyId, Mesh>`; on spawn acquire, on remove release; `sync()` copies `pos` into `mesh.position` and faces direction of travel.
- Temporary debug: spawn an enemy every second.
**Test:** `vitest`: an enemy with speed 1 after `totalLength` seconds is leaked and lives decrease. Visual: enemies walk the exact path, turn at corners, vanish at the end, lives tick down. Phone: 50 enemies on screen still ~60 FPS.

---

### Stage 6 — Towers: place, select, target
**Goal:** Choose a tower type in the HUD, tap a free tile to place it (costs gold); the tower turns toward the nearest enemy in range.
**Files:** `game/towers.ts`, `render/TowerView.ts`, `ui/Hud.ts`, `input/Picker.ts`, `config/balance.ts`, `game/towers.test.ts`.
**Key logic:**
- `balance.towers.basic = { cost: 50, range: 2.5, fireRate: 1 /*shots/s*/, damage: 10, projectileSpeed: 8 }`.
- Interaction (works without hover — required for touch):
  - Tap a tower button → **build mode** for that type (button shows active state; tap again to cancel).
  - In build mode, tap buildable tile → `game.placeTower(type, tile)`. Game validates (`isBuildable` + enough gold), deducts gold, emits `towerPlaced`. Invalid → flash red highlight, no change. Stay in build mode while gold allows.
  - Not in build mode: tap a tower → select it (show range ring); tap elsewhere → deselect.
- Targeting (every update, per tower): loop active enemies, compare **squared** distance to `range²`, keep the nearest → `targetId`. Fine for ≤ ~30 towers × ~100 enemies; no spatial grid needed.
- `TowerView`: base cylinder + turret box (turret rotates to target with `atan2`). Range ring: one shared `RingGeometry` mesh, moved/scaled to the selected tower.
**Test:** `vitest`: can't place on path, on an occupied tile, or without gold; nearest-in-range wins; out-of-range enemy is ignored. Visual: placing works by click and by tap; panning in build mode never places a tower; turrets track enemies.

---

### Stage 7 — Combat: projectiles, HP, health bars, death
**Goal:** Towers shoot, projectiles hit, enemies lose HP, show health bars, and die.
**Files:** `game/projectiles.ts`, `game/towers.ts`, `game/enemies.ts`, `render/ProjectileView.ts`, `render/HealthBars.ts`, `game/projectiles.test.ts`.
**Key logic:**
- Tower: `cooldown -= dt`; if target and `cooldown <= 0` → spawn projectile at tower, `cooldown = 1/fireRate`, emit `projectileFired`.
- Projectile (homing): if target still active, update `lastTargetPos`; move toward `lastTargetPos` by `speed*dt`. Hit when distance < 0.2 (or step overshoots): apply damage to target if still alive; release projectile. If target died, fly to last position and expire there.
- Enemy damage: `hp -= dmg`; if `hp <= 0` → emit `enemyKilled` (with reward), release, `enemyRemoved`. Guard against double-kill in the same frame (check `active`).
- `HealthBars`: per enemy, two thin planes (bg + fill) in a pooled `Group`, positioned above the enemy, `quaternion.copy(camera.quaternion)` to billboard, `fill.scale.x = hp/maxHp` (fill geometry translated so it shrinks from the left). Hidden at full HP.
- Projectiles: small sphere meshes from `MeshPool`, one shared geometry/material.
**Test:** `vitest`: projectile reaches stationary target and deals damage; target dying mid-flight doesn't crash or double-count. Visual: bars drop, enemies die, pools reuse (log pool sizes in dev — they shouldn't grow after warm-up).

---

### Stage 8 — Waves, economy, game over, restart
**Goal:** A full playable loop with basic shapes.
**Files:** `game/waves.ts`, `game/Game.ts`, `config/balance.ts`, `ui/Hud.ts`, `ui/overlays.ts`, `game/waves.test.ts`.
**Key logic:**
- `balance.waves`: array of waves, each a list of groups `{ type, count, interval, delay }`. Define ~10 waves. After the list ends → `victory` (or, optionally, endless mode scaling HP by `1.15^n`).
- Phases: `build` → (player taps **Start Wave**) → `wave` → when scheduler finished and no active enemies → `waveCleared`, small bonus gold → `build`. `lives <= 0` → `gameover`.
- Gold: `+reward` on `enemyKilled`; `-cost` on place. HUD disables tower buttons you can't afford (listen to `goldChanged`).
- Overlays: Game Over / Victory with wave reached and a **Restart** button → `game.reset()`: release all pools, clear towers, restore start values, emit `reset`; views clear meshes on `reset`.
- Optional: 2× speed toggle (sets `gameSpeed` in `main.ts`).
- Remove the stage 5 debug spawner.
**Test:** `vitest`: wave scheduler spawns the right counts at the right times; phase transitions; reset restores everything. Manual: play to game over, restart, play again — no leftover meshes, no FPS drop between runs (check no leak: enemy/projectile pool sizes stable). Do a full run on the phone.

**✅ MVP complete here.**

---

### Stage 9 — Debug GUI
**Goal:** Tweak balance and quality live without rebuilding.
**Files:** `debug/gui.ts`, `main.ts`.
**Key logic:** Load only when `import.meta.env.DEV` or URL has `?debug`: `const { default: GUI } = await import('lil-gui')` (stays out of the main bundle). Folders: towers (cost/range/damage/fireRate), enemies (hp/speed), economy, quality (pixel ratio, shadows toggle), and buttons: "spawn enemy", "+100 gold", "skip wave". Game reads `balance` each time it needs a value, so edits apply instantly.
**Test:** Sliders change behavior live; production build without `?debug` doesn't load lil-gui (check network tab).

---

### Stage 10 — PWA (installable, offline)
**Goal:** Installable on phone, plays offline, opens in landscape.
**Files:** `vite.config.ts`, `public/icons/*`, `src/main.ts` (register SW).
**Key logic:**
- `VitePWA({ registerType: 'autoUpdate', manifest: { name, short_name, display: 'fullscreen', orientation: 'landscape', background_color, theme_color, icons: [192, 512, 512 maskable] }, workbox: { globPatterns: ['**/*.{js,css,html,png,svg,glb,webm,mp3}'], maximumFileSizeToCacheInBytes: 5_000_000 } })`.
- Register with `import { registerSW } from 'virtual:pwa-register'` (add `vite-plugin-pwa/client` to tsconfig types).
- Note: iOS ignores `orientation` in the manifest and has no Fullscreen API on iPhone — the CSS rotate overlay from stage 1 still matters.
**Test:** Lighthouse PWA check on deployed URL. Phone: "Add to Home Screen", open, turn on airplane mode, relaunch → game loads and plays. Deploy an update → app refreshes on next open.

---

### Stage 11 — Polish: Kenney models, tower types, upgrades, sound, juice
Split into sub-steps; test after each.

**11a. Kenney models**
- Download the Kenney Tower Defense Kit (CC0) and copy the needed GLBs to `public/models/`. **Check whether the GLBs reference an external texture (e.g. `Textures/colormap.png`)** — if so, keep that folder next to them with the same relative path, or the models load untextured.
- `render/assets.ts`: `loadAll()` with `GLTFLoader` + `LoadingManager` → simple loading bar in HTML. Cache each `gltf.scene`; `getModel(name)` returns `scene.clone()` (clones share geometry/materials — cheap).
- Swap shapes in `EnemyView`/`TowerView`/`MapView` for models. Ground tiles: keep InstancedMesh (use the tile model's geometry + material in an `InstancedMesh`) rather than 160 separate cloned scenes. Normalize scale/pivot once per model (Kenney tiles are ~1 unit but verify) in a small `modelConfig` table.
- Turret rotation: find the turret child by name in the clone and rotate it; if the model is one piece, rotate the whole tower.
- `traverse` once on load: set `castShadow` only on towers and only when `quality.shadows`.

**11b. 3 tower types** (data only in `balance.ts` + one behavior switch in `towers.ts`)
- **Arrow**: cheap, fast fire, single target.
- **Cannon**: slow, splash damage (on hit, damage all enemies within radius — squared-distance loop).
- **Frost**: low damage, slows target (`slowUntil`, `slowFactor` on enemy; speed uses it).
- Optional targeting option "first" (largest `distance`) vs "nearest".

**11c. Upgrades & sell**
- Tapping a tower opens an HTML panel near the bottom: level, stats, **Upgrade (cost)**, **Sell (refund 70% of spent)**. `balance.towers[type].levels: [{damage, range, fireRate, cost}, ...]` (max 3 levels).
- `game.upgradeTower(id)` / `game.sellTower(id)` validate and emit events. Visual: scale-up tween or swap to next-level model.

**11d. Sound**
- `audio/Sound.ts`: Howler sprites or individual `Howl`s with `src: ['x.webm','x.mp3']`. Subscribes to game events (`projectileFired`, `enemyKilled`, `enemyLeaked`, `towerPlaced`, `waveStarted`, `phaseChanged`).
- **Mobile audio unlock:** sounds can't play before the first user gesture (iOS). Howler auto-unlocks on first touch; also start any music only after "Tap to start".
- Throttle: max one fire sound per ~60 ms (many towers firing at once is noise and costs CPU). Mute button in HUD (persist in `localStorage`, wrapped in try/catch).

**11e. Juice (GSAP)**
- Tower place: scale 0 → 1 with `back.out`. Enemy death: quick scale-down before release (delay release in the **view** only; game logic already removed it). Gold counter bump in HUD. Lives flash red on leak.
- Kill all tweens on an object before returning it to a pool (`gsap.killTweensOf(mesh.scale)`).

**Test (11):** Everything from stage 8 still passes on phone; models load with textures; FPS on the phone within ~10% of the shapes version; sounds play after first tap on iOS; offline still works (new assets are precached).

---

## 5. Mobile performance — watch-outs

| Risk | What to do |
|---|---|
| High-DPI phones render 3–4× pixels | `setPixelRatio(min(dpr, 2))`; if FPS < 50 on phone, drop to 1.5. Turn off `antialias` when dpr ≥ 2. |
| Shadows are expensive | Off on touch devices. On desktop: one directional light, 1024 map, tight frustum, only towers cast. |
| Too many draw calls | Shared geometry/material per type; `InstancedMesh` for ground tiles; avoid per-object materials (don't clone materials to tint — share one per state). Check `renderer.info.render.calls` (show in debug GUI). |
| Garbage collection stutters | No `new Vector3()`/arrays/closures in the frame loop; pools for enemies, projectiles, meshes, health bars; `positionAt(d, out)` writes into existing objects. |
| Raycasting cost | Raycast a math `Plane`, not meshes; tower lookup by tile key. |
| DOM layout thrash | Update HUD text only on change events; never write DOM per frame; no CSS `backdrop-filter`/big blurs over the canvas. |
| Big frame jumps after tab switch | Clamp `dt` to 0.1 and pause on `visibilitychange`. |
| Thermal throttling on long sessions | Target 60 FPS but cap work: no post-processing, few lights (hemi + 1 directional), `MeshLambertMaterial`/`MeshStandardMaterial` only. Optional 30-FPS cap toggle in settings. |
| Asset size / load time | Kenney GLBs are small; don't add Draco. Keep textures ≤ 1024. Show a loading bar. Precache via PWA. |
| iOS Safari quirks | Use `100dvh`; `touch-action:none` on canvas; `user-scalable=no`; prevent `gesturestart` default; safe-area insets; audio unlock on gesture. |
| GPU memory leaks on restart | Never dispose shared geometries on reset — just release to pools. Dispose only if a whole scene is torn down. |
| Too many enemies late game | Cap concurrent enemies via wave design (~80). If needed later, switch enemies to `InstancedMesh` per type. |

## 6. Verification (whole project)

- `npm run test` — all `src/game/*.test.ts` pass (path, pool, enemies, towers, projectiles, waves).
- `npm run build` — no TypeScript errors; `npm run preview` works.
- Desktop (Chrome + Safari/Firefox): mouse pan/zoom/rotate, click-to-place, full game to game over and victory, restart.
- Phone (one iPhone/Safari + one Android/Chrome if possible) on the **deployed HTTPS URL**: landscape play, rotate overlay in portrait, pinch/pan never places towers, 44px buttons usable with thumbs, sound after first tap, install to home screen, airplane-mode launch.
- FPS counter (`?fps`) ≥ 50 on the phone during a busy late wave.

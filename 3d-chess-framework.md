# 3D Chess — Framework Document

**Version:** 0.2 (working draft)
**Working title:** TBD

This is a living document. It is organized as **Locked / Open / Deferred** rather than as a spec, because the design is being built up step by step and most of it is not decided yet. Nothing moves from Open to Locked without an explicit call.

---

## 1. What this is

A turn-based strategy game played by two players inside a 3D lattice, rendered with a holographic deep-space visual identity and a free-orbit camera. It descends from chess but is not required to be chess.

**What it definitely inherits from chess:**

- You win by **checkmate**. This is non-negotiable and is the design constraint everything else bends around.
- Alternating turns, one move per turn.
- Strategic movement and capture within a bounded space.
- Perfect information, no randomness.

**What is up for grabs:**

- The number of pieces
- What the pieces are
- How they move
- The size of the lattice
- Whether pawns exist at all in a recognizable form

If the result is its own standalone game rather than "chess but 3D," that is a fine outcome and probably the better one.

**Two play modes are the goal:** local hot seat (two players, one device) and player versus AI.

---

## 2. Locked decisions

| # | Decision | Notes |
|---|---|---|
| L1 | **Win condition is checkmate.** | Everything else bends around this. |
| L2 | **Local hot seat and vs AI are both required.** | AI is a first-class goal, not a stretch goal. This has real architectural consequences (section 5). |
| L3 | **Coordinate system:** true (x, y, z), always from Blue's perspective. | See 2.1. |
| L4 | **Free camera:** orbit, zoom, pan, dolly, vertical travel. | |
| L5 | **Pieces render as glowing nodes carrying a billboarded icon glyph.** | Identity never depends on viewing angle. |
| L6 | **Holographic / deep space visual identity.** | Palette and type in section 6. |
| L7 | **Lattice size N is a configuration constant, not a design commitment.** | See 4.4. The renderer, engine, and coordinate system are all written parameterized by N so that changing 8 to 6 to 5 is a one-line change. |
| L8 | **The two sides are Blue and Red**, everywhere: source code, UI, notation, and documentation. The words White and Black do not appear. | Blue occupies `z = 0`, is the reference frame for all coordinates, and moves first. |

### 2.1 Coordinate system

- Axes are **x** (left to right), **y** (down to up), **z** (near to far), all from Blue's default view with Blue's home side nearest the camera.
- **Zero-based, mathematically true origin.** Every axis runs `0` to `N-1`.
- The **origin cell is Blue's bottom-left-near corner**: `(0, 0, 0)`.
- x increases to the right, y increases upward, z increases away from Blue toward Red.
- Blue's home plane is `z = 0`. Red's home plane is `z = N-1`.
- The position is mirrored across the z midplane only, so both kings sit on the same x and y.

Cells display as three numbers, `(4, 5, 0)`, with a compact form `450` for the move log and HUD.

**There is one representation, not two.** Display coordinates and engine coordinates are identical, so no conversion layer exists anywhere in the codebase:

```
index = x + N*y + N*N*z            // 0 .. N^3-1
x = index % N
y = Math.floor(index / N) % N
z = Math.floor(index / (N*N))
```

World-space placement, cube centered on the world origin:

```
worldX =  (x - (N-1)/2) * CELL
worldY =  (y - (N-1)/2) * CELL
worldZ = -(z - (N-1)/2) * CELL     // Three.js +z points at the viewer, so game-forward is world -z
```

---

## 3. Deferred, deliberately

These are **not** being decided on paper. They get decided in the sandbox described in section 5.

- What pieces exist
- How each piece moves
- How many pieces each side gets
- Starting positions
- Whether pawns exist, and if so what they do
- Promotion, en passant, castling, and every other special rule
- The Unicorn (triagonal slider) and every other candidate piece

Any piece ideas that came up earlier are parked in the appendix as **unlocked candidates**, not proposals.

---

## 4. The analysis that actually constrains the design

This section is the useful part. It is the set of numbers that determine which of your instincts will work.

### 4.1 The checkmate problem, restated correctly

Checkmate requires attacking the king's cell **and every cell it could escape to**, with the attacker protected. In a cubic lattice every cell has **26 neighbors**, versus 8 on a chessboard. That is the whole problem.

**Escape count by king position:**

| Position | Neighbors |
|---|---|
| Corner | 7 |
| Edge | 11 |
| Face | 17 |
| Interior | 26 |

### 4.2 Why shrinking the cube is a weak lever

Your instinct was to shrink the cube. It helps, but much less than it feels like it should, because **26-adjacency is a property of the cubic lattice, not of its size.** Shrinking only changes what fraction of cells are boundary cells.

Average escape count across all cells, by lattice size:

| Lattice | Cells | Interior cells | Avg. king escape count |
|---|---|---|---|
| Chessboard 8x8 | 64 | 36 (56%) | 6.6 |
| **8x8x8** | 512 | 216 (42%) | **19.8** |
| 6x6x6 | 216 | 64 (30%) | 18.0 |
| 5x5x5 | 125 | 27 (22%) | 16.6 |
| 4x4x4 | 64 | 8 (12%) | 14.6 |

Going from 8 to 4 (an **eight-fold** reduction in volume) only drops the average escape count from 19.8 to 14.6, still more than double a chessboard. You would gut the game's space and barely dent the mating problem.

**Conclusion: cube size is not the lever for checkmate.** It is a real lever for other things (section 4.4), just not this one.

### 4.3 The strong lever: king mobility

The king does not have to move like everything else. Restricting **which** of the 26 directions the king can use collapses the problem immediately.

| King moves along | Escape cells | Cells to cover for mate | Compared to chess (9) |
|---|---|---|---|
| All 26 directions | 26 | 27 | 3x harder |
| Orthogonal + face diagonal (18) | 18 | 19 | 2x harder |
| Face diagonal only (12) | 12 | 13 | 1.4x harder |
| **Orthogonal only (6)** | **6** | **7** | **easier than chess** |

An orthogonal-only king is mated *more* easily than a chess king. In a corner it has 3 escape cells. Two pieces can finish it.

This costs nothing structurally, requires no shrinking, and has a natural reading: the king is the slow, heavy thing that moves along the lattice's principal axes while everything else cuts diagonally around it. Whether it *feels* right is a sandbox question, not a paper question.

**This does not have to be the answer.** The point is that king mobility, not board size, is where the leverage is. Other levers in the same family:

- **Area-attack pieces.** Every piece so far attacks along rays. A piece that attacks a *volume* (say, all 26 neighbors) or a *plane* covers escape cells far more efficiently than any slider. Two such pieces could plausibly mate a 26-direction king. This is the most interesting unexplored direction and it is exactly the kind of thing that would make the game standalone rather than derivative.
- **Attackers that deny rather than capture.** Pieces that make cells unenterable without occupying them.
- **A king with a restriction other than direction**, e.g. it cannot move to a cell adjacent to an enemy piece.

### 4.4 Where cube size *does* matter: the AI

Since vs-AI is locked (L2), branching factor is a hard design constraint, not an implementation detail.

Rough legal moves per position:

| Configuration | Approx. branching factor |
|---|---|
| Chess | 35 |
| 8x8x8, 32 pieces per side | 400 to 800 |
| 6x6x6, 20 pieces per side | 200 to 350 |
| 5x5x5, 16 pieces per side | 120 to 200 |

Alpha-beta search with good move ordering gets an effective branching factor of roughly the square root of the raw one. In browser JavaScript, budgeting a couple of seconds per move:

| Raw branching | Effective | Realistic search depth |
|---|---|---|
| 35 (chess) | ~6 | 8 to 10 plies |
| 150 | ~12 | 5 to 6 plies |
| 400 | ~20 | 4 plies |
| 800 | ~28 | 3 to 4 plies |

**A 3-to-4-ply AI is weak.** It sees a capture and a recapture and nothing else, which in a tactically explosive 3D space means it will get slaughtered by any human who plans two moves ahead, and it will also blunder constantly.

This is the strongest argument for a smaller lattice and fewer pieces, and it is completely independent of the checkmate question. It is also an argument for pieces with **smaller move sets**, since branching factor scales with piece count times average mobility. A 26-ray queen is very expensive for the AI.

Mitigations if you want to keep 8x8x8: run the AI in a Web Worker so the UI stays responsive, write the engine allocation-free from day one, use iterative deepening with transposition tables and killer-move ordering, and accept a longer think time. These buy maybe one extra ply. They do not close a five-ply gap.

> **[OPEN]** Lattice size stays undecided. Per L7 it is a constant, so we can build everything at 8x8x8, feel it, and drop to 6x6x6 or 5x5x5 later at no cost.

### 4.5 The three-way tension

Everything above is one triangle:

```
        large lattice
       (feels impressive,
        room to maneuver)
              /\
             /  \
            /    \
           /      \
  matable king    strong AI
 (needs coverage  (needs low
  or restriction)  branching)
```

Pull on any corner and the other two complain. The design job is picking which corner to sacrifice, and the current answer is: **keep the large lattice, restrict the king or add area-attackers, and buy the AI back with a small piece count and cheap move sets.**

---

## 5. The method: build the sandbox before deciding anything

You said you need to see it before you can judge it. That is correct and it should drive the build order.

**Phase 1 delivers the cube. Phase 1.5 delivers a piece laboratory.**

The laboratory is a mode where you can:

- Drop a test piece on any cell
- Toggle its movement components live: orthogonal / face-diagonal / triagonal rays, range limits, leap offsets like (1,2,0), step-only versus slide
- See every attacked cell light up instantly, with a live count and a percentage of the lattice
- Drop a second piece and see blocking and coverage overlap
- Drop an enemy king and get a readout: **"escape cells covered: 4 of 26"**

That last readout turns the entire checkmate question from a philosophical argument into a number you can watch change while you drag a slider. Piece design stops being guesswork.

This is cheap to build, it reuses everything Phase 1 needs anyway (lattice, camera, picking, highlighting), and it is the thing that unblocks every deferred decision in section 3.

### Build phases

| Phase | Deliverable |
|---|---|
| **1** | **Lattice and camera.** N x N x N grid renders with bounding cube, cell markers, and axis rulers. Full camera control. Hovering a cell highlights it and shows its coordinate. No pieces, no rules. |
| **1.5** | **Piece laboratory.** Place test pieces, compose movement rules live, visualize attacked cells and king-escape coverage. |
| **2** | **Piece set v0.** Lock a first draft of pieces and a starting position out of what phase 1.5 taught us. Hot seat with turn alternation, selection, click-to-move. |
| **3** | **Legality.** Check detection, pin filtering, checkmate, stalemate. Move log, undo. |
| **4** | **First playtests.** Play real games. Revise the piece set. Expect to throw work away here; that is the point. |
| **5** | **AI.** Alpha-beta in a Web Worker, iterative deepening, transposition table, difficulty levels. |
| **6** | **Polish.** Post-processing, slice mode, sound, save/load, reduced motion. |

**Current target: Phase 1.** It is fully unblocked and depends on none of the open questions.

---

## 6. Technical architecture

### 6.1 Stack

- **Vite + TypeScript**, **Three.js** used directly, plain DOM overlay for HUD. No backend, runs locally.

### 6.2 Directory layout

```
src/
  engine/          pure logic, zero Three.js imports, zero DOM
    config.ts      N and other lattice constants
    types.ts
    board.ts       flat typed-array state, indexing
    vectors.ts     direction tables, generated from N
    movegen.ts
    legality.ts
    rules.ts
    notation.ts
  ai/              runs in a Web Worker, imports engine only
    search.ts
    eval.ts
    tt.ts
  render/
    scene.ts
    camera.ts
    lattice.ts     bounding cube, cell markers, axis rulers
    nodes.ts
    highlights.ts
  lab/             the phase 1.5 piece laboratory
  ui/
  input/
  main.ts
```

**Hard rules:**

1. `engine/` never imports from `render/`. This is what makes the logic headlessly testable and lets the AI run in a worker.
2. `engine/` never allocates in move generation. Moves are written into a preallocated buffer and a count is returned. This is cheap now and impossible to retrofit once the AI exists.
3. Everything reads `N` from `config.ts`. No hardcoded 8s anywhere.

### 6.3 Data representation

- Board: `Uint8Array(N*N*N)`, one byte per cell. Bits 0-2 piece type, bit 3 color, bit 4 has-moved.
- Move: packed into a single 32-bit integer once the piece set stabilizes.
- Direction tables precomputed once at module load.
- Save format: JSON, `{ config, layout, sideToMove, moves: string[] }`. Position reconstructed by replay.

### 6.4 Rendering performance

- Cell markers and pick colliders: two `InstancedMesh` objects, N^3 instances each. Raycast picks the frontmost.
- Pieces: individual meshes, glyphs as billboarded planes from a shared texture atlas.
- Target 60fps at 1440p on integrated graphics. The cost is almost entirely in bloom, so tune the post-processing chain first if frames drop.

---

## 7. Visual direction

Reads as **an instrument, not a toy**: something two people are reading data off of, which happens to be beautiful.

### 7.1 Palette

| Token | Hex | Use |
|---|---|---|
| `--void` | `#04060F` | background base, near-black with a blue bias |
| `--nebula` | `#0C1330` | slow-drifting background gradient |
| `--grid` | `#7E8CA0` | bounding cube, neutral chrome |
| `--lattice` | `#A8B0BC` | idle node bodies, opacity ramped by depth |
| `--ruler` | `#C3CCD9` | axis rulers and tick labels, all three axes |
| `--focus` | `#EAFEFF` | hovered and selected nodes, guide lines |
| `--blue` | `#38E1FF` | **Blue faction** |
| `--blue-core` | `#EAFEFF` | Blue node cores |
| `--red` | `#FF4D5E` | **Red faction** |
| `--red-core` | `#FFE3E6` | Red node cores |
| `--alert` | `#FFB13D` | capture markers, check state |

**Saturation carries meaning.** The only saturated colors anywhere in the scene are the two factions and the amber alert. The cube, the rulers, the idle nodes, and every piece of chrome are neutral gray. This is what makes the position readable at a glance: if it has color, it is a piece or a threat.

This forced two changes when the factions were renamed. The alert color moved from rose to amber, because a red alert marker is indistinguishable from a Red piece. And the axis rulers dropped their per-axis coloring (formerly x cyan, y white, z amber), because cyan and amber now mean Blue and threat. The rulers are differentiated by the large `x` / `y` / `z` glyph at the far end of each, which was always doing most of the work anyway.

Blue versus red survives the common forms of color blindness, unlike red versus green. Faction is also differentiated by **shape**, not only color (Blue nodes solid, Red nodes open wireframe cages), which is what actually guarantees readability under heavy occlusion.

### 7.2 Type

| Role | Face | Use |
|---|---|---|
| Display | Chakra Petch | banners, turn indicator, title |
| Body / UI | IBM Plex Sans | labels, menus, tooltips |
| Data | IBM Plex Mono | coordinates, move log, rulers |

Deliberately not Orbitron, which is the default sci-fi tell. Coordinates go in monospace because they are numeric codes that should align in a column.

### 7.3 The lattice

There is no board. There is a projection volume.

- Bright **wireframe bounding cube** with overshooting corner brackets, like a targeting reticle.
- Faint **cell-center dots**, not a full wireframe. A full N^3 wireframe is unreadable noise.
- **Axis rulers** along the three edges meeting at the origin corner `(0,0,0)`, all three in neutral `--ruler`, billboarded and always legible. Ticks labeled `0` to `N-1`, with a large `x` / `y` / `z` glyph at the far end of each.
- **Guide planes** through the hovered cell so position in all three axes reads at a glance.

### 7.4 Signature element

**The resonance plane.** Selecting a piece illuminates the three orthogonal planes passing through it as holographic grids and projects its coordinate onto the inner walls of the bounding cube, like a targeting solution. It solves depth perception and it is the thing people will remember. Spend the visual budget here and keep everything else quiet.

### 7.5 Occlusion, treated as a first-class problem

Every failed 3D chess implementation failed here, not on rules.

1. **Slice mode.** A slider isolates one y-level (or a range), dimming everything else to 10 percent. Also available on x and z. This is the single most important playability feature in the build.
2. **X-ray highlighting.** Move markers and the selected piece render with `depthTest: false` at reduced opacity when occluded.
3. **Small nodes**, roughly 40 percent of cell diameter, so sight lines stay clear.
4. **Billboarded glyphs**, always facing camera.

---

## 8. Open questions

| # | Question | Blocking? |
|---|---|---|
| ~~Q1~~ | ~~Display coordinates 1..N or 0..N-1?~~ | **Resolved in 0.3: zero-based, origin `(0,0,0)`.** |
| Q2 | Lattice size | No, parameterized per L7 |
| Q3 | King mobility restriction, area-attack pieces, or another solution to the mating problem? | No, answered in phase 1.5 |
| Q4 | Piece set, movement, counts, starting positions | No, answered in phases 1.5 and 2 |
| Q5 | Do pawns exist in any form? | No, answered in phase 2 |
| Q6 | Working title | No |

Nothing on this list blocks Phase 1.

---

## Appendix A — Unlocked candidate ideas

Parked, not proposed. Nothing here is a recommendation.

**Movement families available in a cubic lattice.** Every cell has 26 neighbors, splitting into three groups. Any piece is some subset of these plus range rules.

| Family | Count | Vectors |
|---|---|---|
| Orthogonal | 6 | (±1,0,0), (0,±1,0), (0,0,±1) |
| Face diagonal | 12 | (±1,±1,0), (±1,0,±1), (0,±1,±1) |
| Triagonal | 8 | (±1,±1,±1) |

**Candidate piece concepts.**

- **Triagonal slider** ("Unicorn," from Raumschach 1907). Warning worth remembering when we test it: a pure triagonal slider is parity-locked and can only ever reach about a quarter of the lattice. It cannot reach an orthogonally adjacent cell in any number of moves. Compounding it with a single orthogonal step fixes this.
- **Face-diagonal slider.** Locked to one parity of (x+y+z), exactly like a light-squared bishop, except the parity class is half the lattice.
- **3D knight**, leaping every permutation of (±1, ±2, 0): 24 targets. Expensive for the AI.
- **Area attacker.** Attacks a volume or plane rather than rays. Unexplored, and the most promising direction for both the mating problem and for making this game standalone.
- **Denial piece.** Makes cells unenterable without occupying or capturing.

**Thematic naming**, if the game diverges enough to want its own vocabulary: Core, Nova, Cruiser, Prism, Skiff, Vector, Probe.

---

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-08-14 | Initial draft: full piece set, four army layouts, rule analysis |
| 0.4 | 2026-08-14 | Factions renamed from White/Black to **Blue/Red** everywhere, internal and external (L8). Blue holds `z = 0` and moves first. Palette reworked: alert color moved rose to amber, axis rulers made neutral, saturation reserved for factions and threats. |
| 0.3 | 2026-08-14 | Coordinate system locked to zero-based with true origin at `(0,0,0)`. Display and engine coordinates unified (no conversion layer). Added index and world-space formulas. Q1 resolved. Phase 1 / 1.5 build brief issued as a companion document. |
| 0.2 | 2026-08-14 | Restructured around Locked / Open / Deferred. Piece definitions and army layouts unlocked and moved to appendix. Added escape-count and branching-factor analysis. Added phase 1.5 piece laboratory. Coordinate origin locked to White's bottom-left-near corner. AI confirmed as a locked goal. |

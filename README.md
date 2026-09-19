# Bloq Studio

A **Scratch-familiar visual programming studio** with a real block runtime and a signature
one-tap **Builds** system. Original implementation and artwork — not affiliated with,
nor claiming to be, Scratch / the Scratch Foundation / MIT.

**Live (runs in-browser):** https://claude.ai/artifact/Fc3ZwzukQYQo13Sxhm4YAQ

## Files
| File | Role |
|---|---|
| `bloq-studio.html` | Page shell + engine: block registry, generator-based runtime, canvas stage, mascot art. |
| `bloq-ui.js` | Palette, DOM block rendering, drag-and-drop with jigsaw snapping, sprite panel, persistence, shortcuts. |
| `bloq-builds.js` | Builds library (24 systems) + intelligent insertion engine, Ctrl-K command palette, smart help, init. |
| `bloq-standalone.html` | **Generated** single-file build (all three inlined). Double-click to run offline; also what's published as the Artifact. |

Rebuild the standalone after editing sources:
```bash
node -e 'const fs=require("fs");let h=fs.readFileSync("bloq-studio.html","utf8");h=h.replace(`<script src="bloq-ui.js"></script>`,()=>"<script>\n"+fs.readFileSync("bloq-ui.js","utf8")+"\n</script>").replace(`<script src="bloq-builds.js"></script>`,()=>"<script>\n"+fs.readFileSync("bloq-builds.js","utf8")+"\n</script>");fs.writeFileSync("bloq-standalone.html",h)'
```
(Note: use a *function* replacer — a string replacement mangles `$$` into `$`.)

---

## Research grounding (Phase 0–2)
Verified against the Scratch Wiki rather than memory:
- **Stage**: 480×360, origin centered, x ∈ [−240, 240], y ∈ [−180, 180], +y up.
- **Direction**: 0 = up, 90 = right (default), 180 = down, −90 = left; clockwise-positive.
- **Block shapes** (6): hat, stack, boolean (hexagon), reporter (rounded), C-block, cap — shapes double as connectors.
- **Categories & colors** (9 + lists): Motion `#4c97ff`, Looks `#9966ff`, Sound `#cf63cf`, Events `#ffbf00`,
  Control `#ffab19`, Sensing `#5cb1d6`, Operators `#59c059`, Variables `#ff8c1a`, Lists `#ff661a`, My Blocks `#ff6680`.
- **File model**: sb3 = targets[] (stage + sprites), each with blocks/variables/lists/costumes/sounds; blocks carry opcode/inputs/fields/next.

## Architecture (Phase 3–5)
- **Data model** — `Project → sprites[] + stage`; each sprite holds costumes/sounds/scripts + local vars; globals live on the stage. Blocks are a nested JS tree (stacks are arrays, C-blocks hold branch arrays, reporters nest inside `inputs`). Fully JSON-serializable.
- **Runtime** — cooperative **generator-based green threads** (matches Scratch's concurrency): each hat script is its own restartable thread; the scheduler steps every thread once per animation frame; `wait`/loops/`glide`/`broadcast and wait` yield. This is why loops run one iteration per frame, like Scratch.
- **Renderer** — DOM blocks (CSS jigsaw shapes) for the editor; **canvas** for the stage (sprites, say/think bubbles, variable monitors, graphic effects).
- **Builds engine** — inspects the project, **reuses** matching sprites/variables, resolves name conflicts (`uniqueName`), and tags generated scripts to **prevent duplicate installs**. Every Build emits real, inspectable, editable blocks.

## Feature inventory (built)
- ~90 blocks across all 9 categories + Lists; variables (global/local) with stage monitors; lists; **My Blocks** (custom blocks with `%s`/`%b` args).
- Drag from palette, snap/detach/reorder, drop reporters into slots, C-block nesting, duplicate/delete, right-click menu, pan + zoom, clean-up.
- Runtime: green flag, per-sprite click, key, broadcast + broadcast-and-wait, clones, `ask and wait`, timer, sensing, operators, sound (WebAudio), costume/backdrop switching, graphic effects, glide.
- Multiple sprites (add / duplicate / delete / props), original **dog mascot "Rex"** drawn as vector art with a 2-frame walk cycle, backdrops.
- **24 Builds** across Games / Player / Systems / Enemies / UI / Effects — with config panels and sprite-picker intelligence. **My Builds** saves the current sprite's system for reuse.
- **Shift+0** → Builds. **Ctrl+K** → quick command / natural-language build search. Smart-help suggestions. Beginner / Advanced modes.
- Autosave (localStorage), JSON import, undo/redo, full shortcut set (Z/Y/C·duplicate/Delete/Space/…), light + dark themes.

## Known limitations / deferred
- Costume/sound *editors* are minimal (costumes are emoji or the built-in mascot art; sounds are tone beeps).
- No pen extension, no sprite-outline pixel collision (uses radius-distance touching), no cloud variables.
- Export downloads a `.json` file when run as a standalone; inside the embedded Artifact it copies the project JSON to the clipboard (the viewer sandbox blocks file downloads). Autosave covers session-to-session continuity.

## Shortcuts
`Shift+0` Builds · `Ctrl+K` commands · `Ctrl+Z`/`Ctrl+Y` undo/redo · `Space` run/stop · right-click a block for duplicate/delete.

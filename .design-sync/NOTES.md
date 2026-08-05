# design-sync notes — @pms/ui

Repo-specific gotchas for syncing `packages/ui` to Claude Design. Read before re-syncing.

## Build / toolchain
- **Shape: package, synth-entry.** `packages/ui` has no build and no `dist/` — `main`/`types` point at `src/index.ts`. The converter synthesizes the entry from `src/` and derives the export list (PascalCase `Button`, `Badge`; `cn` is excluded as lowercase). There is no shipped `.d.ts`, so prop contracts come from ts-morph over source + `cfg.dtsPropsFor`.
- **`--node-modules apps/web/node_modules`**, NOT `packages/ui/node_modules`. The package's own node_modules is missing `react-dom` (peer only) and the UMD builds the preview vendor needs. `apps/web/node_modules` has react, react-dom (with umd), clsx, and tailwind-merge, and resolves `@pms/ui` via workspace symlink.
- **`Button.d.ts` is hand-curated via `cfg.dtsPropsFor.Button`.** Source `ButtonProps extends React.ButtonHTMLAttributes`; synth-entry only auto-extracted variant/size/className/id/style/children, dropping `onClick`/`disabled`/`type`. The override restores a practical subset. If the source Button API changes, update `dtsPropsFor.Button`. Badge auto-extracts fully — no override.

## Styling (Tailwind DS — CSS is generated, not shipped)
- The DS is Tailwind-utility-based and ships **no compiled CSS**. `cfg.cssEntry` points at `packages/ui/.ds-styles.css`, which is **generated, not committed** (gitignored). Regenerate it before every build:
  ```sh
  apps/web/node_modules/.bin/tailwindcss -c .design-sync/assets/tw.config.cjs -i .design-sync/assets/input.css -o packages/ui/.ds-styles.css --minify
  ```
  `cssEntry` must live **inside `packages/ui`** (the converter bounds it to PKG_DIR), which is why the compiled file sits there rather than under `.design-sync/`. The tailwind source (`tw.config.cjs`, `input.css`) IS committed under `.design-sync/assets/`.
- **`brand-*` is defined by us, not by the app.** `Button` uses `bg-brand-600` / `hover:bg-brand-700`, but `apps/web/tailwind.config.ts` defines **no `brand` scale** (it uses `coral`/`--color-accent`). Per `apps/web/CLAUDE.md`, `brand-500/600/700` are the documented brand tokens, so `tw.config.cjs` defines a `brand` scale from the WARM_CLAY accent (`brand-600 = #E0532B`, `brand-700 = #C2431F`, `brand-800 = #9E3417`). In the real app these utilities currently resolve to nothing (unstyled primary button) — the sync makes the intended branding visible.
- **Fonts: system stack, deliberately.** The app declares `"Hanken Grotesk"` as its sans family but **never actually loads it** (`index.css` only `@import`s Inter). To match real rendering — and because the woff2 isn't in-repo — `tw.config.cjs` carries no `fontFamily` override, so previews use the system stack. The intended brand font is noted in `conventions.md` for the design agent. Do NOT treat `[FONT_MISSING]` as unresolved unless someone adds the actual font to the repo.

## Previews
- Both components have authored previews in `.design-sync/previews/` (committed, user-owned). Layout scaffolding uses **inline styles**, not Tailwind classes, because `.ds-styles.css` only contains the utilities Button/Badge themselves use (it scans `packages/ui/src` only) — flex/gap/spacing utilities are not in the bundle.

## Verification
- Render check was **skipped** on the first sync (user chose browser review over a ~200MB Playwright/Chromium install). Previews were reviewed via `.review.html`, not machine-graded. If Playwright gets installed later, drop `--no-render-check` to machine-verify.

## Re-sync risks (watch-list)
- `.ds-styles.css` is regenerated, not committed — a re-sync that forgets the tailwind compile step above ships a **stale or missing** stylesheet. Always recompile first.
- The `brand` scale in `tw.config.cjs` is an interpretation, not sourced from the app. If the app ever adds a real `brand` scale (or renames the accent), reconcile `tw.config.cjs` against it.
- `dtsPropsFor.Button` is hand-maintained and will silently drift if the source Button API changes.
- Target project: `00df7545-7ce2-46dc-a20e-75548b72c1da` (PMS UI Design System). NOTE: an earlier run reused an empty leftover project (615f717a…) that was transient and vanished server-side — never reuse the auto-listed empty "Design System" leftovers; create a fresh project.

## Known render warns
- `[FONT_MISSING]` — resolved by dropping the font override (see Styling). Should no longer fire.
- `[RENDER_SKIPPED]` — expected while the render check is skipped (no Playwright).

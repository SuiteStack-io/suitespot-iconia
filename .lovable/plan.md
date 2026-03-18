
Root cause found:
- The publish build is executing Vite from the shared template path (`/opt/template-node-modules/vite/...`), not from your project-local install.
- That template Vite instance is missing its `rollup` resolution path, causing `ERR_MODULE_NOT_FOUND`.
- In your current `package.json`, `rollup` is in `dependencies`, but `vite` is still in `devDependencies`, so publish can still fall back to template Vite instead of a guaranteed local one.

Implementation plan:

1) Make the build toolchain explicit project dependencies
- In `package.json`, move these from `devDependencies` to `dependencies`:
  - `vite`
  - `@vitejs/plugin-react-swc`
  - `lovable-tagger`
- Keep `rollup` explicitly declared in `dependencies` (already present) so Vite can always resolve it.

2) Keep dependency sources consistent for publish
- Regenerate and commit lockfiles so publish uses the updated graph cleanly:
  - `bun.lock` (and `bun.lockb` if this repo still tracks it)
  - `package-lock.json`
- This avoids stale resolution where publish still uses the old dependency topology.

3) Verify publish path is no longer template-only
- Re-run publish and confirm the build no longer throws:
  - `Cannot find package 'rollup' imported from /opt/template-node-modules/vite/dist/node/cli.js`
- Expected outcome: build completes successfully and publish proceeds.

Files to change:
- `package.json`
- `bun.lock` (and possibly `bun.lockb`)
- `package-lock.json`

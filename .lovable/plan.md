

## Fix: Build Failure — Missing `rollup` Package

### Diagnosis
The build error `Cannot find package 'rollup'` occurs because the build infrastructure resolves Vite from a shared template path (`/opt/template-node-modules/`) where `rollup` isn't installed alongside it. Vite 5 depends on Rollup as a peer/transitive dependency, but it's not being resolved correctly in this environment.

### Fix
Add `rollup` as an explicit devDependency in `package.json`. This ensures it's installed in the project's own `node_modules` and available to Vite during the build.

**File: `package.json`**
- Add `"rollup": "^4.40.0"` to `devDependencies`

This is a one-line addition. No other changes needed.


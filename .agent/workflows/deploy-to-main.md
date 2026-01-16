---
description: Migration workflow from Stage to main (Production)
---

This guide outlines the professional workflow for merging verified changes from the `Stage` branch into the `main` branch.

### 1. Finalize Staging
Ensure your current work is fully committed and the branch is synchronized with any remote changes.
// turbo
```powershell
git checkout Stage
git pull origin Stage
git add .
git commit -m "chore: final preparations for production merge"
```

### 2. Prepare the Production Branch
Switch to `main` and ensure it has the latest production state.
// turbo
```powershell
git checkout main
git pull origin main
```

### 3. Integrate Changes
Merge the `Stage` branch into `main`. Using `--no-ff` (no-fast-forward) is recommended to maintain a clear merge commit in history.
// turbo
```powershell
git merge Stage --no-ff -m "chore: merge staging updates to production"
```

> [!CAUTION]
> If conflicts occur, resolve them in your IDE, then run `git add .` and `git commit` to finalize.

### 4. Deploy to Production
Push the integrated changes to the remote repository. This typically triggers the CI/CD pipeline.
// turbo
```powershell
git push origin main
```

### 5. Post-Deployment Cleanup
Switch back to `Stage` to resume development.
// turbo
```powershell
git checkout Stage
```

---
**Standard Practice Reminders:**
- Never merge to `main` if the build is failing on `Stage`.
- Always run a final local build (`npm run build`) before pushing to production.

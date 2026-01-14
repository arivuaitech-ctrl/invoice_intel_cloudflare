---
description: How to migrate changes from Stage to main
---

Follow these steps to safely merge your staging changes into the production branch.

### 1. Ensure Stage is clean
Make sure all your changes are committed on the `Stage` branch.
```powershell
git add .
git commit -m "Your final staging changes"
```

### 2. Switch to the main branch
// turbo
```powershell
git checkout main
```

### 3. Merge Stage into main
// turbo
```powershell
git merge Stage
```

### 4. Push to production
If you are using a remote repository (like GitHub), push the changes.
// turbo
```powershell
git push origin main
```

### 5. Switch back to Stage
Continue development on staging.
// turbo
```powershell
git checkout Stage
```

> [!TIP]
> If you encounter merge conflicts, Git will pause and ask you to resolve them before finishing the merge.

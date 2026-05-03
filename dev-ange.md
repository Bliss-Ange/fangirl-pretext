# Dev Notes — Angelyn

## Branch Strategy

### Permanent Branches
| Branch | Purpose |
|---|---|
| `main` | Angelyn profile — source of truth for all code/style changes |
| `baekhyun` | Baekhyun profile — permanent parallel branch, never merges back to main |

These two branches live **forever in parallel**. They are never fully merged together.

---

### For Style / Code Changes
Always work off `main`, not directly on `baekhyun`.

```bash
git checkout main
git checkout -b feature/your-change-name
# make your changes
git push
# open PR → main, merge, delete feature branch
```

Then bring the changes down to `baekhyun`:
```bash
git checkout baekhyun
git merge main
# content.ts is protected by .gitattributes — no conflict
```

---

### For Content-Only Changes
Edit `content.ts` directly on the relevant branch. No feature branch needed.

- `main` → edit Angelyn's `SAMPLE_TEXT` and `PAGE_CONFIG`
- `baekhyun` → edit Baekhyun's `SAMPLE_TEXT` and `PAGE_CONFIG`

---

### Merge Conflict Protection (`content.ts`)
`baekhyun` has a `.gitattributes` that prevents `content.ts` from being overwritten when merging from `main`:

```
src/app/content.ts merge=ours
```

This requires the following git config (run once per machine):
```bash
git config merge.ours.driver true
```

> `--ours` = keep the current branch's version  
> `--theirs` = keep the incoming branch's version

---

### ⚠ Never do a PR from `baekhyun` → `main`
That would overwrite Angelyn's `content.ts` with Baekhyun's. The two branches only flow in one direction:

```
main  ──────────────────────────────►  (style/code changes live here)
          │           │
          ▼           ▼
       baekhyun  ◄── merge main only
```

# AGENTS.md

Rules every AI agent working in this repo must follow.

---

## BUILD_LOGS.md — mandatory after every session

After completing any meaningful work (feature, fix, refactor, investigation), write a log entry in `BUILD_LOGS.md`.

**Critical rule: entries are prepended, not appended.**

The file keeps newest entries at the top so agents never need to read the whole file to add a new one. The procedure:

1. Open `BUILD_LOGS.md`.
2. Find the marker line: `<!-- NEW ENTRIES GO HERE -->`
3. Place your cursor at the **start of that marker line**.
4. Press Enter twice to create a blank line above the marker.
5. Move up two lines and write your entry there.

Or with the Edit tool — replace the marker with your entry followed by a blank line and then the marker again:

```
<!-- NEW ENTRIES GO HERE -->
```
→
```
## YYYY-MM-DD — <short title>

- What was done
- Why it was done
- Any caveats or follow-ups

<!-- NEW ENTRIES GO HERE -->
```

### Entry format

```markdown
## YYYY-MM-DD — <short title>

- Bullet summary of what changed
- Why (root cause, user request, spec gap, etc.)
- Any known caveats or follow-up items
```

### When to write

- After completing a feature or fix
- After an investigation that reached a conclusion (even if no code changed)
- After a spec or doc update that changes direction
- **Not** for tiny one-liner fixes or formatting changes

### What NOT to do

- Do **not** append to the bottom of the file.
- Do **not** read the entire file just to add an entry — find the marker and prepend.
- Do **not** skip writing a log because the change "was small."

# Versioning policy

This repository uses **semantic versioning** (`MAJOR.MINOR.PATCH`) with meanings aligned to delivery milestones:

| Bump | When | Examples |
| ---- | ---- | -------- |
| **MAJOR** | Sprint milestone completed | Sprint 1 (Entra + routing) ships as **3.0.0** |
| **MINOR** | Phase delivered within an active sprint | Phase A / B checkpoints such as **3.1.0**, **3.2.0** |
| **PATCH** | Meaningful unit-test slice or defect fix merged for that phase | **3.1.1**, **3.1.2** |

Patch bumps are **not** tied to every individual test assertion — use them when a coherent test or fix batch lands.

Always update **`package.json`**, **`CHANGELOG.md`**, **`change.md`**, and tag **`vX.Y.Z`** when releasing externally.

---
paths:
    - 'tactical/**/*'
---

# Tactical AI Kill Chain Framework

Loaded only when Claude reads files under `tactical/`. Provides high-level pointer to the full agent context — read the linked file BEFORE doing tactical work.

`tactical/` contains 82 Python modules wrapping Kali tools, 13 workflow playbooks, a TypeScript runner.

**READ `tactical/CLAUDE.md` before any tactical/security work** — it has the full module inventory, workflow list, schema, execution rules.

```bash
npx tsx tactical/modules/module_runner.ts <module> [args...]   # execute
npx tsx tactical/modules/module_runner.ts --runner-help        # list 82 modules
cat tactical/workflows/<ID>_<name>.md                          # read playbook
```

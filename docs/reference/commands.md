# Command Reference

Every command available in Agent Tools Loadout, with descriptions and usage context.

---

## Sidebar Actions

These commands appear as icons in the sidebar title bar.

### Refresh

```
Agent Tools Loadout: Refresh
```

Re-syncs all configured repositories (pulls latest changes) and rescans for content. Repositories where `HEAD` hasn't changed are skipped for performance.

**Icon:** `$(refresh)` — sidebar title bar

---

### Load Selected

```
Agent Tools Loadout: Load Selected
```

Equips all checked items in the tree view. Opens a quick pick to select the target agent, then writes each item as a separate file.

**Icon:** `$(cloud-download)` — sidebar title bar

---

### Search

```
Agent Tools Loadout: Search
```

Opens a text input to search across all loaded content. Matches against name, description, tags, tech stack, file path, author, and type. Multiple terms use AND logic.

**Icon:** `$(search)` — sidebar title bar

---

### Clear Search

```
Agent Tools Loadout: Clear Search
```

Removes the active search filter and restores the full content tree.

**Icon:** `$(close)` — sidebar title bar (visible only when a search is active)

---

### Filter by Type

```
Agent Tools Loadout: Filter by Type
```

Opens a quick pick to filter the tree by content type: Instructions, Skills, or Sub-agents.

**Icon:** `$(filter)` — sidebar title bar (visible when no type filter is active)

---

### Clear Type Filter

```
Agent Tools Loadout: Clear Type Filter
```

Removes the active type filter and restores the full content tree.

**Icon:** `$(filter-filled)` — sidebar title bar (visible when a type filter is active)

---

### Add Source

```
Agent Tools Loadout: Add Source
```

Opens a step-by-step wizard to add a new Git repository source:

1. Enter repository URL (validated against origin policy if active)
2. Optionally specify a branch
3. Optionally specify a subdirectory to scan
4. Optionally set a display name

**Icon:** `$(add)` — sidebar title bar

---

### Remove Source

```
Agent Tools Loadout: Remove Source
```

Opens a quick pick to select which source to remove. Removes the source from settings and deletes its cached clone.

Organization-managed (preloaded) sources are excluded from the removal list.

**Icon:** `$(remove)` — sidebar title bar

---

## Context Menu Actions

These commands appear when right-clicking items in the sidebar tree.

### Load

```
Agent Tools Loadout: Load
```

Equips a single content item. Opens a quick pick to select the target agent, then writes the file to the workspace.

Also appears as an **inline icon** (`$(cloud-download)`) on content items in the tree.

---

### Preview

```
Agent Tools Loadout: Preview
```

Opens the content preview panel showing full content, metadata badges, git history, and description.

---

### Remove Source (context menu)

Right-click a source node to remove it directly. Same behavior as the title bar remove action.

---

## Command Palette Only

These commands are available only through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

### Unequip

```
Agent Tools Loadout: Unequip
```

Removes equipped files from your workspace:

1. Select the target agent
2. The extension scans the agent's directories for equipped files
3. Select which files to remove (multi-select)
4. Selected files are deleted from the workspace

---

### Convert

```
Agent Tools Loadout: Convert
```

Converts an existing agent configuration file to another format:

1. Select the **source** agent (format to convert from)
2. Select the **target** agent (format to convert to)
3. The source file is read, normalized, and written in the target format

See [Supported Agents](agents.md#convert-between-formats) for the full conversion matrix.

---

### Purge Cache

```
Agent Tools Loadout: Purge Cache
```

Deletes all cached repository clones and forces a full re-clone on the next refresh. Use this when:

- A repository's history has been rewritten
- You suspect cache corruption
- You want to free disk space

---

### Set Sensitivity

```
Agent Tools Loadout: Set Sensitivity
```

Opens a quick pick to change the content detection sensitivity:

| Level | Description |
|:------|:------------|
| **Low** | Show almost all files with matching extensions |
| **Medium** | Require at least one structural signal |
| **High** | Require strong signals (frontmatter + content patterns) |

See [Configuration — Sensitivity](configuration.md#sensitivity) for details.

---

## Summary Table

| Command | Palette | Sidebar | Context Menu |
|:--------|:--------|:--------|:-------------|
| Refresh | :white_check_mark: | :white_check_mark: | — |
| Load | :white_check_mark: | — | :white_check_mark: (inline + menu) |
| Load Selected | :white_check_mark: | :white_check_mark: | — |
| Preview | :white_check_mark: | — | :white_check_mark: |
| Search | :white_check_mark: | :white_check_mark: | — |
| Clear Search | :white_check_mark: | :white_check_mark: | — |
| Filter by Type | :white_check_mark: | :white_check_mark: | — |
| Clear Type Filter | :white_check_mark: | :white_check_mark: | — |
| Add Source | :white_check_mark: | :white_check_mark: | — |
| Remove Source | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Unequip | :white_check_mark: | — | — |
| Convert | :white_check_mark: | — | — |
| Purge Cache | :white_check_mark: | — | — |
| Set Sensitivity | :white_check_mark: | — | — |

# Configuration

Settings, sources, and tuning options for Agent Tools Loadout.

---

## Settings Overview

All settings are stored in VS Code's global (machine) scope and can be edited via `settings.json` or the Settings UI.

| Setting | Type | Default | Description |
|:--------|:-----|:--------|:------------|
| `agentLoadout.sources` | array | `[]` | Git repository sources to scan |
| `agentLoadout.defaultAgent` | string | `"cursor"` | Default target agent when equipping |
| `agentLoadout.sensitivity` | string | `"low"` | Content detection strictness |

---

## Sources

### Adding sources via UI

Click the **+** button in the sidebar title bar. You'll be prompted for:

1. **Repository URL** — HTTPS or SSH format
2. **Branch** *(optional)* — defaults to the remote's default branch
3. **Subdirectory** *(optional)* — scan only a specific folder
4. **Display name** *(optional)* — custom label in the sidebar

### Adding sources via settings.json

```jsonc
{
  "agentLoadout.sources": [
    {
      "type": "repo",
      "url": "https://github.com/your-org/instructions.git"
    },
    {
      "type": "repo",
      "url": "git@github.com:your-org/private-repo.git",
      "branch": "main",
      "path": "agent-content",
      "name": "Team Standards"
    }
  ]
}
```

### Source properties

| Property | Required | Description |
|:---------|:---------|:------------|
| `type` | Yes | Always `"repo"` (only supported type) |
| `url` | Yes | Git repository URL (HTTPS or SSH) |
| `branch` | No | Branch to clone; omit for remote default |
| `path` | No | Subdirectory to scan; omit for repo root |
| `name` | No | Display name; auto-extracted from URL if omitted |

### Authentication

The extension uses your existing Git configuration for authentication:

- **SSH keys** — for `git@...` URLs
- **Credential helpers** — for HTTPS URLs
- **Personal access tokens** — configured via credential helper or `.netrc`

No credentials are stored by the extension.

### Removing sources

Click the **-** button in the sidebar title bar, or right-click a source node and select **Remove Source**. This removes the source from settings and deletes its cached clone.

!!! note
    Organization-managed (preloaded) sources cannot be removed. They show a lock icon and `(org)` badge. See the [Enterprise](../enterprise.md) page for details.

---

## Default Agent

```jsonc
{
  "agentLoadout.defaultAgent": "cursor"  // or "copilot" or "claude"
}
```

This controls which agent is pre-selected when equipping content. You can always change the agent during the equip flow.

**Options:**
- `"cursor"` — Cursor AI
- `"copilot"` — GitHub Copilot
- `"claude"` — Claude Code

---

## Sensitivity

```jsonc
{
  "agentLoadout.sensitivity": "low"  // or "medium" or "high"
}
```

Controls how strictly files must match agent instruction patterns to appear in the content browser. This affects the minimum [content score](../guide/features.md#content-scoring) required.

### Levels

| Level | Threshold | Best for |
|:------|:----------|:---------|
| **Low** | 10 points | Repos dedicated to agent content — show almost everything |
| **Medium** | 40 points | Mixed repos — require at least one structural signal |
| **High** | 70 points | Large repos with lots of Markdown — only show files with strong signals |

### Changing sensitivity

You can change sensitivity via the Command Palette:

```
Agent Tools Loadout: Set Sensitivity
```

Or edit `agentLoadout.sensitivity` in your settings directly.

!!! tip
    Start with **low** sensitivity. If you see too many irrelevant files, increase to **medium**. Use **high** only for large repos where most Markdown files are not agent instructions.

---

## Cache Management

Cloned repositories are stored in a local cache directory. To force a fresh re-clone of all sources:

```
Command Palette → Agent Tools Loadout: Purge Cache
```

This deletes all cached repositories and triggers a full re-clone on the next refresh.

---

## Equipped State

The extension tracks which items are loaded into your workspace using VS Code's `workspaceState` storage. This data is per-workspace and includes:

- **File path** — where the equipped file was written
- **Equipped timestamp** — when you loaded it
- **Last modified date** — the git date at the time of loading (for stale detection)

This state is automatically pruned on each refresh — if you manually delete an equipped file, the tracking record is cleaned up.

# Features

A detailed overview of everything Agent Tools Loadout can do.

---

## Content Browser

The sidebar tree view organizes all discovered content by source repository and content type.

### Tree structure

```
my-team-rules (12 items)
├── Instructions
│   ├── ☑ Clean Code Standards
│   ├── ☐ API Design Guidelines
│   └── ☐ Testing Requirements
├── Skills
│   ├── ☐ PR Security Review
│   └── ☐ Database Migration Helper
└── Sub-agents
    └── ☐ Code Review Expert

community-prompts (5 items)
└── Skills
    ├── ☐ React Component Generator
    └── ☐ Git Commit Writer
```

- **Source nodes** show the repository name and item count
- **Type groups** appear when a source has multiple content types
- **Content items** have checkboxes for batch selection
- Items display author name and relative date when git metadata is available

### Content type icons

| Icon | Type | Description |
|:-----|:-----|:------------|
| :material-book-open-variant: `book` | Instructions | Rules, guidelines, coding standards |
| :material-auto-fix: `wand` | Skills | Commands, prompts, specialized capabilities |
| :material-account: `person` | Sub-agents | Agent personas, delegated roles |

---

## Rich Preview Panel

Click any content item to open a preview panel showing:

- **Name and description** from front-matter metadata
- **File path** in the source repository
- **Metadata badges** — content type, tags, tech stack, difficulty level
- **Author and version** if specified in front-matter
- **Git history** — last author, date, and commit message
- **Full content** with syntax highlighting

The preview panel reuses the same tab for each file, keeping your editor clean.

---

## Equipped State Tracking

After equipping content, the extension tracks what's loaded in your workspace:

### Loaded indicator

Equipped items show:
- A **blue checkmark** icon replacing the content type icon
- `(loaded)` label in the item description
- Context value changes to `content-loaded`

### Stale detection

When the source repository is updated after you equipped an item:
- A **warning icon** replaces the checkmark
- Description changes to `updated since loaded`
- This means the source file has a newer git date than when you loaded it

To resolve a stale item, simply re-equip it — the file is overwritten with the latest version and the record is updated.

### Pruning

On each refresh, the extension checks if equipped files still exist on disk. If a file was manually deleted, its tracking record is automatically removed.

---

## Search

Search across all loaded repositories using the search button in the sidebar title bar.

### How search works

- Enter one or more search terms separated by spaces
- All terms must match (**AND** logic)
- Search is **case-insensitive**
- Results update with a 250ms debounce

### Searchable fields

| Field | Example |
|:------|:--------|
| Name | `"Clean Code Standards"` |
| Description | `"guidelines for writing clean code"` |
| Content type | `"instructions"`, `"skill"`, `"subagent"` |
| File path | `"rules/typescript"` |
| Author | `"alice"` |
| Tags | `"react"`, `"testing"` |
| Tech stack | `"typescript"`, `"nextjs"` |
| Level | `"advanced"`, `"beginner"` |

### Search example

Searching for `react typescript` will match items that contain **both** "react" and "typescript" in any combination of the searchable fields.

### Clearing search

Click the **X** button in the sidebar title bar, or run **Agent Tools Loadout: Clear Search** from the Command Palette.

---

## Type Filter

Filter the tree to show only one content type at a time.

1. Click the **filter icon** in the sidebar title bar
2. Select: **Instructions**, **Skills**, or **Sub-agents**
3. The tree updates to show only matching items

The filter icon changes to filled when a filter is active. Click it again to clear.

!!! note
    Search and type filters can be combined. For example, filter to "Skills" and search for "react" to find React-specific skills across all sources.

---

## Cross-Agent Format Conversion

### Equip conversion

When you equip content, the extension automatically converts it to the target agent's native format:

- **Frontmatter** is rewritten for the target agent
- **File extension** matches the agent's convention
- **Directory placement** follows the agent's expected structure

See [Supported Agents](../reference/agents.md) for the full format specification.

### Standalone conversion

The **Convert** command converts an existing agent configuration file to another format:

1. Open the Command Palette
2. Run **Agent Tools Loadout: Convert**
3. Select the source agent (the format you're converting from)
4. Select the target agent (the format you want)

The source file is read, normalized, and written in the target format. Both files remain in your workspace.

**Example conversions:**
- `.cursorrules` → `.github/copilot-instructions.md`
- `.github/copilot-instructions.md` → `CLAUDE.md`
- `CLAUDE.md` → `.cursorrules`

---

## Content Scoring

The extension uses a point-based scoring system to determine which files are likely instruction content. This happens automatically during scanning.

### Score breakdown

| Signal | Points | Description |
|:-------|:-------|:------------|
| Known filename | +30 | Files like `.cursorrules`, `claude.md`, `copilot-instructions.md` |
| Inside instruction directory | +30 | Files in `rules/`, `skills/`, `agents/`, `.github/`, `.claude/`, etc. |
| Filename pattern | +20 | Extensions like `.agent.md`, `.prompt.md`, `.mdc` |
| Front-matter `type` field | +40 | Strongest signal — explicit type declaration |
| Front-matter `description` field | +10 | Indicates structured metadata |
| Content heuristics (2+ matches) | +20 | Patterns like "you are a", "## instructions", "your role is" |
| Content heuristics (1 match) | +10 | Single pattern match |

**Maximum score: 100 points**

### Sensitivity thresholds

The [sensitivity setting](../reference/configuration.md#sensitivity) determines the minimum score required for a file to appear in the browser:

| Level | Threshold | What gets through |
|:------|:----------|:------------------|
| **Low** | 10 points | Almost everything — any file with a matching extension in the repo |
| **Medium** | 40 points | Files with at least one structural signal (directory, frontmatter, or pattern) |
| **High** | 70 points | Only files with strong signals (explicit type + content patterns) |

---

## Caching and Performance

### Shallow clones

Repositories are cloned with `--depth=1` to minimize download size and time.

### Worker thread

Content scanning runs in a separate worker thread so the VS Code UI stays responsive during large scans.

### Scan caching

After the initial scan, subsequent refreshes skip re-scanning repos where `HEAD` hasn't changed. Use **Purge Cache** to force a full re-clone.

### Parallel sync

All configured repositories are cloned and pulled concurrently.

### Single git log

Git metadata (author, date, commit message) is collected with a single `git log` call per repo, avoiding N+1 query patterns.

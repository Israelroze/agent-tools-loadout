# Agent Tools Loadout

**Browse, preview, and equip AI instruction content from Git repositories — for Cursor, GitHub Copilot, and Claude.**

Agent Tools Loadout solves **instruction fragmentation** across AI coding agents. Instead of manually copying rule files between projects, you can browse content from Git repositories, preview it, and equip it to any supported agent — with automatic format conversion.

---

## Security Warning

**Always review content before equipping it.** AI instruction files (skills, sub-agent personas, rules) can contain prompt injection, hidden instructions, or malicious directives that alter your AI agent's behavior in harmful ways — exfiltrating code, introducing vulnerabilities, or running unintended commands.

Before equipping any content from a public or untrusted repository:

- **Use the preview panel** to read the full content of every file
- **Look for hidden instructions** — obfuscated text, base64-encoded strings, or instructions that contradict the file's stated purpose
- **Be cautious with sub-agent personas** — these define how your AI behaves and can be crafted to act against your interests
- **Prefer repositories you trust** — from your own organization, well-known authors, or repos you've audited

Treat AI instruction files with the same caution you'd give to running someone else's code.

---

## Features

### Browse content from Git repositories

Add one or more Git repository URLs. Agent Tools Loadout clones them locally, scans for instruction files, and displays everything in a sidebar tree view — organized by source and content type.

### Content type classification

Content is automatically classified into three types:

| Type | Icon | Description |
|------|------|-------------|
| **Instructions** | Book | General rules, guidelines, coding standards |
| **Skills** | Wand | Specialized capabilities, prompts, commands |
| **Sub-agents** | Person | Agent personas, delegated roles |

Classification uses front-matter metadata, file path patterns, and filename conventions. You can also filter the tree by content type.

### Preview before equipping

Click any item to see a rich preview panel showing:

- Full content with syntax highlighting
- Metadata badges (content type, tags, tech stack, level)
- Git info (last author, date, commit message)
- File path and description

### Multi-select and batch equip

Check multiple items in the tree, pick a target agent, and equip them all at once. Each item becomes a separate file in the agent's rules directory.

### Cross-agent format conversion

Equip content from any source to any target agent. Agent Tools Loadout automatically converts between formats:

| Agent | Rules Directory | File Extension | Supported Types |
|-------|----------------|----------------|-----------------|
| **Cursor** | `.cursor/rules/` | `.mdc` | Instructions only |
| **GitHub Copilot** | `.github/instructions/` | `.instructions.md` | All types |
| **Claude** | `.claude/rules/` | `.md` | All types |

Each equipped file includes agent-native frontmatter (e.g., `description` for Cursor, `applyTo` for Copilot, `description` for Claude).

### Search across all repos

Search content across all loaded repositories using the search button in the sidebar title bar. Searches content names, descriptions, tags, tech stack, file paths, and authors. Multiple search terms use AND logic.

---

## Getting Started

### 1. Install

**From the Marketplace:**

Search for **"Agent Tools Loadout"** in the VS Code Extensions sidebar (`Ctrl+Shift+X` / `Cmd+Shift+X`).

**From a `.vsix` file:**

1. Download the latest `.vsix` from the [GitHub releases](https://github.com/Israelroze/agent-tools-loadout/releases)
2. Open VS Code
3. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
4. Run **Extensions: Install from VSIX...**
5. Select the downloaded `.vsix` file

**From the command line:**

```
code --install-extension agent-loadout.agent-loadout
```

### 2. Add a source

Click the **+** button in the Agent Tools Loadout sidebar, or run **Agent Tools Loadout: Add Source** from the command palette. Enter a Git repository URL (HTTPS or SSH).

### 3. Browse and equip

After the repo loads, browse the content tree. Click items to preview, check items to select, then click the equip button (arrow-down icon) to write them to your workspace.

---

## Configuration

### Settings

Configure sources in your VS Code settings (`settings.json`):

```jsonc
{
  "agentLoadout.sources": [
    {
      "type": "repo",
      "url": "https://github.com/user/repo.git",
      "branch": "main"
    },
    {
      "type": "repo",
      "url": "git@github.com:org/private-repo.git",
      "path": "instructions"
    }
  ],
  "agentLoadout.defaultAgent": "cursor"
}
```

### Source configuration

```jsonc
{
  "type": "repo",
  "url": "https://github.com/user/repo.git",  // required — HTTPS or SSH
  "branch": "main",       // optional, defaults to remote HEAD
  "path": "skills",       // optional, scan only this subdirectory
  "name": "My Skills"     // optional, display name in tree
}
```

Authentication is handled by your existing Git configuration (SSH keys, credential helpers, etc.). The extension does not store any credentials.

### Content metadata (front-matter)

Content files can include YAML front-matter for richer metadata:

```markdown
---
name: React Architect
description: Expert React component design patterns
type: skill
tags: [react, architecture, components]
techStack: [react, typescript]
level: advanced
author: Team Lead
version: "2.1"
---

You are an expert React architect...
```

The `type` field controls content classification:

| `type` value | Classification |
|-------------|---------------|
| `skill`, `command`, `prompt` | Skill |
| `subagent`, `agent`, `persona` | Sub-agent |
| anything else / omitted | Instructions |

If `type` is omitted, the extension auto-detects from file path patterns (e.g., files in a `skills/` directory) and filename conventions (e.g., `*.agent.md`).

---

## Commands

| Command | Description |
|---------|-------------|
| **Agent Tools Loadout: Refresh** | Re-sync all repos and rescan content |
| **Agent Tools Loadout: Equip** | Equip a single item (context menu) |
| **Agent Tools Loadout: Equip Selected** | Equip all checked items |
| **Agent Tools Loadout: Preview** | Preview content in a side panel |
| **Agent Tools Loadout: Convert** | Convert an existing agent file to another format |
| **Agent Tools Loadout: Search** | Search content across all repos |
| **Agent Tools Loadout: Clear Search** | Clear the active search filter |
| **Agent Tools Loadout: Filter by Type** | Filter tree by content type |
| **Agent Tools Loadout: Clear Type Filter** | Remove the content type filter |
| **Agent Tools Loadout: Add Source** | Add a new Git repository source |
| **Agent Tools Loadout: Remove Source** | Remove a source and its cached data |
| **Agent Tools Loadout: Unequip** | Remove equipped files from your workspace |
| **Agent Tools Loadout: Purge Cache** | Delete all cached repos and re-clone |

---

## How it works

### Architecture

```
VS Code Extension Host
  |
  +-- SourceResolver         Maps configured repo URLs to resolved repos
  |
  +-- RepoManager            Clones/pulls repos to local cache
  |     +-- git CLI           (shallow clone with --depth=1)
  |
  +-- ContentScanner          Orchestrates scanning
  |     +-- Worker Thread     (file discovery + front-matter parsing + git log)
  |
  +-- EquipmentService        Writes content to workspace
  |     +-- Agent Adapters    (Cursor, Copilot, Claude format converters)
  |
  +-- LoadoutTreeProvider     Sidebar UI with checkboxes and search
```

### Performance

- **Shallow clones** (`--depth=1`) — minimizes download size
- **Worker thread** for scanning — main thread stays responsive
- **Single `git log`** per repo — no N+1 queries
- **Parallel sync** — all repos clone/pull concurrently
- **Scan caching** — skips repos where HEAD hasn't changed

### Security

- **No credentials stored** — uses your existing git configuration
- **No network calls** except `git clone/pull`
- **No telemetry** — the extension doesn't phone home

---

## Development

### Prerequisites

- Node.js 18+
- Git

### Setup

```bash
git clone https://github.com/Israelroze/agent-tools-loadout.git
cd agent-tools-loadout
npm install
```

### Build

```bash
npm run compile      # Type-check + lint + esbuild
npm run watch        # Watch mode (esbuild + tsc in parallel)
```

### Test

```bash
npm test             # Run unit tests
```

### Debug

Press **F5** in VS Code to launch the Extension Development Host.

### Package

```bash
npx vsce package     # Creates .vsix file
```

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run compile` and `npm test`
5. Submit a pull request

---

## License

[MIT](LICENSE)

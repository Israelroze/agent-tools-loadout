---
hide:
  - navigation
  - toc
---

# Agent Tools Loadout

Browse, preview, and equip AI agent instructions from Git repositories — for Cursor, GitHub Copilot, and Claude.

[Get Started](guide/getting-started.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/Israelroze/agent-tools-loadout){ .md-button }

---

## The Problem

AI coding agents each use their own instruction format. Cursor uses `.mdc` files, GitHub Copilot uses `.instructions.md`, and Claude uses plain `.md` in `.claude/rules/`. When your team maintains a shared library of coding standards, architectural guidelines, or specialized agent skills, distributing them across projects and formats becomes a manual chore.

## The Solution

Agent Tools Loadout connects to Git repositories containing instruction content, scans for rules, skills, and sub-agent definitions, and lets you equip them into any project — with automatic format conversion to the target agent.

---

## Key Capabilities

### Multi-Agent Support

Equip content to **Cursor**, **GitHub Copilot**, or **Claude** with a single click. Format conversion is handled automatically — write once, use everywhere.

### Content Browser

Browse instruction content organized by source repository and content type. Each item shows metadata, git history, and a rich preview panel.

### Batch Operations

Select multiple items with checkboxes and equip them all at once. Each item becomes a separate file in the correct agent directory.

### Live State Tracking

See which items are loaded in your project and get notified when source content has been updated since you last equipped it.

### Enterprise Ready

Organizations can fork the repo, pre-configure approved sources, restrict repository origins, and distribute a locked-down VSIX internally. See the [Enterprise Guide](enterprise.md) page.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Git Repositories (your org's instruction libraries)    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ rules/   │  │ skills/  │  │ agents/  │              │
│  │ *.md     │  │ *.md     │  │ *.md     │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└───────────────────────┬─────────────────────────────────┘
                        │ clone & scan
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Agent Tools Loadout (VS Code Extension)                │
│                                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐         │
│  │ Browse  │→ │ Preview  │→ │ Equip to Agent │         │
│  │ Tree UI │  │ Panel    │  │ (auto-convert) │         │
│  └─────────┘  └──────────┘  └────────────────┘         │
└───────────────────────┬─────────────────────────────────┘
                        │ write files
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Your Project                                           │
│  .cursor/rules/clean-code.mdc                           │
│  .github/instructions/api-design.instructions.md        │
│  .claude/rules/testing-standards.md                     │
│  .claude/commands/skill-react-review.md                 │
│  .github/agents/code-reviewer.agent.md                  │
└─────────────────────────────────────────────────────────┘
```

---

## Content Types

Agent Tools Loadout classifies content into three types, each with its own icon and routing behavior:

| Type | Icon | Description | Example |
|:-----|:-----|:------------|:--------|
| **Instructions** | :material-book-open-variant: | General rules, coding standards, guidelines | "Always use TypeScript strict mode" |
| **Skills** | :material-auto-fix: | Specialized commands and prompts | "Review this PR for security issues" |
| **Sub-agents** | :material-account: | Agent personas and delegated roles | "You are a database migration expert" |

Content type determines where files are written when equipped. See [Supported Agents](reference/agents.md) for the full routing table.

---

## Security

!!! warning
    **Always review content before equipping it.** AI instruction files can contain prompt injection, hidden instructions, or malicious directives that alter your agent's behavior. Use the preview panel to read the full content of every file before equipping. Treat instruction files with the same caution you'd give to running someone else's code.

---

## What's Next?

Use the navigation tabs to explore the documentation. Start with the **Guide** section to get up and running, then check the **Reference** for detailed specs.

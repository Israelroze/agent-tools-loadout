# Supported Agents

Agent Tools Loadout supports three AI coding agents. Each has its own file format, directory structure, and frontmatter conventions.

---

## Overview

| Feature | Cursor | GitHub Copilot | Claude |
|:--------|:-------|:---------------|:-------|
| **Instructions** | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **Skills** | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **Sub-agents** | — | :white_check_mark: | :white_check_mark: |
| **Rules directory** | `.cursor/rules/` | `.github/instructions/` | `.claude/rules/` |
| **File extension** | `.mdc` | `.instructions.md` | `.md` |
| **Main config file** | `.cursorrules` | `.github/copilot-instructions.md` | `CLAUDE.md` |

---

## Cursor

### File locations

| Content Type | Directory | Extension |
|:-------------|:----------|:----------|
| Instructions | `.cursor/rules/` | `.mdc` |
| Skills | `.cursor/rules/` | `.mdc` |

### Frontmatter format

```yaml
---
description: "Instructions: Clean Code Standards — Write clean, maintainable code"
alwaysApply: false
---
```

- `description` follows the pattern: `"<Type>: <name> — <description>"`
- `alwaysApply` defaults to `false`

### Limitations

Cursor does not support sub-agent content type. If you try to equip a sub-agent to Cursor, the operation will be skipped with a warning.

---

## GitHub Copilot

### File locations

| Content Type | Directory | Extension |
|:-------------|:----------|:----------|
| Instructions | `.github/instructions/` | `.instructions.md` |
| Skills | `.github/prompts/` | `.prompt.md` |
| Sub-agents | `.github/agents/` | `.agent.md` |

### Frontmatter format

**Instructions:**
```yaml
---
applyTo: "**"
---
```

**Skills** (`.prompt.md`) and **Sub-agents** (`.agent.md`) use the same `applyTo` frontmatter.

### Notes

- Copilot supports all three content types
- Skills are placed in `.github/prompts/` with the `.prompt.md` extension
- Sub-agents are placed in `.github/agents/` with the `.agent.md` extension
- The `applyTo` field uses glob patterns; `"**"` means the instruction applies to all files

---

## Claude

### File locations

| Content Type | Directory | Extension |
|:-------------|:----------|:----------|
| Instructions | `.claude/rules/` | `.md` |
| Skills | `.claude/commands/` | `.md` |
| Sub-agents | `.claude/agents/` | `.md` |

### Frontmatter format

**Instructions:**
```yaml
---
description: "Clean Code Standards: Write clean, maintainable code"
---
```

**Skills:**
```yaml
---
description: "Write clean, maintainable code"
---
```

**Sub-agents:**
```yaml
---
description: "Clean Code Standards"
---
```

### Notes

- Claude supports all three content types
- Instructions use `"<name>: <description>"` format for the description
- Skills use just the description (or name if no description)
- Sub-agents use just the name
- All files use the standard `.md` extension

---

## File Naming

When equipping content, file names are generated from the content name:

1. Convert to lowercase
2. Replace non-alphanumeric characters with hyphens
3. Strip leading/trailing hyphens
4. Add content type prefix for skills and sub-agents
5. Add agent-specific extension

### Content type prefixes

| Content Type | Prefix |
|:-------------|:-------|
| Instructions | *(none)* |
| Skills | `skill-` |
| Sub-agents | `subagent-` |

### Examples

| Content Name | Agent | Output File |
|:-------------|:------|:------------|
| Clean Code Standards | Cursor | `.cursor/rules/clean-code-standards.mdc` |
| Clean Code Standards | Copilot | `.github/instructions/clean-code-standards.instructions.md` |
| Clean Code Standards | Claude | `.claude/rules/clean-code-standards.md` |
| PR Security Review | Copilot | `.github/prompts/skill-pr-security-review.prompt.md` |
| Code Review Expert | Claude | `.claude/agents/subagent-code-review-expert.md` |

---

## Convert Between Formats

Use the **Convert** command to transform an existing agent configuration file:

```
Command Palette → Agent Tools Loadout: Convert
```

1. Select the **source** agent (format you're converting from)
2. Select the **target** agent (format you want)
3. The source file is read and normalized
4. A new file is written in the target format

Both files remain in your workspace — the original is not deleted.

### Conversion matrix

| From \ To | Cursor | Copilot | Claude |
|:----------|:-------|:--------|:-------|
| **Cursor** | — | :white_check_mark: | :white_check_mark: |
| **Copilot** | :white_check_mark: | — | :white_check_mark: |
| **Claude** | :white_check_mark: | :white_check_mark: | — |

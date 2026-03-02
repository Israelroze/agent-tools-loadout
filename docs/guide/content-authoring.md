# Content Authoring

Write instruction content that works with Agent Tools Loadout — rules, skills, and sub-agent definitions.

---

## Overview

Agent Tools Loadout discovers content from Git repositories by scanning for Markdown files that look like AI agent instructions. You control how your content is classified and displayed through **file location**, **file naming**, and **YAML front-matter**.

---

## Repository Structure

A typical content repository might look like:

```
my-team-instructions/
├── rules/
│   ├── clean-code.md
│   ├── api-design.md
│   └── testing-standards.md
├── skills/
│   ├── pr-review.md
│   └── migration-helper.md
├── agents/
│   └── code-reviewer.md
└── README.md
```

### Known instruction directories

Files in these directories automatically receive a higher [content score](features.md#content-scoring):

`rules/`, `instructions/`, `skills/`, `commands/`, `prompts/`, `agents/`, `subagents/`, `personas/`, `.github/`, `.claude/`, `.cursor/`, `.vscode/`

### Supported file extensions

| Extension | Type |
|:----------|:-----|
| `.md` | Standard Markdown |
| `.mdx` | MDX (treated as Markdown) |
| `.txt` | Plain text |
| `.mdc` | Cursor rule format |
| `.yaml`, `.yml` | YAML (scanned for front-matter) |

### Files that are skipped

These files are automatically excluded (unless inside a known instruction directory):
- `readme.md`, `changelog.md`, `license.md`, `license`
- `contributing.md`, `code_of_conduct.md`, `security.md`
- `package.json`, `package-lock.json`, `tsconfig.json`

Directories `.git` and `node_modules` are always skipped.

---

## Front-matter Metadata

YAML front-matter at the top of your files controls how content appears in the browser and how it's converted when equipped.

### Full schema

```yaml
---
name: React Architecture Guide
description: Best practices for React component design and state management
type: instructions
tags: [react, architecture, components, state-management]
techStack: [react, typescript, nextjs]
level: advanced
author: Platform Team
version: "2.1"
---
```

### Field reference

| Field | Effect | Required |
|:------|:-------|:---------|
| `name` | Display name in the tree and preview | No (falls back to filename) |
| `description` | Shown in preview panel and item tooltip | No |
| `type` | Controls content classification (see below) | No (auto-detected) |
| `tags` | Searchable tags, shown as badges in preview | No |
| `techStack` | Technology badges in preview, searchable | No |
| `level` | Difficulty badge (`beginner`, `intermediate`, `advanced`) | No |
| `author` | Shown in preview; overrides git author | No |
| `version` | Shown in preview panel | No |

---

## Content Types

The `type` field in front-matter determines how content is classified and where it's placed when equipped.

### Instructions

General rules, coding standards, and guidelines.

```yaml
---
name: TypeScript Strict Mode
description: Enforce strict TypeScript configuration across all projects
type: instructions
tags: [typescript, configuration]
---

Always use TypeScript strict mode. Enable the following compiler options:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
```

**Type values:** `instructions`, `rules`, `guidelines` (or omit `type` entirely)

### Skills

Specialized commands, prompts, and capabilities.

```yaml
---
name: Security PR Review
description: Review pull requests for common security vulnerabilities
type: skill
tags: [security, code-review]
techStack: [typescript, node]
level: intermediate
---

Review the pull request for security vulnerabilities. Check for:

1. SQL injection in database queries
2. XSS in rendered HTML
3. Exposed secrets or API keys
4. Insecure deserialization
5. Missing input validation at API boundaries
```

**Type values:** `skill`, `command`, `prompt`

### Sub-agents

Agent personas and delegated roles.

```yaml
---
name: Database Migration Expert
description: Specializes in safe, zero-downtime database schema migrations
type: subagent
tags: [database, migrations]
techStack: [postgresql, prisma]
level: advanced
---

You are a database migration expert. Your responsibilities:

## Role
- Design safe, reversible database migrations
- Ensure zero-downtime schema changes
- Review migration scripts for data integrity risks

## Guidelines
- Always provide both up and down migrations
- Use transactions for atomic changes
- Consider the impact on existing queries and indexes
```

**Type values:** `subagent`, `agent`, `persona`

---

## Auto-Detection

If the `type` field is omitted, the extension uses multiple signals to classify content:

### Directory-based detection

| Directory | Detected Type |
|:----------|:-------------|
| `skills/`, `commands/`, `prompts/` | Skill |
| `agents/`, `subagents/`, `personas/` | Sub-agent |
| `rules/`, `instructions/` | Instructions |

### Filename-based detection

| Pattern | Detected Type |
|:--------|:-------------|
| `*.agent.md` | Sub-agent |
| `*.prompt.md` | Skill |

### Content heuristics

The extension scans the content body for patterns:

| Pattern | Suggests |
|:--------|:---------|
| `you are a`, `act as a`, `your role is` | Sub-agent (persona) |
| `## role`, `# role`, `## persona` | Sub-agent |
| `## instructions`, `# instructions`, `## guidelines` | Instructions |
| `allowed-tools:`, `tool_use`, `## usage` | Skill |

---

## Scoring

Every file receives a score from 0 to 100. Files below the [sensitivity threshold](../reference/configuration.md#sensitivity) are filtered out.

### How to maximize your score

For content that should always be discovered (regardless of sensitivity setting):

1. **Place files in a known directory** (+30 points) — use `rules/`, `skills/`, or `agents/`
2. **Add a `type` field** in front-matter (+40 points) — strongest signal
3. **Add a `description` field** (+10 points)

This gives a score of 80, well above the highest threshold (70).

### Minimum for each sensitivity level

| Sensitivity | Minimum Score | Easiest way to reach it |
|:------------|:-------------|:------------------------|
| Low (10) | Any `.md` file in a known directory | Just put files in `rules/` |
| Medium (40) | Known directory + front-matter type | Add `type: instructions` to front-matter |
| High (70) | Known directory + type + content patterns | Full front-matter + structured content |

---

## Best Practices

### Use clear, descriptive names

```yaml
# Good
name: React Component Testing Standards

# Avoid
name: Rules
```

### Add tags for discoverability

```yaml
tags: [react, testing, jest, component-testing, frontend]
```

Tags are searchable — users can find your content by searching for any tag.

### Include a description

```yaml
description: Guidelines for writing maintainable React component tests using Jest and Testing Library
```

The description appears in item tooltips and the preview panel.

### Structure content with headings

Use Markdown headings to organize instructions:

```markdown
## When to Apply
Use these guidelines for all new React components.

## Rules
1. Always write tests for user interactions
2. Test behavior, not implementation details

## Examples
...
```

### One concern per file

Keep each file focused on a single topic. This makes it easy for users to equip exactly what they need without getting unrelated instructions.

---

## Testing Your Content

1. Create a Git repository with your content files
2. Push it to your Git host
3. In VS Code, add it as a source: **Agent Tools Loadout: Add Source**
4. Verify your content appears with the correct type and metadata
5. Preview each item to check the display
6. Try equipping to each supported agent to verify format conversion

# Changelog

All notable changes to the Agent Tools Loadout extension will be documented in this file.

## [0.1.3] - 2026-02-28

### Added

- **Organization policy**: Enterprise VSIX distribution with pre-configured sources, origin restrictions, and `blockPublicSources` enforcement via `config.json`
- **Preloaded sources**: Organization-managed sources with lock icon, `(org)` badge, and removal protection
- **Origin validation**: Restrict user-added sources by hostname/org prefix with inline validation in Add Source dialog
- **Build helper**: `npm run build:vsix -- <version>` accepts optional version argument for custom VSIX builds
- **Documentation site**: Material for MkDocs with dark/light toggle, navigation tabs, and GitHub Actions deployment

### Fixed

- `blockPublicSources` policy flag now correctly enforced when `allowedOrigins` is empty
- Defensive guards in `getEffectiveSources` and `isPreloadedSource` for malformed config entries
- Copilot sub-agent routing to correct `.github/agents/` directory

## [0.1.2] - 2026-02-27

### Added

- **Equipped state tracking**: Blue checkmark icon and `(loaded)` label for equipped items
- **Stale detection**: Warning icon when source content is updated after equipping
- **Sensitivity setting**: Low/medium/high content detection strictness with point-based scoring
- **Content scoring**: Configurable thresholds for file discovery (10/40/70 points)
- **Global sources**: Sources stored in VS Code global (machine) settings instead of workspace

### Fixed

- Add/remove source commands now write to Global settings instead of Workspace
- Updated extension icon: black background with bright purple

## [0.1.1] - 2026-02-26

### Added

- **Skills and sub-agents routing**: Route skills to `.cursor/rules/`, `.github/prompts/`, `.claude/commands/` and sub-agents to `.github/agents/`, `.claude/agents/` per agent conventions

### Fixed

- Skills and sub-agents now write to correct agent-native directories instead of instructions directory

## [0.1.0] - 2026-02-25

### Added

- **Source management**: Add content sources as individual repos, GitHub organizations, or monorepo subfolders
- **Content scanning**: Automatic discovery of instruction files (`.md`, `.txt`, `.mdx`, `.mdc`, `.cursorrules`) with YAML front-matter parsing
- **Content type classification**: Auto-detect instructions, skills, and sub-agents from front-matter, file paths, and filename conventions
- **Three agent adapters**: Cursor (`.cursor/rules/*.mdc`), GitHub Copilot (`.github/instructions/*.instructions.md`), Claude (`.claude/rules/*.md`)
- **Equip command**: Write content to agent-specific rule files with native frontmatter format
- **Batch equip**: Multi-select items with checkboxes and equip all at once
- **Cross-agent conversion**: Convert existing agent files between formats
- **Content preview**: Rich webview panel with metadata badges, git info, and styled content
- **Search**: Debounced full-text search across all repos with AND logic
- **Filter by type**: Filter tree view by content type (instructions, skills, sub-agents)
- **Git metadata**: Shows last author, date, and commit message for each file
- **Enterprise support**: Works with any Git server; GitHub org discovery uses OS keychain credentials
- **Performance**: Partial clones, worker thread scanning, parallel repo sync, scan caching
- **Unequip command**: Remove previously equipped files from workspace

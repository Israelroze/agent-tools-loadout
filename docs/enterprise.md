# Enterprise Guide

Deploy Agent Tools Loadout across your organization with pre-configured sources, origin restrictions, and a custom VSIX build.

---

## Overview

Organizations can customize Agent Tools Loadout to:

- **Pre-load approved instruction repositories** — sources appear automatically for all users
- **Restrict repository origins** — only allow repos from your GitHub Enterprise or GitLab instance
- **Distribute internally** — build a custom VSIX and publish to your artifact repository

The workflow:

```
Fork repo → Edit config.json → Build VSIX → Distribute to team
```

---

## How It Works

The organization policy is defined in a single file: `config.json` at the project root. This file is **inlined into the extension bundle at build time** by esbuild, making it immutable at runtime. Users cannot modify the policy through VS Code settings or any other mechanism.

---

## Configuration

### config.json

```json
{
  "preloadedSources": [],
  "allowedOrigins": [],
  "blockPublicSources": false
}
```

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `preloadedSources` | array | `[]` | Repositories that are always available to users |
| `allowedOrigins` | array | `[]` | Allowed Git URL origins (empty = allow all) |
| `blockPublicSources` | boolean | `false` | When `true` with non-empty `allowedOrigins`, fully blocks non-matching URLs |

---

## Preloaded Sources

Preloaded sources are repositories that ship with the extension and are always available. Users cannot remove them.

### Example

```json
{
  "preloadedSources": [
    {
      "type": "repo",
      "url": "https://github.acme-corp.com/platform-team/coding-standards.git",
      "name": "Platform Standards"
    },
    {
      "type": "repo",
      "url": "https://github.acme-corp.com/security/agent-rules.git",
      "branch": "production",
      "path": "approved-content",
      "name": "Security Team Rules"
    }
  ]
}
```

### Source properties

Each preloaded source supports the same properties as a user-added source:

| Property | Required | Description |
|:---------|:---------|:------------|
| `type` | Yes | Always `"repo"` |
| `url` | Yes | Git repository URL |
| `branch` | No | Branch to clone |
| `path` | No | Subdirectory to scan |
| `name` | No | Display name in the sidebar |

### How they appear

Preloaded sources are visually distinguished in the sidebar:

| Indicator | Preloaded Source | User Source |
|:----------|:-----------------|:-----------|
| **Icon** | :lock: Lock | :package: Repo |
| **Description** | `12 items (org)` | `12 items` |
| **Context menu** | No "Remove" option | "Remove Source" available |
| **Tooltip** | *"Organization source — cannot be removed"* | Repository URL |

### Deduplication

If a user adds a source with the same URL as a preloaded source, the preloaded version takes precedence. The duplicate is silently filtered out.

---

## Origin Restrictions

Use `allowedOrigins` to restrict which Git repositories users can add as sources.

### How origin matching works

The extension extracts the **origin** from a Git URL by taking the hostname and all path segments except the final one (the repository name):

| Git URL | Extracted Origin |
|:--------|:-----------------|
| `https://github.acme-corp.com/team/repo.git` | `github.acme-corp.com/team` |
| `git@github.acme-corp.com:team/repo.git` | `github.acme-corp.com/team` |
| `https://github.com/my-org/repo.git` | `github.com/my-org` |
| `https://gitlab.corp.com/group/sub/repo.git` | `gitlab.corp.com/group/sub` |
| `ssh://git@gitlab.corp.com/team/repo.git` | `gitlab.corp.com/team` |

Origins are matched using **prefix matching with a `/` boundary**. This means:
- `github.acme-corp.com` matches **any** repository on that host
- `github.acme-corp.com/platform-team` matches only repos under that org/team

### Examples

#### Allow any repo on your GitHub Enterprise

```json
{
  "allowedOrigins": ["github.acme-corp.com"]
}
```

This allows:
- `https://github.acme-corp.com/any-team/any-repo.git` :white_check_mark:
- `git@github.acme-corp.com:any-team/any-repo.git` :white_check_mark:
- `https://github.com/public-org/repo.git` :x:

#### Allow only a specific organization

```json
{
  "allowedOrigins": ["github.acme-corp.com/platform-team"]
}
```

This allows:
- `https://github.acme-corp.com/platform-team/standards.git` :white_check_mark:
- `https://github.acme-corp.com/platform-team/skills.git` :white_check_mark:
- `https://github.acme-corp.com/other-team/repo.git` :x:

#### Allow multiple origins

```json
{
  "allowedOrigins": [
    "github.acme-corp.com/platform-team",
    "github.acme-corp.com/security",
    "gitlab.internal.com"
  ]
}
```

### Where validation happens

Origin validation is enforced at two levels:

1. **Add Source dialog** — inline validation prevents users from entering restricted URLs, with a clear error message
2. **Source resolution** — defense-in-depth filter catches any URLs that bypass the UI (e.g., manually edited `settings.json`)

!!! note
    Preloaded sources always bypass origin validation. They are trusted by definition since they were configured by the organization.

---

## Full Example

Here's a complete `config.json` for a company using GitHub Enterprise:

```json
{
  "preloadedSources": [
    {
      "type": "repo",
      "url": "https://github.acme-corp.com/engineering/coding-standards.git",
      "name": "Engineering Standards"
    },
    {
      "type": "repo",
      "url": "https://github.acme-corp.com/engineering/ai-skills.git",
      "path": "approved",
      "name": "AI Skills Library"
    },
    {
      "type": "repo",
      "url": "https://github.acme-corp.com/security/secure-coding-rules.git",
      "branch": "stable",
      "name": "Security Rules"
    }
  ],
  "allowedOrigins": [
    "github.acme-corp.com"
  ],
  "blockPublicSources": false
}
```

This configuration:
- Ships three pre-loaded source repositories that all users see by default
- Restricts additional sources to repos hosted on the company's GitHub Enterprise instance
- Users can still add repos from `github.acme-corp.com` on their own

---

## Build and Distribution

### Prerequisites

- Node.js 18+
- Git

### Step 1: Fork and clone

```bash
git clone https://github.com/Israelroze/agent-tools-loadout.git
cd agent-tools-loadout
npm install
```

### Step 2: Edit config.json

Edit `config.json` in the project root with your organization's policy. See the examples above.

### Step 3: Build the VSIX

```bash
npm run build:vsix
```

To build with a specific version (overrides the version in `package.json`):

```bash
npm run build:vsix -- 1.0.0
```

This runs type checking, linting, production bundling (which inlines `config.json`), and creates a `.vsix` file in the project root.

!!! warning "Important"
    The `config.json` file is inlined into the JavaScript bundle during the build step. It is not shipped as a separate file in the VSIX. This means users cannot modify the policy after installation.

### Step 4: Distribute

We recommend uploading the `.vsix` file to an internal artifact repository (e.g., JFrog Artifactory, Nexus, Azure DevOps Artifacts) so that team members can install it with a single command.

#### Upload to Artifactory

Upload the `.vsix` to a generic repository in Artifactory:

```bash
curl -u $ARTIFACTORY_USER:$ARTIFACTORY_TOKEN \
  -T agent-loadout-1.0.0.vsix \
  "https://artifactory.acme-corp.com/artifactory/vscode-extensions/agent-loadout/agent-loadout-1.0.0.vsix"
```

!!! note
    Replace `vscode-extensions` with your actual Artifactory repository name and `acme-corp.com` with your organization's domain.

#### Team installation

Share one of these commands with your team so they can download and install the extension:

=== "VS Code"

    ```bash
    curl -fSL -o /tmp/agent-loadout.vsix \
      "https://artifactory.acme-corp.com/artifactory/vscode-extensions/agent-loadout/agent-loadout-1.0.0.vsix" \
      && code --install-extension /tmp/agent-loadout.vsix \
      && rm /tmp/agent-loadout.vsix
    ```

=== "Cursor"

    ```bash
    curl -fSL -o /tmp/agent-loadout.vsix \
      "https://artifactory.acme-corp.com/artifactory/vscode-extensions/agent-loadout/agent-loadout-1.0.0.vsix" \
      && cursor --install-extension /tmp/agent-loadout.vsix \
      && rm /tmp/agent-loadout.vsix
    ```

Alternatively, users can install manually via the UI: `Extensions > ... > Install from VSIX...`

### Updating

When you need to update the policy or upgrade the extension version:

1. Pull latest changes from upstream
2. Update `config.json` if needed
3. Rebuild: `npm run build:vsix` (or `npm run build:vsix -- 1.1.0` to bump the version)
4. Upload the new `.vsix` to your artifact repository
5. Notify team members to re-run the install command above

---

## Security Considerations

### Policy immutability

The policy is compiled into the extension bundle at build time. There is no runtime configuration, no environment variables, and no settings override. Users see the preloaded sources and origin restrictions exactly as you configured them.

### Defense in depth

Even if a user manually edits their `settings.json` to add a restricted URL, the source resolver validates origins before processing. Blocked URLs are logged and silently filtered out.

### No credential storage

The extension never stores credentials. Authentication is handled entirely by the user's Git configuration (SSH keys, credential helpers). This means your organization's existing access controls apply — if a user doesn't have read access to a repository, the clone will fail normally.

### Content review

!!! warning
    Even with origin restrictions, users should still review content before equipping. Origin restrictions control *where* content can come from, but not *what* the content says. The preview panel is always available for reviewing content before it's written to the workspace.

---

## Troubleshooting

### Preloaded sources don't appear

- Verify `config.json` is valid JSON
- Verify the URLs are correct and accessible
- Rebuild the VSIX: `npm run build:vsix`
- Check that you installed the custom VSIX, not the marketplace version

### Origin validation errors

- Check the error message in the Add Source dialog — it shows the extracted origin and the allowed list
- Origins are case-insensitive
- Make sure you're using the correct hostname (e.g., `github.acme-corp.com` not `github.com`)

### Users can still add public repos

- Ensure `allowedOrigins` is not empty in `config.json`
- Rebuild and redistribute the VSIX after changing the config
- The marketplace version ships with an empty policy (no restrictions)

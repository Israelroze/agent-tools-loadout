# Getting Started

Install Agent Tools Loadout, add your first source, and equip content in under five minutes.

---

## Installation

### From the VS Code Marketplace

1. Open VS Code
2. Open the Extensions sidebar (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Agent Tools Loadout"** or **agent-loadout**
4. Click **Install**

### From a `.vsix` file

If your organization distributes a custom build:

1. Download the `.vsix` file from your internal artifact repository
2. Open VS Code
3. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
4. Run **Extensions: Install from VSIX...**
5. Select the downloaded file

### From the command line

```bash
code --install-extension agent-loadout-0.1.2.vsix
```

---

## Add Your First Source

After installation, you'll see a new icon in the Activity Bar on the left side of VS Code.

### Step 1: Open the sidebar

Click the **Agent Tools Loadout** icon in the Activity Bar. You'll see a message: *"No sources configured. Use 'Add Source' to get started."*

### Step 2: Add a source repository

Click the **+** button in the sidebar title bar, or run **Agent Tools Loadout: Add Source** from the Command Palette.

Enter a Git repository URL. Both HTTPS and SSH formats are supported:

```
https://github.com/your-org/agent-instructions.git
git@github.com:your-org/agent-instructions.git
```

!!! note
    Authentication uses your existing Git configuration — SSH keys, credential helpers, personal access tokens. The extension does not store any credentials.

### Step 3: Wait for the scan

The extension clones the repository (shallow, `--depth=1`) and scans for instruction content. You'll see a loading indicator while this happens.

### Step 4: Browse content

Once loaded, the sidebar tree shows all discovered content organized by source and content type. Click any item to see a rich preview.

---

## Equip Content

### Single item

Right-click any content item and select **Load**. You'll be prompted to choose a target agent:

- **Cursor** — writes to `.cursor/rules/`
- **GitHub Copilot** — writes to `.github/instructions/`
- **Claude** — writes to `.claude/rules/`

### Multiple items

1. Check the boxes next to the items you want to equip
2. Click the **download icon** in the sidebar title bar
3. Choose a target agent
4. All selected items are written to your workspace

### After equipping

Equipped items show a blue checkmark icon and `(loaded)` label in the tree. If the source content is updated after you equipped it, you'll see a warning icon with `updated since loaded`.

---

## Unequip Content

To remove equipped files from your workspace:

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Agent Tools Loadout: Unequip**
3. Select the target agent
4. Choose which files to remove

---

## Next Steps

- [Features](features.md) — Learn about search, filtering, format conversion, and more
- [Supported Agents](../reference/agents.md) — Understand where files go and how formats differ
- [Configuration](../reference/configuration.md) — Tune sensitivity, set default agent, manage sources
- [Content Authoring](content-authoring.md) — Write your own instruction content for your team

import * as vscode from 'vscode';
import * as path from 'path';
import type { ContentItem, ContentType, AgentId, EquipResult, EquippedMap } from '../types';
import { getAdapter } from '../adapters/adapterRegistry';
import { AGENT_CONFIGS } from '../utils/constants';
import * as logger from '../utils/logger';

const EQUIPPED_STATE_KEY = 'agentLoadout.equipped';

/** Filename prefix per content type so files are visually grouped when sorted. */
const CONTENT_TYPE_PREFIX: Record<ContentType, string> = {
  instructions: '',
  skill: 'skill-',
  subagent: 'subagent-',
};

function resolveContentTypeDir(config: import('../types').AgentConfig, contentType: ContentType): string {
  return config.contentTypeDirs?.[contentType] ?? config.rulesDir!;
}

function resolveContentTypeExt(config: import('../types').AgentConfig, contentType: ContentType): string {
  return config.contentTypeExts?.[contentType] ?? config.ruleFileExt!;
}

/**
 * Build agent-native frontmatter that embeds content type metadata.
 * Each agent uses different frontmatter fields.
 */
function buildFrontmatter(
  agentId: AgentId,
  item: ContentItem
): string {
  const ct = item.metadata.contentType;
  const name = item.metadata.name;
  const desc = item.metadata.description;

  const typeLabel: Record<ContentType, string> = {
    instructions: 'Instruction',
    skill: 'Skill',
    subagent: 'Sub-agent',
  };

  switch (agentId) {
    case 'claude': {
      const lines = ['---'];
      if (ct === 'subagent') {
        // .claude/agents/ — agent description shown in @mention picker
        lines.push(`description: "${escapeFrontmatter(name)}${desc ? ': ' + escapeFrontmatter(desc) : ''}"`);
      } else if (ct === 'skill') {
        // .claude/commands/ — description shown in slash command picker
        lines.push(`description: "${escapeFrontmatter(desc || name)}"`);
      } else {
        // .claude/rules/ — instructions
        lines.push(`description: "${escapeFrontmatter(name)}${desc ? ' — ' + escapeFrontmatter(desc) : ''}"`);
      }
      lines.push('---');
      return lines.join('\n') + '\n\n';
    }

    case 'copilot': {
      // Copilot uses --- YAML frontmatter with `applyTo` and description in filename/content
      const lines = ['---'];
      lines.push(`applyTo: "**"`);
      lines.push('---');
      return lines.join('\n') + '\n\n';
    }

    case 'cursor': {
      // Cursor .mdc files use --- YAML frontmatter with description and alwaysApply
      const lines = ['---'];
      lines.push(`description: "${typeLabel[ct]}: ${escapeFrontmatter(name)}${desc ? ' — ' + escapeFrontmatter(desc) : ''}"`);
      lines.push('alwaysApply: false');
      lines.push('---');
      return lines.join('\n') + '\n\n';
    }

    default:
      return '';
  }
}

/**
 * Escape quotes in frontmatter string values.
 */
function escapeFrontmatter(s: string): string {
  return s.replace(/"/g, '\\"');
}

/**
 * Handles equipping content to agent-specific files and cross-agent conversion.
 */
export class EquipmentService {
  constructor(private readonly context?: vscode.ExtensionContext) {}

  /** Read the equipped map from workspace state. */
  getEquippedMap(): EquippedMap {
    return this.context?.workspaceState.get<EquippedMap>(EQUIPPED_STATE_KEY) ?? {};
  }

  /** Persist the equipped map to workspace state. */
  private async saveEquippedMap(map: EquippedMap): Promise<void> {
    await this.context?.workspaceState.update(EQUIPPED_STATE_KEY, map);
  }

  /**
   * Remove entries from the equipped map whose files no longer exist on disk.
   * Call this on refresh so deleted files don't show as loaded.
   */
  async pruneEquippedMap(workspaceRoot: string): Promise<void> {
    const map = this.getEquippedMap();
    let changed = false;
    for (const [id, record] of Object.entries(map)) {
      const fullPath = path.join(workspaceRoot, record.path);
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
      } catch {
        delete map[id];
        changed = true;
      }
    }
    if (changed) {
      await this.saveEquippedMap(map);
    }
  }

  /**
   * Equip one or more content items to a target agent's rules directory.
   * Each item is written as a separate file, flat in the rules directory.
   * Content type is conveyed via native frontmatter and filename prefix.
   */
  async equipItems(
    items: ContentItem[],
    targetAgentId: AgentId,
    workspaceRoot: string
  ): Promise<EquipResult> {
    const config = AGENT_CONFIGS[targetAgentId];
    const adapter = getAdapter(targetAgentId);

    const dirsCreated = new Set<string>();
    const writtenFiles: string[] = [];
    const equippedMap = this.getEquippedMap();

    for (const item of items) {
      const contentType = item.metadata.contentType;
      const typeRelDir = resolveContentTypeDir(config, contentType);
      const ext = resolveContentTypeExt(config, contentType);
      const rulesDir = path.join(workspaceRoot, typeRelDir);

      // Ensure this content-type's directory exists (only once per directory)
      if (!dirsCreated.has(rulesDir)) {
        try {
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(rulesDir));
        } catch {
          // Directory may already exist
        }
        dirsCreated.add(rulesDir);
      }

      const normalized = adapter.normalize(item.content);
      const formatted = adapter.format(normalized);
      const frontmatter = buildFrontmatter(targetAgentId, item);

      // Suppress filename prefix when the content type has its own dedicated directory
      const hasOwnDir = !!config.contentTypeDirs?.[contentType];
      const prefix = hasOwnDir ? '' : CONTENT_TYPE_PREFIX[contentType];
      const fileName = prefix + toFileName(item.metadata.name) + ext;
      const filePath = path.join(rulesDir, fileName);
      const fileUri = vscode.Uri.file(filePath);

      await vscode.workspace.fs.writeFile(
        fileUri,
        Buffer.from(frontmatter + formatted, 'utf-8')
      );

      const relWrittenPath = path.join(typeRelDir, fileName);
      writtenFiles.push(relWrittenPath);

      // Track equipped state
      equippedMap[item.id] = {
        path: relWrittenPath,
        equippedAt: Date.now(),
        lastModified: item.gitInfo?.lastDate,
      };
    }

    await this.saveEquippedMap(equippedMap);

    const message =
      items.length === 1
        ? `Loaded "${items[0].metadata.name}" → ${writtenFiles[0]}`
        : `Loaded ${items.length} items → ${config.rulesDir}/`;

    logger.info(message);

    return {
      success: true,
      agent: targetAgentId,
      targetPath: config.rulesDir!,
      itemCount: items.length,
      message,
    };
  }

  /**
   * Convert an existing agent file to another agent's format.
   */
  async convert(
    sourceAgentId: AgentId,
    targetAgentId: AgentId,
    workspaceRoot: string
  ): Promise<EquipResult> {
    const sourceAdapter = getAdapter(sourceAgentId);
    const targetAdapter = getAdapter(targetAgentId);
    const targetConfig = AGENT_CONFIGS[targetAgentId];

    const sourcePath = path.join(workspaceRoot, sourceAdapter.targetPath);
    const sourceUri = vscode.Uri.file(sourcePath);

    // Read source file
    let sourceContent: string;
    try {
      const data = await vscode.workspace.fs.readFile(sourceUri);
      sourceContent = Buffer.from(data).toString('utf-8');
    } catch {
      return {
        success: false,
        agent: targetAgentId,
        targetPath: targetConfig.targetPath,
        itemCount: 0,
        message: `Source file not found: ${sourceAdapter.targetPath}`,
      };
    }

    // Normalize from source format, then format for target
    const normalized = sourceAdapter.normalize(sourceContent);
    const converted = targetAdapter.format(normalized);

    // Write target file
    const targetPath = path.join(workspaceRoot, targetConfig.targetPath);
    const targetUri = vscode.Uri.file(targetPath);

    const parentDir = path.dirname(targetPath);
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(parentDir));
    } catch {
      // Directory may already exist
    }

    await vscode.workspace.fs.writeFile(
      targetUri,
      Buffer.from(converted, 'utf-8')
    );

    const message = `Converted ${sourceAdapter.targetPath} → ${targetConfig.targetPath}`;
    logger.info(message);

    return {
      success: true,
      agent: targetAgentId,
      targetPath: targetConfig.targetPath,
      itemCount: 1,
      message,
    };
  }
}

/**
 * Convert a content name to a safe filename.
 * "Clean Code Rules" → "clean-code-rules"
 */
function toFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

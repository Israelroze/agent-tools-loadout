/**
 * Unit tests for EquipmentService.
 *
 * Tests cover:
 * - File naming (toFileName logic via equip output)
 * - Content type → directory routing (Claude: agents/, commands/, rules/)
 * - Content type → directory routing (Copilot: prompts/, agents/, instructions/)
 * - Frontmatter generation per agent
 * - pruneEquippedMap removes missing files and keeps existing ones
 * - Equipped state tracking (path, equippedAt, lastModified)
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { EquipmentService } from '../../src/services/equipmentService';
import type { ContentItem, EquippedMap } from '../../src/types';

// ── Test helpers ───────────────────────────────────────────────────────────

function makeContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'https://github.com/org/repo:skills/react-architect.md',
    repoUrl: 'https://github.com/org/repo',
    filePath: 'skills/react-architect.md',
    content: 'You are a senior React architect.',
    metadata: {
      name: 'React Architect',
      description: 'Frontend expert',
      contentType: 'skill',
    },
    ...overrides,
  };
}

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'casa-test-'));
  return dir;
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

// ── Fake ExtensionContext ──────────────────────────────────────────────────

function makeFakeContext(): vscode.ExtensionContext {
  const store = new Map<string, unknown>();
  return {
    workspaceState: {
      get: <T>(key: string, defaultValue?: T) => (store.has(key) ? store.get(key) as T : defaultValue) as T,
      update: async (key: string, value: unknown) => { store.set(key, value); },
      keys: () => [...store.keys()],
    },
  } as unknown as vscode.ExtensionContext;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('EquipmentService', () => {
  let tmpDir: string;
  let service: EquipmentService;
  let context: vscode.ExtensionContext;

  beforeEach(async () => {
    tmpDir = await createTempDir();
    context = makeFakeContext();
    service = new EquipmentService(context);
  });

  afterEach(async () => {
    await removeDir(tmpDir);
  });

  // ── getEquippedMap / workspaceState ───────────────────────────────────

  describe('getEquippedMap', () => {
    it('returns empty object when no state stored', () => {
      const map = service.getEquippedMap();
      assert.deepStrictEqual(map, {});
    });
  });

  // ── equipItems — Claude agent ─────────────────────────────────────────

  describe('equipItems — claude', () => {
    it('routes skills to .claude/commands/', async () => {
      const item = makeContentItem({ metadata: { name: 'React Architect', description: '', contentType: 'skill' } });
      const result = await service.equipItems([item], 'claude', tmpDir);

      assert.ok(result.success, result.message);
      const commandsDir = path.join(tmpDir, '.claude', 'commands');
      const files = await fs.readdir(commandsDir);
      assert.strictEqual(files.length, 1);
      assert.ok(files[0].endsWith('.md'), `expected .md extension, got ${files[0]}`);
      // No 'skill-' prefix when content type has its own dir
      assert.ok(!files[0].startsWith('skill-'), `should not have prefix in dedicated dir`);
    });

    it('routes subagents to .claude/agents/', async () => {
      const item = makeContentItem({
        metadata: { name: 'API Designer', description: 'Designs APIs', contentType: 'subagent' },
        filePath: 'agents/api-designer.md',
      });
      const result = await service.equipItems([item], 'claude', tmpDir);

      assert.ok(result.success, result.message);
      const agentsDir = path.join(tmpDir, '.claude', 'agents');
      const files = await fs.readdir(agentsDir);
      assert.strictEqual(files.length, 1);
    });

    it('routes instructions to .claude/rules/', async () => {
      const item = makeContentItem({
        metadata: { name: 'Code Style', description: '', contentType: 'instructions' },
        filePath: 'rules/code-style.md',
      });
      const result = await service.equipItems([item], 'claude', tmpDir);

      assert.ok(result.success, result.message);
      const rulesDir = path.join(tmpDir, '.claude', 'rules');
      const files = await fs.readdir(rulesDir);
      assert.strictEqual(files.length, 1);
    });

    it('writes claude frontmatter for subagents with description', async () => {
      const item = makeContentItem({
        metadata: { name: 'API Designer', description: 'Designs REST APIs', contentType: 'subagent' },
      });
      await service.equipItems([item], 'claude', tmpDir);

      const agentsDir = path.join(tmpDir, '.claude', 'agents');
      const [filename] = await fs.readdir(agentsDir);
      const content = await readFileContent(path.join(agentsDir, filename));
      assert.ok(content.includes('description:'), 'claude subagent frontmatter should have description field');
      assert.ok(content.includes('API Designer'), 'frontmatter should include the agent name');
    });

    it('writes claude frontmatter for skills with description', async () => {
      const item = makeContentItem({
        metadata: { name: 'React Builder', description: 'Builds React components', contentType: 'skill' },
      });
      await service.equipItems([item], 'claude', tmpDir);

      const commandsDir = path.join(tmpDir, '.claude', 'commands');
      const [filename] = await fs.readdir(commandsDir);
      const content = await readFileContent(path.join(commandsDir, filename));
      assert.ok(content.startsWith('---'), 'should start with YAML frontmatter');
    });
  });

  // ── equipItems — Copilot agent ────────────────────────────────────────

  describe('equipItems — copilot', () => {
    it('routes skills to .github/prompts/ with .prompt.md extension', async () => {
      const item = makeContentItem({ metadata: { name: 'Test Generator', description: '', contentType: 'skill' } });
      const result = await service.equipItems([item], 'copilot', tmpDir);

      assert.ok(result.success, result.message);
      const promptsDir = path.join(tmpDir, '.github', 'prompts');
      const files = await fs.readdir(promptsDir);
      assert.strictEqual(files.length, 1);
      assert.ok(files[0].endsWith('.prompt.md'), `expected .prompt.md, got ${files[0]}`);
    });

    it('routes subagents to .github/agents/ with .agent.md extension', async () => {
      const item = makeContentItem({
        metadata: { name: 'Code Reviewer', description: 'Reviews code', contentType: 'subagent' },
        filePath: 'agents/code-reviewer.md',
      });
      const result = await service.equipItems([item], 'copilot', tmpDir);

      assert.ok(result.success, result.message);
      const agentsDir = path.join(tmpDir, '.github', 'agents');
      const files = await fs.readdir(agentsDir);
      assert.strictEqual(files.length, 1);
      assert.ok(files[0].endsWith('.agent.md'), `expected .agent.md, got ${files[0]}`);
    });

    it('does NOT route subagents to .github/instructions/', async () => {
      const item = makeContentItem({
        metadata: { name: 'Code Reviewer', description: 'Reviews code', contentType: 'subagent' },
        filePath: 'agents/code-reviewer.md',
      });
      await service.equipItems([item], 'copilot', tmpDir);

      const instructionsDir = path.join(tmpDir, '.github', 'instructions');
      const exists = await fs.stat(instructionsDir).then(() => true).catch(() => false);
      assert.ok(!exists, 'subagents should NOT be placed in .github/instructions/');
    });

    it('routes instructions to .github/instructions/', async () => {
      const item = makeContentItem({ metadata: { name: 'Code Style', description: '', contentType: 'instructions' } });
      const result = await service.equipItems([item], 'copilot', tmpDir);

      assert.ok(result.success, result.message);
      const instructionsDir = path.join(tmpDir, '.github', 'instructions');
      const files = await fs.readdir(instructionsDir);
      assert.strictEqual(files.length, 1);
    });

    it('writes copilot frontmatter with applyTo field', async () => {
      const item = makeContentItem({ metadata: { name: 'Code Style', description: '', contentType: 'instructions' } });
      await service.equipItems([item], 'copilot', tmpDir);

      const instructionsDir = path.join(tmpDir, '.github', 'instructions');
      const [filename] = await fs.readdir(instructionsDir);
      const content = await readFileContent(path.join(instructionsDir, filename));
      assert.ok(content.includes('applyTo:'), 'copilot frontmatter should have applyTo field');
    });
  });

  // ── equipItems — Cursor agent ─────────────────────────────────────────

  describe('equipItems — cursor', () => {
    it('routes instructions to .cursor/rules/ with .mdc extension', async () => {
      const item = makeContentItem({ metadata: { name: 'Style Guide', description: '', contentType: 'instructions' } });
      const result = await service.equipItems([item], 'cursor', tmpDir);

      assert.ok(result.success, result.message);
      const rulesDir = path.join(tmpDir, '.cursor', 'rules');
      const files = await fs.readdir(rulesDir);
      assert.ok(files[0].endsWith('.mdc'), `expected .mdc extension, got ${files[0]}`);
    });

    it('writes cursor frontmatter with description and alwaysApply', async () => {
      const item = makeContentItem({ metadata: { name: 'Style Guide', description: 'My rules', contentType: 'instructions' } });
      await service.equipItems([item], 'cursor', tmpDir);

      const rulesDir = path.join(tmpDir, '.cursor', 'rules');
      const [filename] = await fs.readdir(rulesDir);
      const content = await readFileContent(path.join(rulesDir, filename));
      assert.ok(content.includes('alwaysApply:'), 'cursor frontmatter should have alwaysApply');
      assert.ok(content.includes('description:'), 'cursor frontmatter should have description');
    });
  });

  // ── Filename generation ────────────────────────────────────────────────

  describe('filename generation', () => {
    it('converts spaces to hyphens', async () => {
      const item = makeContentItem({ metadata: { name: 'Clean Code Rules', description: '', contentType: 'instructions' } });
      await service.equipItems([item], 'claude', tmpDir);

      const rulesDir = path.join(tmpDir, '.claude', 'rules');
      const [filename] = await fs.readdir(rulesDir);
      assert.ok(filename.includes('clean-code-rules'), `expected hyphenated name in ${filename}`);
    });

    it('lowercases the filename', async () => {
      const item = makeContentItem({ metadata: { name: 'TYPESCRIPT Expert', description: '', contentType: 'skill' } });
      await service.equipItems([item], 'claude', tmpDir);

      const commandsDir = path.join(tmpDir, '.claude', 'commands');
      const [filename] = await fs.readdir(commandsDir);
      assert.strictEqual(filename, filename.toLowerCase(), 'filename should be lowercase');
    });

    it('strips leading and trailing hyphens', async () => {
      const item = makeContentItem({ metadata: { name: '  Spaced Name  ', description: '', contentType: 'instructions' } });
      await service.equipItems([item], 'claude', tmpDir);

      const rulesDir = path.join(tmpDir, '.claude', 'rules');
      const [filename] = await fs.readdir(rulesDir);
      assert.ok(!filename.startsWith('-'), `filename should not start with hyphen: ${filename}`);
      assert.ok(!filename.endsWith('-.md') && !filename.endsWith('--'), 'filename should not have trailing hyphens');
    });

    it('adds "skill-" prefix in cursor rules/ dir (no dedicated skill dir)', async () => {
      const item = makeContentItem({ metadata: { name: 'My Skill', description: '', contentType: 'skill' } });
      await service.equipItems([item], 'cursor', tmpDir);

      const rulesDir = path.join(tmpDir, '.cursor', 'rules');
      const [filename] = await fs.readdir(rulesDir);
      // Cursor has no dedicated skill dir, so prefix is applied
      assert.ok(filename.startsWith('skill-'), `expected "skill-" prefix in cursor rules: ${filename}`);
    });
  });

  // ── Equipped state tracking ───────────────────────────────────────────

  describe('equipped state tracking', () => {
    it('records the equipped item in workspaceState', async () => {
      const item = makeContentItem({
        id: 'test-id',
        metadata: { name: 'My Rule', description: '', contentType: 'instructions' },
      });
      await service.equipItems([item], 'claude', tmpDir);

      const map = service.getEquippedMap();
      assert.ok(map['test-id'], 'should have record for equipped item id');
      assert.ok(map['test-id'].path, 'should record relative path');
      assert.ok(map['test-id'].equippedAt > 0, 'should record timestamp');
    });

    it('stores lastModified from gitInfo.lastDate', async () => {
      const date = '2024-01-15T10:30:00Z';
      const item = makeContentItem({
        id: 'test-id',
        metadata: { name: 'My Rule', description: '', contentType: 'instructions' },
        gitInfo: { lastAuthor: 'Alice', lastDate: date, lastMessage: 'add rule', sha: 'abc' },
      });
      await service.equipItems([item], 'claude', tmpDir);

      const map = service.getEquippedMap();
      assert.strictEqual(map['test-id'].lastModified, date);
    });

    it('stores lastModified as undefined when no gitInfo', async () => {
      const item = makeContentItem({
        id: 'test-id',
        metadata: { name: 'My Rule', description: '', contentType: 'instructions' },
        // No gitInfo
      });
      await service.equipItems([item], 'claude', tmpDir);

      const map = service.getEquippedMap();
      assert.strictEqual(map['test-id'].lastModified, undefined);
    });

    it('equipping multiple items tracks all of them', async () => {
      const items: ContentItem[] = [
        makeContentItem({ id: 'id1', metadata: { name: 'Rule One', description: '', contentType: 'instructions' } }),
        makeContentItem({ id: 'id2', metadata: { name: 'Rule Two', description: '', contentType: 'instructions' } }),
      ];
      await service.equipItems(items, 'claude', tmpDir);

      const map = service.getEquippedMap();
      assert.ok(map['id1'], 'should track id1');
      assert.ok(map['id2'], 'should track id2');
    });
  });

  // ── pruneEquippedMap ───────────────────────────────────────────────────

  describe('pruneEquippedMap', () => {
    it('removes entries for files that no longer exist', async () => {
      // Manually inject an entry for a nonexistent file
      const equippedMap: EquippedMap = {
        'ghost-id': {
          path: '.claude/rules/deleted-rule.md',
          equippedAt: Date.now(),
          lastModified: undefined,
        },
      };
      await context.workspaceState.update('agentLoadout.equipped', equippedMap);

      await service.pruneEquippedMap(tmpDir);

      const map = service.getEquippedMap();
      assert.strictEqual(Object.keys(map).length, 0, 'ghost entry should be pruned');
    });

    it('keeps entries for files that still exist', async () => {
      // Write a real file
      const relPath = '.claude/rules/my-rule.md';
      const absPath = path.join(tmpDir, relPath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, '# Rule content');

      const equippedMap: EquippedMap = {
        'real-id': { path: relPath, equippedAt: Date.now(), lastModified: undefined },
      };
      await context.workspaceState.update('agentLoadout.equipped', equippedMap);

      await service.pruneEquippedMap(tmpDir);

      const map = service.getEquippedMap();
      assert.ok(map['real-id'], 'existing file entry should be kept');
    });

    it('handles mix of existing and missing files', async () => {
      // Write one real file
      const realPath = '.claude/rules/real.md';
      const absPath = path.join(tmpDir, realPath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, 'content');

      const equippedMap: EquippedMap = {
        'real-id': { path: realPath, equippedAt: Date.now(), lastModified: undefined },
        'ghost-id': { path: '.claude/rules/gone.md', equippedAt: Date.now(), lastModified: undefined },
      };
      await context.workspaceState.update('agentLoadout.equipped', equippedMap);

      await service.pruneEquippedMap(tmpDir);

      const map = service.getEquippedMap();
      assert.ok(map['real-id'], 'existing file should remain');
      assert.strictEqual(map['ghost-id'], undefined, 'missing file should be pruned');
    });

    it('does nothing when equipped map is empty', async () => {
      // Should not throw
      await service.pruneEquippedMap(tmpDir);
      const map = service.getEquippedMap();
      assert.deepStrictEqual(map, {});
    });
  });

  // ── equip + prune round-trip ───────────────────────────────────────────

  describe('equip then prune round-trip', () => {
    it('equip → delete file → prune removes the entry', async () => {
      const item = makeContentItem({
        id: 'round-trip-id',
        metadata: { name: 'Round Trip Rule', description: '', contentType: 'instructions' },
      });
      await service.equipItems([item], 'claude', tmpDir);

      // Verify it's tracked
      assert.ok(service.getEquippedMap()['round-trip-id']);

      // Delete the written file
      const record = service.getEquippedMap()['round-trip-id'];
      await fs.rm(path.join(tmpDir, record.path));

      // Prune should remove it
      await service.pruneEquippedMap(tmpDir);
      assert.strictEqual(service.getEquippedMap()['round-trip-id'], undefined);
    });

    it('equip → prune with file still present keeps entry', async () => {
      const item = makeContentItem({
        id: 'keeps-id',
        metadata: { name: 'Kept Rule', description: '', contentType: 'instructions' },
      });
      await service.equipItems([item], 'claude', tmpDir);

      await service.pruneEquippedMap(tmpDir);

      assert.ok(service.getEquippedMap()['keeps-id'], 'should still be tracked');
    });
  });
});

/**
 * Integration tests for the equip → loaded indicator → stale detection flow.
 *
 * These tests exercise the full pipeline:
 * EquipmentService.equipItems() → workspaceState → LoadoutTreeProvider.makeContentTreeItem()
 *
 * Scenarios covered:
 * 1. Equipping a file → item shows as loaded in tree
 * 2. Equipping preserves lastModified → NOT stale immediately after load
 * 3. Source repo updates → item shows as stale
 * 4. Deleting the equipped file → pruneEquippedMap removes it → NOT loaded in tree
 * 5. Loading with no gitInfo → not stale (no date to compare)
 * 6. Multiple items: each tracked independently
 * 7. Equipping the same item twice → updates the record (re-load)
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { EquipmentService } from '../../src/services/equipmentService';
import { LoadoutTreeProvider } from '../../src/ui/loadoutTreeProvider';
import { ContentTreeItem } from '../../src/ui/loadoutTreeItems';
import type { ContentItem, ContentSummary, SourceConfig, ResolvedRepo } from '../../src/types';
import type { ScanResults } from '../../src/services/contentScanner';

// ── Helpers ────────────────────────────────────────────────────────────────

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'casa-integration-'));
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

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

const REPO_URL = 'https://github.com/org/repo';
const SOURCE_ID = `repo:${REPO_URL}`;

function makeSource(): SourceConfig {
  return { type: 'repo', url: REPO_URL };
}

function makeResolved(): ResolvedRepo {
  return { url: REPO_URL, sourceId: SOURCE_ID, displayName: 'repo' };
}

function makeScanResults(items: ContentSummary[]): ScanResults {
  return { items: new Map([[SOURCE_ID, items]]), errors: new Map() };
}

function makeSummary(id: string, name: string, gitDate?: string): ContentSummary {
  return {
    id,
    repoUrl: REPO_URL,
    filePath: `rules/${name.toLowerCase().replace(/\s/g, '-')}.md`,
    metadata: { name, description: '', contentType: 'instructions' },
    gitInfo: gitDate
      ? { lastAuthor: 'Alice', lastDate: gitDate, lastMessage: 'update', sha: 'abc' }
      : undefined,
  };
}

function makeContentItem(summary: ContentSummary): ContentItem {
  return { ...summary, content: `# ${summary.metadata.name}\n\nContent here.` };
}

function getTreeItem(provider: LoadoutTreeProvider, id: string): ContentTreeItem | undefined {
  const roots = provider.getChildren();
  const children = provider.getChildren(roots[0]);
  return (children as ContentTreeItem[]).find((c) => c.summary.id === id);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Equip → Loaded Indicator → Stale Detection Flow', () => {
  let tmpDir: string;
  let service: EquipmentService;
  let provider: LoadoutTreeProvider;

  beforeEach(async () => {
    tmpDir = await createTempDir();
    service = new EquipmentService(makeFakeContext());
    provider = new LoadoutTreeProvider();
  });

  afterEach(async () => {
    await removeDir(tmpDir);
  });

  // ── Scenario 1: Equip → shows as loaded ─────────────────────────────

  it('item shows as loaded after equipping', async () => {
    const summary = makeSummary('item-1', 'Code Style');
    provider.update([makeSource()], [makeResolved()], makeScanResults([summary]));

    // Before equipping — not loaded
    let treeItem = getTreeItem(provider, 'item-1');
    assert.strictEqual(treeItem?.contextValue, 'content');

    // Equip
    await service.equipItems([makeContentItem(summary)], 'claude', tmpDir);
    provider.setEquippedMap(service.getEquippedMap());

    // After equipping — loaded
    treeItem = getTreeItem(provider, 'item-1');
    assert.strictEqual(treeItem?.contextValue, 'content-loaded');
    assert.strictEqual(treeItem?.description, '(loaded)');
  });

  // ── Scenario 2: Not stale immediately after load ─────────────────────

  it('item is NOT stale immediately after loading (lastModified matches current git date)', async () => {
    const date = '2024-06-01T10:00:00Z';
    const summary = makeSummary('item-2', 'Typing Rules', date);

    provider.update([makeSource()], [makeResolved()], makeScanResults([summary]));
    await service.equipItems([makeContentItem(summary)], 'claude', tmpDir);
    provider.setEquippedMap(service.getEquippedMap());

    const treeItem = getTreeItem(provider, 'item-2');
    assert.notStrictEqual(treeItem?.description, '⚠ updated since loaded',
      'should NOT be stale immediately after loading');
    assert.strictEqual(treeItem?.description, '(loaded)');
  });

  // ── Scenario 3: Source repo updated → shows stale ───────────────────

  it('item shows stale when source repo file has newer git date than at load time', async () => {
    const loadDate = '2024-01-10T00:00:00Z';
    const updatedDate = '2024-06-01T00:00:00Z';

    // Load with old date
    const summaryAtLoad = makeSummary('item-3', 'Api Rules', loadDate);
    await service.equipItems([makeContentItem(summaryAtLoad)], 'claude', tmpDir);

    // Scan result now has a newer date (simulating source repo update)
    const summaryUpdated = makeSummary('item-3', 'Api Rules', updatedDate);
    provider.update([makeSource()], [makeResolved()], makeScanResults([summaryUpdated]));
    provider.setEquippedMap(service.getEquippedMap());

    const treeItem = getTreeItem(provider, 'item-3');
    assert.strictEqual(treeItem?.description, '⚠ updated since loaded',
      'should show stale when source has a newer date');
    assert.strictEqual(treeItem?.contextValue, 'content-loaded');
  });

  // ── Scenario 4: Delete equipped file → prune → not loaded ───────────

  it('item no longer shows loaded after its file is deleted and map is pruned', async () => {
    const summary = makeSummary('item-4', 'Delete Me Rule');
    await service.equipItems([makeContentItem(summary)], 'claude', tmpDir);
    provider.setEquippedMap(service.getEquippedMap());

    // Verify loaded
    provider.update([makeSource()], [makeResolved()], makeScanResults([summary]));
    let treeItem = getTreeItem(provider, 'item-4');
    assert.strictEqual(treeItem?.contextValue, 'content-loaded');

    // Delete the written file
    const record = service.getEquippedMap()['item-4'];
    await fs.rm(path.join(tmpDir, record.path));

    // Prune and update tree
    await service.pruneEquippedMap(tmpDir);
    provider.setEquippedMap(service.getEquippedMap());

    treeItem = getTreeItem(provider, 'item-4');
    assert.strictEqual(treeItem?.contextValue, 'content',
      'should no longer show as loaded after file deleted and pruned');
  });

  // ── Scenario 5: No gitInfo → not stale ──────────────────────────────

  it('item with no gitInfo is never stale even if lastModified is undefined', async () => {
    const summary = makeSummary('item-5', 'No Git Rule'); // no gitDate
    await service.equipItems([makeContentItem(summary)], 'claude', tmpDir);

    provider.update([makeSource()], [makeResolved()], makeScanResults([summary]));
    provider.setEquippedMap(service.getEquippedMap());

    const treeItem = getTreeItem(provider, 'item-5');
    assert.strictEqual(treeItem?.contextValue, 'content-loaded');
    assert.notStrictEqual(treeItem?.description, '⚠ updated since loaded',
      'item without git metadata should never show stale');
    assert.strictEqual(treeItem?.description, '(loaded)');
  });

  // ── Scenario 6: Multiple items tracked independently ─────────────────

  it('multiple items each track their own loaded/stale state independently', async () => {
    const dateA = '2024-01-10T00:00:00Z';
    const dateB = '2024-06-01T00:00:00Z';

    const summaryA = makeSummary('item-6a', 'Rule A', dateA);
    const summaryB = makeSummary('item-6b', 'Rule B', dateB);

    // Load A with old date, B with current date
    await service.equipItems([makeContentItem(summaryA)], 'claude', tmpDir);
    // Simulate B was loaded with its current date
    await service.equipItems([makeContentItem(summaryB)], 'claude', tmpDir);

    // Simulate: source repo shows A has been updated to a newer date
    const updatedSummaryA = makeSummary('item-6a', 'Rule A', '2024-12-01T00:00:00Z');
    provider.update([makeSource()], [makeResolved()], makeScanResults([updatedSummaryA, summaryB]));
    provider.setEquippedMap(service.getEquippedMap());

    const allRoots = provider.getChildren();
    const children = provider.getChildren(allRoots[0]) as ContentTreeItem[];

    const itemA = children.find((c) => c.summary.id === 'item-6a');
    const itemB = children.find((c) => c.summary.id === 'item-6b');

    assert.strictEqual(itemA?.description, '⚠ updated since loaded',
      'Item A should be stale (source has newer date)');
    assert.strictEqual(itemB?.description, '(loaded)',
      'Item B should not be stale (dates match)');
  });

  // ── Scenario 7: Re-equipping updates the record ───────────────────────

  it('re-equipping a loaded item updates its equipped record', async () => {
    const date1 = '2024-01-01T00:00:00Z';
    const date2 = '2024-06-01T00:00:00Z';

    const summary1 = makeSummary('item-7', 'My Rule', date1);
    await service.equipItems([makeContentItem(summary1)], 'claude', tmpDir);

    const record1 = service.getEquippedMap()['item-7'];
    assert.strictEqual(record1.lastModified, date1);

    // Re-equip with updated git date (user re-loads after source update)
    const summary2 = makeSummary('item-7', 'My Rule', date2);
    await service.equipItems([makeContentItem(summary2)], 'claude', tmpDir);

    const record2 = service.getEquippedMap()['item-7'];
    assert.strictEqual(record2.lastModified, date2, 'record should be updated with new date');

    // Tree should show as loaded, not stale
    provider.update([makeSource()], [makeResolved()], makeScanResults([summary2]));
    provider.setEquippedMap(service.getEquippedMap());

    const treeItem = getTreeItem(provider, 'item-7');
    assert.strictEqual(treeItem?.description, '(loaded)',
      'after re-equip, item should show loaded and not stale');
  });

  // ── Scenario 8: Content type routing ─────────────────────────────────

  it('claude skills go to .claude/commands/ not .claude/rules/', async () => {
    const summary: ContentSummary = {
      id: 'skill-id',
      repoUrl: REPO_URL,
      filePath: 'skills/my-skill.md',
      metadata: { name: 'My Skill', description: '', contentType: 'skill' },
    };
    await service.equipItems([makeContentItem(summary)], 'claude', tmpDir);

    const record = service.getEquippedMap()['skill-id'];
    assert.ok(record.path.includes('.claude/commands'), `expected .claude/commands in path, got: ${record.path}`);
    assert.ok(!record.path.includes('.claude/rules'), `path should NOT be in rules: ${record.path}`);
  });

  it('claude subagents go to .claude/agents/', async () => {
    const summary: ContentSummary = {
      id: 'agent-id',
      repoUrl: REPO_URL,
      filePath: 'agents/my-agent.md',
      metadata: { name: 'My Agent', description: 'Does things', contentType: 'subagent' },
    };
    await service.equipItems([makeContentItem(summary)], 'claude', tmpDir);

    const record = service.getEquippedMap()['agent-id'];
    assert.ok(record.path.includes('.claude/agents'), `expected .claude/agents in path, got: ${record.path}`);
  });

  it('copilot subagents go to .github/agents/ with .agent.md extension', async () => {
    const summary: ContentSummary = {
      id: 'copilot-agent-id',
      repoUrl: REPO_URL,
      filePath: 'agents/my-agent.md',
      metadata: { name: 'My Copilot Agent', description: 'Does things', contentType: 'subagent' },
    };
    await service.equipItems([makeContentItem(summary)], 'copilot', tmpDir);

    const record = service.getEquippedMap()['copilot-agent-id'];
    assert.ok(record.path.includes('.github/agents'), `expected .github/agents in path, got: ${record.path}`);
    assert.ok(record.path.endsWith('.agent.md'), `expected .agent.md extension, got: ${record.path}`);
  });

  it('copilot skills go to .github/prompts/ with .prompt.md extension', async () => {
    const summary: ContentSummary = {
      id: 'copilot-skill-id',
      repoUrl: REPO_URL,
      filePath: 'skills/my-skill.md',
      metadata: { name: 'My Copilot Skill', description: '', contentType: 'skill' },
    };
    await service.equipItems([makeContentItem(summary)], 'copilot', tmpDir);

    const record = service.getEquippedMap()['copilot-skill-id'];
    assert.ok(record.path.includes('.github/prompts'), `expected .github/prompts in path, got: ${record.path}`);
    assert.ok(record.path.endsWith('.prompt.md'), `expected .prompt.md extension, got: ${record.path}`);
  });
});

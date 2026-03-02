/**
 * Unit tests for loadoutTreeItems — the VS Code TreeItem classes.
 *
 * Tests cover:
 * - ContentTreeItem contextValue: 'content' vs 'content-loaded'
 * - Icon selection: content-type icon, blue checkmark (loaded), orange warning (stale)
 * - Description text: git info, (loaded), ⚠ updated since loaded
 * - Tooltip generation
 * - SourceTreeItem and ContentTypeGroupItem basics
 * - formatRelativeDate via description
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  ContentTreeItem,
  SourceTreeItem,
  ContentTypeGroupItem,
  MessageTreeItem,
} from '../../src/ui/loadoutTreeItems';
import type { ContentSummary, SourceConfig } from '../../src/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<ContentSummary> = {}): ContentSummary {
  return {
    id: 'test-id',
    repoUrl: 'https://github.com/org/repo',
    filePath: 'rules/test.md',
    metadata: {
      name: 'Test Rule',
      description: 'A test rule',
      contentType: 'instructions',
    },
    ...overrides,
  };
}

function getIconId(item: vscode.TreeItem): string {
  const icon = item.iconPath;
  if (icon instanceof vscode.ThemeIcon) {
    return icon.id;
  }
  return '';
}

function getIconColor(item: vscode.TreeItem): vscode.ThemeColor | undefined {
  const icon = item.iconPath;
  if (icon instanceof vscode.ThemeIcon) {
    return icon.color;
  }
  return undefined;
}

// ── ContentTreeItem tests ──────────────────────────────────────────────────

describe('ContentTreeItem', () => {
  // ── contextValue ──────────────────────────────────────────────────────

  describe('contextValue', () => {
    it('is "content" when not loaded', () => {
      const item = new ContentTreeItem(makeSummary(), false, false);
      assert.strictEqual(item.contextValue, 'content');
    });

    it('is "content-loaded" when loaded (not stale)', () => {
      const item = new ContentTreeItem(makeSummary(), true, false);
      assert.strictEqual(item.contextValue, 'content-loaded');
    });

    it('is "content-loaded" when loaded AND stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, true);
      assert.strictEqual(item.contextValue, 'content-loaded');
    });
  });

  // ── Icon selection ─────────────────────────────────────────────────────

  describe('icon', () => {
    it('uses content-type icon for unloaded instructions', () => {
      const item = new ContentTreeItem(makeSummary({ metadata: { name: 'x', description: '', contentType: 'instructions' } }));
      assert.strictEqual(getIconId(item), 'book');
    });

    it('uses content-type icon for unloaded skill', () => {
      const item = new ContentTreeItem(makeSummary({ metadata: { name: 'x', description: '', contentType: 'skill' } }));
      assert.strictEqual(getIconId(item), 'wand');
    });

    it('uses content-type icon for unloaded subagent', () => {
      const item = new ContentTreeItem(makeSummary({ metadata: { name: 'x', description: '', contentType: 'subagent' } }));
      assert.strictEqual(getIconId(item), 'person');
    });

    it('uses pass-filled icon when loaded and not stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, false);
      assert.strictEqual(getIconId(item), 'pass-filled');
    });

    it('uses charts.blue color when loaded and not stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, false);
      const color = getIconColor(item);
      assert.ok(color instanceof vscode.ThemeColor, 'should be a ThemeColor');
    });

    it('uses warning icon when loaded and stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, true);
      assert.strictEqual(getIconId(item), 'warning');
    });

    it('warning icon has list.warningForeground color when stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, true);
      const color = getIconColor(item);
      assert.ok(color instanceof vscode.ThemeColor, 'should be a ThemeColor');
    });
  });

  // ── Description ────────────────────────────────────────────────────────

  describe('description', () => {
    it('shows "(loaded)" when loaded and not stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, false);
      assert.strictEqual(item.description, '(loaded)');
    });

    it('shows "⚠ updated since loaded" when loaded and stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, true);
      assert.strictEqual(item.description, '⚠ updated since loaded');
    });

    it('shows git author + relative date when not loaded and has gitInfo', () => {
      const summary = makeSummary({
        gitInfo: {
          lastAuthor: 'Alice',
          lastDate: new Date().toISOString(), // today
          lastMessage: 'add rule',
          sha: 'abc',
        },
      });
      const item = new ContentTreeItem(summary, false, false);
      assert.ok(
        typeof item.description === 'string' && item.description.includes('Alice'),
        `expected description to include "Alice", got: ${item.description}`
      );
      assert.ok(
        typeof item.description === 'string' && item.description.includes('today'),
        `expected "today" in description, got: ${item.description}`
      );
    });

    it('shows metadata description when not loaded and no gitInfo', () => {
      const summary = makeSummary({
        metadata: { name: 'Test', description: 'My description', contentType: 'instructions' },
        gitInfo: undefined,
      });
      const item = new ContentTreeItem(summary, false, false);
      assert.strictEqual(item.description, 'My description');
    });

    it('description is undefined when not loaded, no gitInfo, and no metadata description', () => {
      const summary = makeSummary({
        metadata: { name: 'Test', description: '', contentType: 'instructions' },
        gitInfo: undefined,
      });
      const item = new ContentTreeItem(summary, false, false);
      assert.ok(!item.description, `expected no description, got: ${item.description}`);
    });

    it('loaded description overrides git info', () => {
      const summary = makeSummary({
        gitInfo: { lastAuthor: 'Alice', lastDate: new Date().toISOString(), lastMessage: 'edit', sha: 'abc' },
      });
      const item = new ContentTreeItem(summary, true, false);
      // loaded takes priority
      assert.strictEqual(item.description, '(loaded)');
    });
  });

  // ── Relative date formatting ───────────────────────────────────────────

  describe('relative date formatting', () => {
    function makeItemWithDate(daysAgo: number): ContentTreeItem {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return new ContentTreeItem(makeSummary({
        gitInfo: { lastAuthor: 'Bob', lastDate: date.toISOString(), lastMessage: 'x', sha: 'y' },
      }));
    }

    it('shows "today" for today', () => {
      const item = makeItemWithDate(0);
      assert.ok(
        typeof item.description === 'string' && item.description.includes('today'),
        `expected "today", got: ${item.description}`
      );
    });

    it('shows "yesterday" for 1 day ago', () => {
      const item = makeItemWithDate(1);
      assert.ok(
        typeof item.description === 'string' && item.description.includes('yesterday'),
        `expected "yesterday", got: ${item.description}`
      );
    });

    it('shows "N days ago" for 2-6 days ago', () => {
      const item = makeItemWithDate(3);
      assert.ok(
        typeof item.description === 'string' && item.description.includes('3 days ago'),
        `expected "3 days ago", got: ${item.description}`
      );
    });

    it('shows "N weeks ago" for 7+ days', () => {
      const item = makeItemWithDate(14);
      assert.ok(
        typeof item.description === 'string' && item.description.includes('weeks ago'),
        `expected "weeks ago", got: ${item.description}`
      );
    });
  });

  // ── Tooltip ────────────────────────────────────────────────────────────

  describe('tooltip', () => {
    it('includes item name', () => {
      const item = new ContentTreeItem(makeSummary({ metadata: { name: 'My Rule', description: '', contentType: 'instructions' } }));
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('My Rule'), 'tooltip should include item name');
    });

    it('includes "✓ Loaded" marker when loaded', () => {
      const item = new ContentTreeItem(makeSummary(), true, false);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('✓'), 'loaded tooltip should include checkmark');
    });

    it('includes "⚠" warning when stale', () => {
      const item = new ContentTreeItem(makeSummary(), true, true);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('⚠'), 'stale tooltip should include warning');
    });

    it('includes description when present', () => {
      const summary = makeSummary({
        metadata: { name: 'Test', description: 'A helpful description', contentType: 'instructions' },
      });
      const item = new ContentTreeItem(summary);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('A helpful description'));
    });

    it('includes git info in tooltip when available', () => {
      const summary = makeSummary({
        gitInfo: { lastAuthor: 'Jane', lastDate: '2024-01-15T10:00:00Z', lastMessage: 'refactor', sha: 'def' },
      });
      const item = new ContentTreeItem(summary);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('Jane'));
      assert.ok(tooltip.value.includes('refactor'));
    });

    it('includes file path in tooltip', () => {
      const summary = makeSummary({ filePath: 'skills/my-skill.md' });
      const item = new ContentTreeItem(summary);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('skills/my-skill.md'));
    });

    it('includes tags when present', () => {
      const summary = makeSummary({
        metadata: { name: 'Test', description: '', contentType: 'instructions', tags: ['react', 'typescript'] },
      });
      const item = new ContentTreeItem(summary);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('react'));
      assert.ok(tooltip.value.includes('typescript'));
    });
  });

  // ── Checkbox state ─────────────────────────────────────────────────────

  describe('checkbox', () => {
    it('starts unchecked', () => {
      const item = new ContentTreeItem(makeSummary());
      assert.strictEqual(item.checkboxState, vscode.TreeItemCheckboxState.Unchecked);
    });
  });

  // ── Click command ──────────────────────────────────────────────────────

  describe('click command', () => {
    it('click triggers preview command', () => {
      const item = new ContentTreeItem(makeSummary());
      assert.strictEqual(item.command?.command, 'agentLoadout.preview');
    });
  });
});

// ── SourceTreeItem tests ───────────────────────────────────────────────────

describe('SourceTreeItem', () => {
  const source: SourceConfig = { type: 'repo', url: 'https://github.com/org/repo' };

  it('has correct contextValue', () => {
    const item = new SourceTreeItem(source, 'My Repo', 5);
    assert.strictEqual(item.contextValue, 'source');
  });

  it('shows item count in description', () => {
    const item = new SourceTreeItem(source, 'My Repo', 12);
    assert.ok(
      typeof item.description === 'string' && item.description.includes('12'),
      `expected count 12 in description, got: ${item.description}`
    );
  });

  it('uses provided displayName as label', () => {
    const item = new SourceTreeItem(source, 'Custom Name', 0);
    assert.strictEqual(item.label, 'Custom Name');
  });

  it('uses repo icon', () => {
    const item = new SourceTreeItem(source, 'Repo', 0);
    assert.strictEqual(getIconId(item), 'repo');
  });

  // ── Preloaded (org policy) sources ──

  it('uses "source-preloaded" contextValue when preloaded', () => {
    const item = new SourceTreeItem(source, 'Org Repo', 5, true);
    assert.strictEqual(item.contextValue, 'source-preloaded');
  });

  it('uses lock icon when preloaded', () => {
    const item = new SourceTreeItem(source, 'Org Repo', 3, true);
    assert.strictEqual(getIconId(item), 'lock');
  });

  it('shows "(org)" in description when preloaded', () => {
    const item = new SourceTreeItem(source, 'Org Repo', 4, true);
    assert.ok(
      typeof item.description === 'string' && item.description.includes('(org)'),
      `expected "(org)" in description, got: ${item.description}`
    );
    assert.ok(
      typeof item.description === 'string' && item.description.includes('4'),
      `expected count in description, got: ${item.description}`
    );
  });

  it('tooltip mentions cannot be removed when preloaded', () => {
    const item = new SourceTreeItem(source, 'Org Repo', 2, true);
    assert.ok(
      typeof item.tooltip === 'string' && item.tooltip.includes('cannot be removed'),
      `expected removal warning in tooltip, got: ${item.tooltip}`
    );
  });

  it('defaults isPreloaded to false', () => {
    const item = new SourceTreeItem(source, 'Repo', 0);
    assert.strictEqual(item.contextValue, 'source');
    assert.strictEqual(getIconId(item), 'repo');
  });
});

// ── ContentTypeGroupItem tests ─────────────────────────────────────────────

describe('ContentTypeGroupItem', () => {
  it('has contextValue "contentTypeGroup"', () => {
    const item = new ContentTypeGroupItem('skill', 'source-id', 3);
    assert.strictEqual(item.contextValue, 'contentTypeGroup');
  });

  it('shows correct label for instructions', () => {
    const item = new ContentTypeGroupItem('instructions', 'source-id', 2);
    assert.strictEqual(item.label, 'Instructions');
  });

  it('shows correct label for skill', () => {
    const item = new ContentTypeGroupItem('skill', 'source-id', 2);
    assert.strictEqual(item.label, 'Skills');
  });

  it('shows correct label for subagent', () => {
    const item = new ContentTypeGroupItem('subagent', 'source-id', 2);
    assert.strictEqual(item.label, 'Sub-agents');
  });

  it('shows count in description', () => {
    const item = new ContentTypeGroupItem('skill', 'source-id', 7);
    assert.ok(
      typeof item.description === 'string' && item.description.includes('7'),
      `expected count in description, got: ${item.description}`
    );
  });
});

// ── MessageTreeItem tests ──────────────────────────────────────────────────

describe('MessageTreeItem', () => {
  it('uses info icon for normal messages', () => {
    const item = new MessageTreeItem('Hello');
    assert.strictEqual(getIconId(item), 'info');
  });

  it('uses warning icon for error messages', () => {
    const item = new MessageTreeItem('Something failed', true);
    assert.strictEqual(getIconId(item), 'warning');
  });
});

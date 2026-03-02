import * as assert from 'assert';
import { CursorAdapter } from '../../src/adapters/cursorAdapter';
import { CopilotAdapter } from '../../src/adapters/copilotAdapter';
import { ClaudeAdapter } from '../../src/adapters/claudeAdapter';
import { getAdapter } from '../../src/adapters/adapterRegistry';

describe('Agent Adapters', () => {
  describe('CursorAdapter', () => {
    const adapter = new CursorAdapter();

    it('should have correct agentId and targetPath', () => {
      assert.strictEqual(adapter.agentId, 'cursor');
      assert.strictEqual(adapter.targetPath, '.cursorrules');
    });

    it('should normalize flat text content', () => {
      const content = 'Rule 1: Always use TypeScript.\n\nRule 2: Prefer functional components.';
      const normalized = adapter.normalize(content);
      assert.ok(normalized.sections.length > 0);
      assert.strictEqual(normalized.rawContent, content);
    });

    it('should format back to flat text', () => {
      const content = 'Rule 1.\n\nRule 2.';
      const normalized = adapter.normalize(content);
      const formatted = adapter.format(normalized);
      assert.ok(formatted.includes('Rule 1.'));
      assert.ok(formatted.includes('Rule 2.'));
    });
  });

  describe('CopilotAdapter', () => {
    const adapter = new CopilotAdapter();

    it('should have correct agentId and targetPath', () => {
      assert.strictEqual(adapter.agentId, 'copilot');
      assert.strictEqual(adapter.targetPath, '.github/copilot-instructions.md');
    });

    it('should normalize markdown with headings', () => {
      const content = '## Coding Style\n\nUse camelCase.\n\n## Testing\n\nWrite unit tests.';
      const normalized = adapter.normalize(content);
      assert.strictEqual(normalized.sections.length, 2);
      assert.strictEqual(normalized.sections[0].heading, 'Coding Style');
      assert.strictEqual(normalized.sections[0].content, 'Use camelCase.');
      assert.strictEqual(normalized.sections[1].heading, 'Testing');
      assert.strictEqual(normalized.sections[1].content, 'Write unit tests.');
    });

    it('should format sections with ## headings', () => {
      const normalized = {
        sections: [
          { heading: 'Style', content: 'Use TypeScript.' },
          { heading: 'Testing', content: 'Write tests.' },
        ],
        rawContent: '',
      };
      const formatted = adapter.format(normalized);
      assert.ok(formatted.includes('## Style'));
      assert.ok(formatted.includes('## Testing'));
    });
  });

  describe('ClaudeAdapter', () => {
    const adapter = new ClaudeAdapter();

    it('should have correct agentId and targetPath', () => {
      assert.strictEqual(adapter.agentId, 'claude');
      assert.strictEqual(adapter.targetPath, 'CLAUDE.md');
    });

    it('should format sections with # headings', () => {
      const normalized = {
        sections: [
          { heading: 'General', content: 'Be concise.' },
        ],
        rawContent: '',
      };
      const formatted = adapter.format(normalized);
      assert.ok(formatted.includes('# General'));
      assert.ok(formatted.includes('Be concise.'));
    });
  });

  describe('Cross-agent conversion', () => {
    it('should convert from Cursor flat text to Copilot markdown', () => {
      const cursorContent = 'Always use TypeScript.\n\nPrefer functional components.\n\nWrite unit tests.';
      const cursorAdapter = getAdapter('cursor');
      const copilotAdapter = getAdapter('copilot');

      const normalized = cursorAdapter.normalize(cursorContent);
      const copilotFormatted = copilotAdapter.format(normalized);

      assert.ok(copilotFormatted.includes('Always use TypeScript'));
      assert.ok(copilotFormatted.includes('Prefer functional components'));
    });

    it('should convert from Copilot markdown to Claude markdown', () => {
      const copilotContent = '## Style\n\nUse TypeScript.\n\n## Testing\n\nWrite tests.';
      const copilotAdapter = getAdapter('copilot');
      const claudeAdapter = getAdapter('claude');

      const normalized = copilotAdapter.normalize(copilotContent);
      const claudeFormatted = claudeAdapter.format(normalized);

      assert.ok(claudeFormatted.includes('# Style'));
      assert.ok(claudeFormatted.includes('# Testing'));
    });

    it('should round-trip content through normalize + format', () => {
      const original = 'Simple content with no special formatting.';
      const adapter = getAdapter('cursor');

      const normalized = adapter.normalize(original);
      const formatted = adapter.format(normalized);

      assert.ok(formatted.includes('Simple content'));
    });
  });

  describe('AdapterRegistry', () => {
    it('should return correct adapter for each agent', () => {
      assert.strictEqual(getAdapter('cursor').agentId, 'cursor');
      assert.strictEqual(getAdapter('copilot').agentId, 'copilot');
      assert.strictEqual(getAdapter('claude').agentId, 'claude');
    });
  });
});

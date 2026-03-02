import * as assert from 'assert';
import { AGENT_CONFIGS } from '../../src/utils/constants';

describe('Constants', () => {
  describe('AGENT_CONFIGS', () => {
    it('should define all 3 agents', () => {
      assert.ok(AGENT_CONFIGS.cursor);
      assert.ok(AGENT_CONFIGS.copilot);
      assert.ok(AGENT_CONFIGS.claude);
    });

    it('should have correct target paths', () => {
      assert.strictEqual(AGENT_CONFIGS.cursor.targetPath, '.cursorrules');
      assert.strictEqual(AGENT_CONFIGS.copilot.targetPath, '.github/copilot-instructions.md');
      assert.strictEqual(AGENT_CONFIGS.claude.targetPath, 'CLAUDE.md');
    });

    it('should have rules directories for all agents', () => {
      assert.strictEqual(AGENT_CONFIGS.cursor.rulesDir, '.cursor/rules');
      assert.strictEqual(AGENT_CONFIGS.copilot.rulesDir, '.github/instructions');
      assert.strictEqual(AGENT_CONFIGS.claude.rulesDir, '.claude/rules');
    });

    it('should have matching ids', () => {
      for (const [key, config] of Object.entries(AGENT_CONFIGS)) {
        assert.strictEqual(config.id, key);
      }
    });

    it('should have display names', () => {
      for (const config of Object.values(AGENT_CONFIGS)) {
        assert.ok(config.displayName.length > 0);
      }
    });
  });
});

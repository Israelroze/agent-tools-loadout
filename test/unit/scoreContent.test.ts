import * as assert from 'assert';
import { scoreContent } from '../../src/services/metadataParser';

describe('scoreContent', () => {
  // ── Known filenames ────────────────────────────────────────────────────────

  describe('known filenames', () => {
    it('gives +30 for .cursorrules', () => {
      const score = scoreContent('', '.cursorrules', false);
      assert.ok(score >= 30, `expected >= 30, got ${score}`);
    });

    it('gives +30 for .clinerules', () => {
      const score = scoreContent('', '.clinerules', false);
      assert.ok(score >= 30, `expected >= 30, got ${score}`);
    });

    it('gives +30 for claude.md', () => {
      const score = scoreContent('', 'claude.md', false);
      assert.ok(score >= 30, `expected >= 30, got ${score}`);
    });

    it('gives +30 for copilot-instructions.md', () => {
      const score = scoreContent('', 'copilot-instructions.md', false);
      assert.ok(score >= 30, `expected >= 30, got ${score}`);
    });

    it('is case-insensitive for known names', () => {
      const score = scoreContent('', 'CLAUDE.MD', false);
      assert.ok(score >= 30, `expected >= 30, got ${score}`);
    });
  });

  // ── Instruction directories ────────────────────────────────────────────────

  describe('instruction directories', () => {
    it('gives +30 when insideInstructionDir=true', () => {
      const score = scoreContent('', 'agents/my-agent.md', true);
      assert.ok(score >= 30, `expected >= 30, got ${score}`);
    });

    it('gives 0 dir bonus when insideInstructionDir=false', () => {
      // Plain file, no dir bonus, no other signals
      const score = scoreContent('just text', 'random/file.md', false);
      assert.ok(score < 30, `expected < 30 for plain file outside dir, got ${score}`);
    });
  });

  // ── Filename patterns ──────────────────────────────────────────────────────

  describe('filename patterns', () => {
    it('gives +20 for .agent.md suffix', () => {
      const score = scoreContent('', 'something.agent.md', false);
      assert.ok(score >= 20, `expected >= 20, got ${score}`);
    });

    it('gives +20 for .prompt.md suffix', () => {
      const score = scoreContent('', 'my-skill.prompt.md', false);
      assert.ok(score >= 20, `expected >= 20, got ${score}`);
    });

    it('gives +20 for .mdc extension', () => {
      const score = scoreContent('', 'rules/style.mdc', false);
      assert.ok(score >= 20, `expected >= 20, got ${score}`);
    });
  });

  // ── Frontmatter type field (strongest signal) ──────────────────────────────

  describe('frontmatter type field', () => {
    it('gives +40 for explicit type field', () => {
      const raw = `---\ntype: skill\n---\nSome content`;
      const score = scoreContent(raw, 'file.md', false);
      assert.ok(score >= 40, `expected >= 40, got ${score}`);
    });

    it('gives +50 for type + description fields', () => {
      const raw = `---\ntype: subagent\ndescription: My agent\n---\nContent`;
      const score = scoreContent(raw, 'file.md', false);
      assert.ok(score >= 50, `expected >= 50, got ${score}`);
    });

    it('gives +10 for description field alone (no type)', () => {
      const raw = `---\ndescription: My description\n---\nContent`;
      const baseScore = scoreContent(raw, 'file.md', false);
      const noFmScore = scoreContent('Content', 'file.md', false);
      assert.ok(baseScore > noFmScore, 'description field should increase score');
    });
  });

  // ── Content heuristics ─────────────────────────────────────────────────────

  describe('content heuristics (no frontmatter type)', () => {
    it('gives bonus for "you are a" pattern', () => {
      const raw = 'You are a senior React developer.';
      const score = scoreContent(raw, 'file.md', false);
      // at least heuristic bonus
      assert.ok(score >= 10, `expected >= 10, got ${score}`);
    });

    it('gives larger bonus for 2+ heuristic patterns', () => {
      const raw = 'You are a developer.\n\n## Instructions\nFollow these rules.';
      const score = scoreContent(raw, 'file.md', false);
      assert.ok(score >= 20, `expected >= 20, got ${score}`);
    });

    it('does NOT apply content heuristics when frontmatter type is present', () => {
      const withType = `---\ntype: skill\n---\nYou are a developer.\n\n## Instructions`;
      const withoutType = 'You are a developer.\n\n## Instructions';
      const scoreWith = scoreContent(withType, 'file.md', false);
      const scoreWithout = scoreContent(withoutType, 'file.md', false);
      // Type field gives +40, heuristics give +20 — with type should be higher
      // but the point is heuristics don't double-stack on top of type
      assert.ok(scoreWith >= 40);
      assert.ok(scoreWithout <= scoreWith);
    });
  });

  // ── Score cap ──────────────────────────────────────────────────────────────

  describe('score cap', () => {
    it('never exceeds 100 even with all signals present', () => {
      const raw = `---\ntype: skill\ndescription: Everything\n---\n` +
        'You are a developer.\n## Instructions\nAct as a mentor.';
      const score = scoreContent(raw, 'claude.md', true);
      assert.ok(score <= 100, `expected <= 100, got ${score}`);
    });
  });

  // ── Threshold behaviour ────────────────────────────────────────────────────

  describe('threshold filtering', () => {
    it('plain markdown outside instruction dir scores below medium threshold (40)', () => {
      const raw = 'This is a general readme about the project structure.';
      const score = scoreContent(raw, 'docs/overview.md', false);
      assert.ok(score < 40, `expected < 40 for boilerplate-like file, got ${score}`);
    });

    it('file inside agents/ dir scores above low threshold (10)', () => {
      const raw = 'Some agent instructions.';
      const score = scoreContent(raw, 'agents/my-agent.md', true);
      assert.ok(score >= 10, `expected >= 10, got ${score}`);
    });

    it('frontmatter-typed file scores above high threshold (70)', () => {
      const raw = `---\ntype: subagent\ndescription: My agent\n---\nYou are a developer.\n## Role`;
      // type(40) + description(10) + filename in instruction dir bonus if any — needs more
      // Use dir context to push it over
      const score = scoreContent(raw, 'agents/dev.md', true);
      assert.ok(score >= 70, `expected >= 70 with dir + frontmatter, got ${score}`);
    });
  });
});

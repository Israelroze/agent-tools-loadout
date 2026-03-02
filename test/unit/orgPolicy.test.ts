import * as assert from 'assert';
import { extractOrigin, validateOriginAgainst } from '../../src/services/orgPolicy';

describe('OrgPolicy', () => {
  // ── extractOrigin ─────────────────────────────────────────────────────

  describe('extractOrigin', () => {
    it('extracts origin from HTTPS GitHub URL', () => {
      assert.strictEqual(
        extractOrigin('https://github.com/my-org/repo'),
        'github.com/my-org'
      );
    });

    it('extracts origin from HTTPS GitHub URL with .git suffix', () => {
      assert.strictEqual(
        extractOrigin('https://github.com/my-org/repo.git'),
        'github.com/my-org'
      );
    });

    it('extracts origin from SSH GitHub URL', () => {
      assert.strictEqual(
        extractOrigin('git@github.com:my-org/repo.git'),
        'github.com/my-org'
      );
    });

    it('extracts origin from SSH URL with ssh:// prefix', () => {
      assert.strictEqual(
        extractOrigin('ssh://git@github.com/my-org/repo.git'),
        'github.com/my-org'
      );
    });

    it('extracts origin from GitHub Enterprise domain', () => {
      assert.strictEqual(
        extractOrigin('https://github.acme-corp.com/team/repo.git'),
        'github.acme-corp.com/team'
      );
    });

    it('extracts origin from GHE SSH URL', () => {
      assert.strictEqual(
        extractOrigin('git@github.acme-corp.com:team/repo.git'),
        'github.acme-corp.com/team'
      );
    });

    it('extracts origin from GitLab URL with nested groups', () => {
      assert.strictEqual(
        extractOrigin('https://gitlab.corp.com/group/sub/repo.git'),
        'gitlab.corp.com/group/sub'
      );
    });

    it('extracts host-only when repo is directly under host', () => {
      assert.strictEqual(
        extractOrigin('https://gitlab.corp.com/repo.git'),
        'gitlab.corp.com'
      );
    });

    it('normalizes to lowercase', () => {
      assert.strictEqual(
        extractOrigin('https://GitHub.COM/My-Org/Repo.git'),
        'github.com/my-org'
      );
    });

    it('returns null for invalid URL', () => {
      assert.strictEqual(extractOrigin('not-a-url'), null);
    });
  });

  // ── validateOriginAgainst ─────────────────────────────────────────────

  describe('validateOriginAgainst', () => {
    it('allows all URLs when allowedOrigins is empty', () => {
      const result = validateOriginAgainst('https://github.com/any/repo.git', []);
      assert.deepStrictEqual(result, { allowed: true });
    });

    it('allows URL matching an allowed origin exactly', () => {
      const result = validateOriginAgainst(
        'https://github.acme-corp.com/team/repo.git',
        ['github.acme-corp.com/team']
      );
      assert.deepStrictEqual(result, { allowed: true });
    });

    it('allows URL when origin is a prefix of allowed origin', () => {
      // allowedOrigins: ["github.acme-corp.com"] should match any team under that host
      const result = validateOriginAgainst(
        'https://github.acme-corp.com/any-team/repo.git',
        ['github.acme-corp.com']
      );
      assert.deepStrictEqual(result, { allowed: true });
    });

    it('rejects URL not matching any allowed origin', () => {
      const result = validateOriginAgainst(
        'https://github.com/external-org/repo.git',
        ['github.acme-corp.com']
      );
      assert.strictEqual(result.allowed, false);
      assert.ok('reason' in result && result.reason.length > 0);
    });

    it('rejects URL from different org on same host', () => {
      const result = validateOriginAgainst(
        'https://github.com/other-org/repo.git',
        ['github.com/my-org']
      );
      assert.strictEqual(result.allowed, false);
    });

    it('allows SSH URL matching allowed origin', () => {
      const result = validateOriginAgainst(
        'git@github.acme-corp.com:team/repo.git',
        ['github.acme-corp.com']
      );
      assert.deepStrictEqual(result, { allowed: true });
    });

    it('is case-insensitive for origin matching', () => {
      const result = validateOriginAgainst(
        'https://GitHub.ACME-CORP.com/Team/repo.git',
        ['github.acme-corp.com']
      );
      assert.deepStrictEqual(result, { allowed: true });
    });

    it('returns descriptive reason when rejecting', () => {
      const result = validateOriginAgainst(
        'https://github.com/evil/repo.git',
        ['github.acme-corp.com']
      );
      assert.strictEqual(result.allowed, false);
      if (!result.allowed) {
        assert.ok(result.reason.includes('github.com/evil'));
        assert.ok(result.reason.includes('github.acme-corp.com'));
      }
    });

    it('returns not-allowed for unparseable URLs', () => {
      const result = validateOriginAgainst('not-a-url', ['github.acme-corp.com']);
      assert.strictEqual(result.allowed, false);
    });

    it('supports multiple allowed origins', () => {
      const allowed = ['github.acme-corp.com', 'gitlab.internal.com'];
      const result1 = validateOriginAgainst('https://github.acme-corp.com/t/r.git', allowed);
      const result2 = validateOriginAgainst('https://gitlab.internal.com/g/r.git', allowed);
      const result3 = validateOriginAgainst('https://github.com/ext/r.git', allowed);
      assert.deepStrictEqual(result1, { allowed: true });
      assert.deepStrictEqual(result2, { allowed: true });
      assert.strictEqual(result3.allowed, false);
    });
  });
});

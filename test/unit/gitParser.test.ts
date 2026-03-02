import * as assert from 'assert';

// We test the git log output parser logic directly.
// Since parseGitLogOutput is a private function, we test it through the module's exports
// by importing the git module and testing gitLogAllFiles with mocked execFile.
// For now, we test the parsing logic extracted here.

describe('Git log output parser', () => {
  // Inline the parser logic for unit testing
  function parseGitLogOutput(output: string): Map<string, { sha: string; lastAuthor: string; lastDate: string; lastMessage: string }> {
    const result = new Map<string, { sha: string; lastAuthor: string; lastDate: string; lastMessage: string }>();
    const lines = output.split('\n');

    let currentInfo: { sha: string; lastAuthor: string; lastDate: string; lastMessage: string } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split('|');
      if (parts.length >= 4 && /^[0-9a-f]{40}$/.test(parts[0])) {
        currentInfo = {
          sha: parts[0],
          lastAuthor: parts[1],
          lastDate: parts[2],
          lastMessage: parts.slice(3).join('|'),
        };
      } else if (currentInfo && trimmed.length > 0) {
        if (!result.has(trimmed)) {
          result.set(trimmed, currentInfo);
        }
      }
    }

    return result;
  }

  it('should parse single commit with one file', () => {
    const output = `${'a'.repeat(40)}|Jane Doe|2025-12-15T10:30:00+00:00|Initial commit

skills/react.md
`;

    const map = parseGitLogOutput(output);
    assert.strictEqual(map.size, 1);

    const info = map.get('skills/react.md');
    assert.ok(info);
    assert.strictEqual(info.lastAuthor, 'Jane Doe');
    assert.strictEqual(info.lastMessage, 'Initial commit');
  });

  it('should parse multiple commits and keep most recent per file', () => {
    const sha1 = 'a'.repeat(40);
    const sha2 = 'b'.repeat(40);

    const output = `${sha1}|Alice|2025-12-20T10:00:00Z|Latest update

skills/react.md
skills/vue.md

${sha2}|Bob|2025-12-15T10:00:00Z|Older commit

skills/react.md
skills/python.md
`;

    const map = parseGitLogOutput(output);
    assert.strictEqual(map.size, 3);

    // react.md should have Alice's info (most recent, listed first)
    assert.strictEqual(map.get('skills/react.md')?.lastAuthor, 'Alice');
    assert.strictEqual(map.get('skills/vue.md')?.lastAuthor, 'Alice');
    assert.strictEqual(map.get('skills/python.md')?.lastAuthor, 'Bob');
  });

  it('should handle commit messages with pipe characters', () => {
    const sha = 'c'.repeat(40);
    const output = `${sha}|Dev|2025-01-01T00:00:00Z|fix: handle edge|case properly

file.md
`;

    const map = parseGitLogOutput(output);
    assert.strictEqual(map.get('file.md')?.lastMessage, 'fix: handle edge|case properly');
  });

  it('should handle empty output', () => {
    const map = parseGitLogOutput('');
    assert.strictEqual(map.size, 0);
  });
});

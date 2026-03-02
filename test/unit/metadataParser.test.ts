import * as assert from 'assert';
import { parseContentFile } from '../../src/services/metadataParser';

describe('metadataParser', () => {
  it('should parse full YAML front-matter', () => {
    const raw = `---
name: React Architect
description: Instructs AI to follow React best practices
level: intermediate
tags: [react, typescript, frontend]
techStack: [react, next.js]
author: Jane Doe
version: 1.0.0
type: skill
---

You are a senior React architect.`;

    const { metadata, content } = parseContentFile(raw, 'skills/react-architect.md');

    assert.strictEqual(metadata.name, 'React Architect');
    assert.strictEqual(metadata.description, 'Instructs AI to follow React best practices');
    assert.strictEqual(metadata.level, 'intermediate');
    assert.deepStrictEqual(metadata.tags, ['react', 'typescript', 'frontend']);
    assert.deepStrictEqual(metadata.techStack, ['react', 'next.js']);
    assert.strictEqual(metadata.author, 'Jane Doe');
    assert.strictEqual(metadata.version, '1.0.0');
    assert.strictEqual(metadata.type, 'skill');
    assert.strictEqual(content, 'You are a senior React architect.');
  });

  it('should fall back to filename when no front-matter', () => {
    const raw = 'Just plain instructions without any front-matter.';
    const { metadata, content } = parseContentFile(raw, 'rules/cloud-architect.md');

    assert.strictEqual(metadata.name, 'cloud architect');
    assert.strictEqual(metadata.description, '');
    assert.strictEqual(content, 'Just plain instructions without any front-matter.');
  });

  it('should handle partial front-matter', () => {
    const raw = `---
name: Custom Name
---

Some content here.`;

    const { metadata, content } = parseContentFile(raw, 'test.md');

    assert.strictEqual(metadata.name, 'Custom Name');
    assert.strictEqual(metadata.description, '');
    assert.strictEqual(metadata.level, undefined);
    assert.strictEqual(metadata.tags, undefined);
    assert.strictEqual(content, 'Some content here.');
  });

  it('should handle tech_stack alias', () => {
    const raw = `---
tech_stack: [python, django]
---

Content.`;

    const { metadata } = parseContentFile(raw, 'test.md');
    assert.deepStrictEqual(metadata.techStack, ['python', 'django']);
  });

  it('should handle empty file', () => {
    const { metadata, content } = parseContentFile('', 'empty-file.txt');
    assert.strictEqual(metadata.name, 'empty file');
    assert.strictEqual(content, '');
  });

  it('should handle files with only front-matter', () => {
    const raw = `---
name: Metadata Only
description: No body content
---`;

    const { metadata, content } = parseContentFile(raw, 'test.md');
    assert.strictEqual(metadata.name, 'Metadata Only');
    assert.strictEqual(content, '');
  });
});

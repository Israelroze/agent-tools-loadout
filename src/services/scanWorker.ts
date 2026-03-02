import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScanRequest, ScanResult, ContentSummary, GitFileInfo } from '../types';
import { gitLogAllFiles, setGitPath } from '../utils/git';
import { parseContentFile, scoreContent } from './metadataParser';

// Apply git binary path passed from main thread
if (workerData?.gitPath) {
  setGitPath(workerData.gitPath);
}

// Simple logger for worker thread (can't use vscode output channel)
function log(msg: string): void {
  console.log(`[scanWorker] ${msg}`);
}

// File extensions that contain instruction content
const CONTENT_FILE_EXTENSIONS = new Set([
  '.md', '.txt', '.mdx',
  '.cursorrules',
  '.clinerules',
  '.mdc',
  '.yaml', '.yml',
]);

// Exact filenames (lowercased) that are known instruction files
const CONTENT_FILE_NAMES = new Set([
  '.cursorrules',
  '.clinerules',
  'claude.md',
  'copilot-instructions.md',
]);

// Directories whose contents should ALWAYS be scanned (even .md files there are instructions, not boilerplate)
const INSTRUCTION_DIRS = new Set([
  '.github',
  '.claude',
  '.cursor',
  '.vscode',
  'agents',
  'subagents',
  'skills',
  'commands',
  'prompts',
  'personas',
  'instructions',
  'rules',
]);

// Files to always skip — common repo boilerplate, not instruction content
// Only applied outside of INSTRUCTION_DIRS
const SKIP_FILES = new Set([
  'readme.md', 'changelog.md', 'license.md', 'license',
  'code_of_conduct.md', 'contributing.md', 'security.md',
  'package.json', 'package-lock.json', 'tsconfig.json',
]);

parentPort?.on('message', async (msg: ScanRequest) => {
  if (msg.type !== 'scan') return;

  log(`=== SCAN START: ${msg.repos.length} repos, threshold=${msg.threshold} ===`);
  const threshold = msg.threshold ?? 0;
  const repoResults = await Promise.all(
    msg.repos.map((repo) => scanSingleRepo(repo, threshold))
  );

  // Summary
  log(`=== SCAN SUMMARY ===`);
  for (const r of repoResults) {
    log(`  ${r.repoUrl}: ${r.items.length} items${r.error ? ` ERROR: ${r.error}` : ''}`);
  }
  log(`=== SCAN END ===`);

  const result: ScanResult = {
    type: 'result',
    repos: repoResults,
  };

  parentPort?.postMessage(result);
});

async function scanSingleRepo(repo: ScanRequest['repos'][0], threshold: number): Promise<ScanResult['repos'][0]> {
  try {
    const scanRoot = repo.scanPath
      ? path.join(repo.localPath, repo.scanPath)
      : repo.localPath;

    log(`Scanning repo: ${repo.repoUrl}`);
    log(`  localPath: ${repo.localPath}`);
    log(`  scanRoot: ${scanRoot}`);

    // Verify the scan root exists
    try {
      await fs.stat(scanRoot);
    } catch (e) {
      log(`  scanRoot DOES NOT EXIST: ${e}`);
      return { repoUrl: repo.repoUrl, items: [], error: `Scan root does not exist: ${scanRoot}` };
    }

    // List top-level entries, highlighting instruction-relevant dirs
    try {
      const topEntries = await fs.readdir(scanRoot, { withFileTypes: true });
      const dirs = topEntries.filter(e => e.isDirectory()).map(e => e.name);
      const instrDirs = dirs.filter(d => isInstructionDir(d));
      const rootFiles = topEntries.filter(e => e.isFile()).map(e => e.name);
      const instrFiles = rootFiles.filter(f => {
        const lower = f.toLowerCase();
        return CONTENT_FILE_NAMES.has(lower) || lower === 'claude.md' || lower === '.cursorrules' || lower === '.clinerules';
      });
      log(`  Dirs: ${dirs.join(', ') || '(none)'}`);
      if (instrDirs.length > 0) log(`  ** Instruction dirs found: ${instrDirs.join(', ')}`);
      if (instrFiles.length > 0) log(`  ** Instruction files at root: ${instrFiles.join(', ')}`);
    } catch (e) {
      log(`  Failed to list scanRoot: ${e}`);
    }

    // Get git metadata for all files in a single command (optional — scan still works without it)
    let gitInfoMap = new Map<string, GitFileInfo>();
    try {
      gitInfoMap = await gitLogAllFiles(repo.localPath, repo.scanPath);
    } catch {
      // Git metadata unavailable — continue scanning without it
    }

    // Standard repo scan
    const items = await scanDirectory(scanRoot, repo.localPath, repo.repoUrl, gitInfoMap, threshold);
    log(`  Scan result: ${items.length} items found`);
    for (const item of items) {
      log(`    - ${item.filePath} (${item.metadata.contentType})`);
    }
    return { repoUrl: repo.repoUrl, items };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`  Scan error: ${errorMsg}`);
    return { repoUrl: repo.repoUrl, items: [], error: errorMsg };
  }
}

async function scanDirectory(
  dir: string,
  repoRoot: string,
  repoUrl: string,
  gitInfoMap: Map<string, GitFileInfo>,
  threshold: number
): Promise<ContentSummary[]> {
  const items: ContentSummary[] = [];
  await walkDir(dir, repoRoot, repoUrl, gitInfoMap, items, false, threshold);
  return items;
}

/**
 * Check if a directory name is a known instruction directory.
 */
function isInstructionDir(name: string): boolean {
  return INSTRUCTION_DIRS.has(name.toLowerCase());
}

async function walkDir(
  dir: string,
  repoRoot: string,
  repoUrl: string,
  gitInfoMap: Map<string, GitFileInfo>,
  items: ContentSummary[],
  insideInstructionDir: boolean,
  threshold: number
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip .git but allow other dotfolders (.github, .claude, .cursor, etc.)
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const enteringInstructionDir = insideInstructionDir || isInstructionDir(entry.name);
      await walkDir(fullPath, repoRoot, repoUrl, gitInfoMap, items, enteringInstructionDir, threshold);
      continue;
    }

    if (!entry.isFile()) continue;

    const nameLower = entry.name.toLowerCase();
    const ext = path.extname(nameLower);

    // Skip common boilerplate files — but NOT if we're inside a known instruction directory
    if (!insideInstructionDir && SKIP_FILES.has(nameLower)) {
      continue;
    }

    // Include if extension matches OR filename matches (e.g. .cursorrules has no "real" extension)
    const matchesByExt = CONTENT_FILE_EXTENSIONS.has(ext);
    const matchesByName = CONTENT_FILE_NAMES.has(nameLower);
    if (!matchesByExt && !matchesByName) {
      continue;
    }

    const relativePath = path.relative(repoRoot, fullPath);
    log(`    MATCH: ${relativePath}`);

    try {
      const raw = await fs.readFile(fullPath, 'utf-8');

      // Score before parsing to avoid unnecessary work
      const score = scoreContent(raw, relativePath, insideInstructionDir);
      if (score < threshold) {
        log(`    SKIP (score ${score} < threshold ${threshold}): ${relativePath}`);
        continue;
      }

      const { metadata } = parseContentFile(raw, relativePath);
      const gitInfo = gitInfoMap.get(relativePath);

      items.push({
        id: `${repoUrl}:${relativePath}`,
        repoUrl,
        filePath: relativePath,
        metadata,
        gitInfo,
        relevanceScore: score,
      });
    } catch (err) {
      log(`    ERROR reading/parsing ${relativePath}: ${err}`);
    }
  }
}

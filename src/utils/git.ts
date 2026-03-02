import { execFile } from 'child_process';
import type { GitFileInfo } from '../types';

interface ExecResult {
  stdout: string;
  stderr: string;
}

// Resolved path to the git binary. Set via setGitPath() from the main thread
// using VS Code's git extension, or falls back to searching common locations.
let gitBinary = 'git';

/**
 * Set the absolute path to the git binary.
 * Called from the main extension thread after resolving via VS Code's git extension.
 */
export function setGitPath(path: string): void {
  gitBinary = path;
}

// Common paths where git may be installed on macOS/Linux.
// Worker threads in VS Code may not inherit the full shell PATH.
const EXTRA_PATHS = [
  '/usr/local/bin',
  '/opt/homebrew/bin',
  '/usr/bin',
  '/bin',
];

function getEnhancedPath(): string {
  const current = process.env.PATH ?? '';
  const missing = EXTRA_PATHS.filter((p) => !current.split(':').includes(p));
  return missing.length ? `${current}:${missing.join(':')}` : current;
}

const enhancedEnv = { ...process.env, PATH: getEnhancedPath() };

function exec(args: string[], cwd?: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(gitBinary, args, { cwd, maxBuffer: 10 * 1024 * 1024, env: enhancedEnv }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`git ${args[0]} failed: ${stderr || err.message}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Clone a repo. Uses --depth=1 for a shallow clone to minimize download size
 * while ensuring all file contents are available in the working tree.
 *
 * Authentication is handled by the user's existing git configuration
 * (SSH keys, credential helpers, etc.).
 */
export async function gitClone(
  url: string,
  targetDir: string,
  branch?: string
): Promise<void> {
  const args = ['clone', '--depth=1'];
  if (branch) {
    args.push('--branch', branch);
  }
  args.push(url, targetDir);
  await exec(args);
}

/**
 * Pull latest changes. Returns whether HEAD changed.
 * Uses fetch+reset for shallow clones since --ff-only may not work.
 */
export async function gitPull(repoDir: string): Promise<{ changed: boolean }> {
  const headBefore = await gitRevParse(repoDir);
  try {
    try {
      await exec(['pull', '--ff-only'], repoDir);
    } catch {
      // Shallow clone — fetch and reset instead
      await exec(['fetch', '--depth=1'], repoDir);
      await exec(['reset', '--hard', 'FETCH_HEAD'], repoDir);
    }
  } catch {
    // Pull failed — likely auth issue, continue with existing content
  }
  const headAfter = await gitRevParse(repoDir);
  return { changed: headBefore !== headAfter };
}

/**
 * Get the current HEAD commit SHA.
 */
export async function gitRevParse(repoDir: string): Promise<string> {
  const { stdout } = await exec(['rev-parse', 'HEAD'], repoDir);
  return stdout.trim();
}

/**
 * Get last-commit metadata for ALL files in a single git command.
 * Returns a Map from file path to GitFileInfo.
 *
 * Uses `git log` with --name-only to get commit info + affected files.
 * We walk the output and record the first (most recent) entry per file.
 */
export async function gitLogAllFiles(
  repoDir: string,
  subPath?: string
): Promise<Map<string, GitFileInfo>> {
  const args = [
    'log',
    '--format=%H|%an|%aI|%s',
    '--name-only',
    '--diff-filter=AMRC',
  ];
  if (subPath) {
    args.push('--', subPath);
  }
  const { stdout } = await exec(args, repoDir);
  return parseGitLogOutput(stdout);
}

/**
 * Parse the combined output of `git log --format=... --name-only`.
 *
 * Output format:
 *   <sha>|<author>|<date>|<message>
 *   <empty line>
 *   file1.md
 *   file2.md
 *
 *   <sha>|<author>|<date>|<message>
 *   <empty line>
 *   file3.md
 *   ...
 *
 * We record only the first (most recent) entry per file path.
 */
function parseGitLogOutput(output: string): Map<string, GitFileInfo> {
  const result = new Map<string, GitFileInfo>();
  const lines = output.split('\n');

  let currentInfo: GitFileInfo | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Check if this is a commit header line (contains | separators)
    const parts = trimmed.split('|');
    if (parts.length >= 4 && /^[0-9a-f]{40}$/.test(parts[0])) {
      currentInfo = {
        sha: parts[0],
        lastAuthor: parts[1],
        lastDate: parts[2],
        lastMessage: parts.slice(3).join('|'), // message might contain |
      };
    } else if (currentInfo && trimmed.length > 0) {
      // This is a filename line — only record if we haven't seen this file yet
      if (!result.has(trimmed)) {
        result.set(trimmed, currentInfo);
      }
    }
  }

  return result;
}

/**
 * Check if a directory is a git repository.
 */
export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await exec(['rev-parse', '--git-dir'], dir);
    return true;
  } catch {
    return false;
  }
}

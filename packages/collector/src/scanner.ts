import { basename, dirname, resolve } from 'node:path';
import { glob } from 'tinyglobby';
import type { ScannedFile } from '@claude-usage-hub/shared';
import { expandHome } from './config.js';

/**
 * Scan a Claude data directory for JSONL files.
 *
 * Directory structure:
 *   ~/.claude/projects/{project-dir}/{session-uuid}.jsonl
 *   ~/.claude/projects/{project-dir}/{session-uuid}/subagents/agent-{id}.jsonl
 *
 * Returns metadata about each discovered file.
 */
export async function scanForFiles(claudeDataPath: string): Promise<ScannedFile[]> {
  const resolvedPath = resolve(expandHome(claudeDataPath));
  const pattern = '**/*.jsonl';

  const files = await glob([pattern], {
    cwd: resolvedPath,
    absolute: true,
  });

  return files.map((filePath) => classifyFile(filePath, resolvedPath));
}

/**
 * Classify a JSONL file based on its path.
 *
 * Top-level session file:
 *   /path/to/projects/{project-dir}/{session-uuid}.jsonl
 *   → projectDir = {project-dir}, sessionId = {session-uuid}, isSubagent = false
 *
 * Subagent file:
 *   /path/to/projects/{project-dir}/{session-uuid}/subagents/agent-{id}.jsonl
 *   → projectDir = {project-dir}, sessionId = agent-{id}, isSubagent = true, parentSessionId = {session-uuid}
 */
function classifyFile(filePath: string, basePath: string): ScannedFile {
  const relativeParts = filePath.slice(basePath.length + 1).split('/');

  // Check if this is a subagent file: {project}/{session}/subagents/{agent}.jsonl
  if (relativeParts.length >= 4 && relativeParts[relativeParts.length - 2] === 'subagents') {
    const projectDir = relativeParts[0]!;
    const parentSessionId = relativeParts[1]!;
    const agentFile = basename(filePath, '.jsonl');

    return {
      filePath,
      projectDir,
      sessionId: agentFile,
      isSubagent: true,
      parentSessionId,
    };
  }

  // Top-level session file: {project}/{session}.jsonl
  const projectDir = relativeParts[0] || dirname(filePath);
  const sessionId = basename(filePath, '.jsonl');

  return {
    filePath,
    projectDir,
    sessionId,
    isSubagent: false,
    parentSessionId: null,
  };
}

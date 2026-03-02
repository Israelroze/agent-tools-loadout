import type { AgentId } from '../types';
import type { AgentAdapter } from './baseAdapter';
import { CursorAdapter } from './cursorAdapter';
import { CopilotAdapter } from './copilotAdapter';
import { ClaudeAdapter } from './claudeAdapter';

const adapters: Record<AgentId, AgentAdapter> = {
  cursor: new CursorAdapter(),
  copilot: new CopilotAdapter(),
  claude: new ClaudeAdapter(),
};

export function getAdapter(agentId: AgentId): AgentAdapter {
  return adapters[agentId];
}

export function getAllAdapters(): AgentAdapter[] {
  return Object.values(adapters);
}

import type { AgentConfig, AgentId } from '../types';

export const EXTENSION_ID = 'agent-loadout';
export const EXTENSION_NAME = 'Agent Tools Loadout';

export const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  copilot: {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    targetPath: '.github/copilot-instructions.md',
    rulesDir: '.github/instructions',
    ruleFileExt: '.instructions.md',
    supportedContentTypes: ['instructions', 'skill', 'subagent'],
    contentTypeDirs: {
      skill: '.github/prompts',
      subagent: '.github/agents',
    },
    contentTypeExts: {
      skill: '.prompt.md',
      subagent: '.agent.md',
    },
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    targetPath: '.cursorrules',
    rulesDir: '.cursor/rules',
    ruleFileExt: '.mdc',
    supportedContentTypes: ['instructions', 'skill'],
  },
  claude: {
    id: 'claude',
    displayName: 'Claude',
    targetPath: 'CLAUDE.md',
    rulesDir: '.claude/rules',
    ruleFileExt: '.md',
    supportedContentTypes: ['instructions', 'skill', 'subagent'],
    contentTypeDirs: {
      skill: '.claude/commands',
      subagent: '.claude/agents',
    },
  },
};

export const CONFIG_KEYS = {
  SOURCES: 'agentLoadout.sources',
  DEFAULT_AGENT: 'agentLoadout.defaultAgent',
} as const;

export const COMMANDS = {
  REFRESH: 'agentLoadout.refresh',
  EQUIP: 'agentLoadout.equip',
  EQUIP_SELECTED: 'agentLoadout.equipSelected',
  CONVERT: 'agentLoadout.convert',
  PREVIEW: 'agentLoadout.preview',
  ADD_SOURCE: 'agentLoadout.addSource',
  REMOVE_SOURCE: 'agentLoadout.removeSource',
  SEARCH: 'agentLoadout.search',
  CLEAR_SEARCH: 'agentLoadout.clearSearch',
  FILTER_TYPE: 'agentLoadout.filterType',
  CLEAR_TYPE_FILTER: 'agentLoadout.clearTypeFilter',
  UNEQUIP: 'agentLoadout.unequip',
  PURGE_CACHE: 'agentLoadout.purgeCache',
  SET_SENSITIVITY: 'agentLoadout.setSensitivity',
} as const;

export const VIEW_IDS = {
  BROWSER: 'agentLoadoutBrowser',
} as const;

import type { AgentId, NormalizedContent } from '../types';

/**
 * Interface for agent-specific format adapters.
 * Each adapter knows how to read/write its agent's native instruction file format.
 */
export interface AgentAdapter {
  readonly agentId: AgentId;
  readonly targetPath: string;

  /**
   * Parse raw content into a normalized intermediate format.
   * Used as the source side of a conversion.
   */
  normalize(content: string): NormalizedContent;

  /**
   * Convert normalized content into this agent's native format.
   * Used as the target side of a conversion.
   */
  format(normalized: NormalizedContent): string;
}

import { TOOL_NAME_MAP, type ToolCallInfo } from '@iblai/iblai-js/web-utils';

export function getFriendlyToolName(toolName: string): string {
  if (TOOL_NAME_MAP?.[toolName]) return TOOL_NAME_MAP[toolName];
  const words = toolName.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Extract a short human-readable query from tool input or log
export function getQueryLabel(toolCall: ToolCallInfo): string | null {
  // Prefer structured input
  if (toolCall.input && typeof toolCall.input === 'object') {
    const val =
      toolCall.input.query ??
      toolCall.input.q ??
      toolCall.input.input ??
      toolCall.input.text;
    if (val && typeof val === 'string') return val;
    // Fallback: first string value in input
    const firstStr = Object.values(toolCall.input).find(
      (v) => typeof v === 'string',
    );
    if (firstStr) return firstStr as string;
  }
  // Fallback: parse log string
  if (toolCall.log) {
    const match = toolCall.log.match(/with\s+`({[\s\S]*?})`/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].replace(/'/g, '"'));
        const val = parsed.query ?? parsed.q ?? parsed.input;
        if (val) return val;
      } catch (e) {
        console.error('[ToolCallIndicator] Failed to parse log string:', e);
      }
    }
  }
  return null;
}

export function formatResult(result: string): string {
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

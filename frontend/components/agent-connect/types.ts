export const SUPPORTED_AGENTS = [
  "claude-code",
  "antigravity",
  "gemini-cli",
  "codex",
  "other",
] as const;

export type SupportedAgent = (typeof SUPPORTED_AGENTS)[number];

export const SUPPORTED_AGENTS = [
  "claude-code",
  "antigravity",
  "gemini-cli",
  "codex",
  "other",
] as const;

export type SupportedAgent = (typeof SUPPORTED_AGENTS)[number];

export interface AgentConfigTemplate {
  id: SupportedAgent;
  name: string;
  badgeKey: string;
  format: "bash" | "json" | "toml" | "text";
  getCommand: (host: string, token: string) => string;
}

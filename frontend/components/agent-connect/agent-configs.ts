import type { SupportedAgent } from "./types";

export interface AgentDetails {
  id: SupportedAgent;
  name: string;
  format: "bash" | "json" | "toml" | "text";
  getSnippet: (host: string, token: string) => string;
}

export const AGENT_CONFIGS: Record<SupportedAgent, AgentDetails> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    format: "bash",
    getSnippet: (host, token) =>
      `claude mcp add --scope user --transport http ariadne ${host}/mcp --header "Authorization: Bearer ${token}"`,
  },
  antigravity: {
    id: "antigravity",
    name: "Antigravity",
    format: "json",
    getSnippet: (host, token) =>
      `"ariadne": {\n  "serverUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}`,
  },
  "gemini-cli": {
    id: "gemini-cli",
    name: "Gemini CLI",
    format: "json",
    getSnippet: (host, token) =>
      `"ariadne": {\n  "httpUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}`,
  },
  codex: {
    id: "codex",
    name: "Codex",
    format: "bash",
    getSnippet: (host, token) =>
      `codex mcp add ariadne --url ${host}/mcp --header "Authorization: Bearer ${token}"`,
  },
  other: {
    id: "other",
    name: "Inny agent (MCP)",
    format: "text",
    getSnippet: (host, token) =>
      `URL: ${host}/mcp\nHeader: Authorization: Bearer ${token}\nTransport: HTTP / Streamable HTTP`,
  },
};

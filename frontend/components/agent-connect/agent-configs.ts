import type { SupportedAgent } from "./types";

export interface AgentDetails {
  id: SupportedAgent;
  name: string;
  format: "bash" | "json" | "toml" | "text";
  getSnippet: (host: string, token: string) => string;
  getPrompt: (host: string, token: string, locale?: string) => string;
}

export const AGENT_CONFIGS: Record<SupportedAgent, AgentDetails> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    format: "bash",
    getSnippet: (host, token) =>
      `claude mcp add --scope user --transport http ariadne ${host}/mcp --header "Authorization: Bearer ${token}"`,
    getPrompt: (host, token, locale = "pl") =>
      locale === "en"
        ? `Your task is to configure the Ariadne MCP server in Claude Code. Run the following command in the terminal:\n\nclaude mcp add --scope user --transport http ariadne ${host}/mcp --header "Authorization: Bearer ${token}"\n\nAfter running it, verify the connection with "claude mcp list" and confirm that Ariadne is connected.`
        : `Twoim zadaniem jest skonfigurowanie serwera Ariadne MCP w Claude Code. Uruchom w terminalu następujące polecenie:\n\nclaude mcp add --scope user --transport http ariadne ${host}/mcp --header "Authorization: Bearer ${token}"\n\nPo wykonaniu polecenia sprawdź status za pomocą "claude mcp list" i potwierdź, że serwer ariadne ma status Connected.`,
  },
  antigravity: {
    id: "antigravity",
    name: "Antigravity",
    format: "json",
    getSnippet: (host, token) =>
      `"ariadne": {\n  "serverUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}`,
    getPrompt: (host, token, locale = "pl") =>
      locale === "en"
        ? `Your task is to configure the Ariadne MCP server in Google Antigravity. Open your MCP configuration file (~/.gemini/antigravity/mcp/ or MCP server settings) and add the following entry to "mcpServers":\n\n"ariadne": {\n  "serverUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}\n\nSave the file and verify that Ariadne memory tools are available in the session.`
        : `Twoim zadaniem jest skonfigurowanie serwera Ariadne MCP w Google Antigravity. Otwórz swój plik konfiguracyjny MCP dla Antigravity (np. ~/.gemini/antigravity/mcp/ lub konfigurację serwerów MCP) i wklej do sekcji "mcpServers" poniższy blok:\n\n"ariadne": {\n  "serverUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}\n\nZapisz plik konfiguracyjny i potwierdź, że narzędzia pamięci Ariadne są widoczne w sesji.`,
  },
  "gemini-cli": {
    id: "gemini-cli",
    name: "Gemini CLI",
    format: "json",
    getSnippet: (host, token) =>
      `"ariadne": {\n  "httpUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}`,
    getPrompt: (host, token, locale = "pl") =>
      locale === "en"
        ? `Your task is to configure the Ariadne MCP server in Gemini CLI. Open the configuration file ~/.gemini/settings.json in a text editor and add the following block to "mcpServers":\n\n"ariadne": {\n  "httpUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}\n\nSave ~/.gemini/settings.json and confirm that the Ariadne MCP server is active (/mcp).`
        : `Twoim zadaniem jest skonfigurowanie serwera Ariadne MCP w Gemini CLI. Otwórz plik konfiguracyjny ~/.gemini/settings.json w edytorze tekstowym i wklej do sekcji "mcpServers" poniższy blok:\n\n"ariadne": {\n  "httpUrl": "${host}/mcp",\n  "headers": {\n    "Authorization": "Bearer ${token}"\n  }\n}\n\nZapisz plik ~/.gemini/settings.json i upewnij się, że serwer Ariadne MCP jest poprawnie skonfigurowany.`,
  },
  codex: {
    id: "codex",
    name: "Codex",
    format: "bash",
    getSnippet: (host, token) =>
      `codex mcp add ariadne --url ${host}/mcp --header "Authorization: Bearer ${token}"`,
    getPrompt: (host, token, locale = "pl") =>
      locale === "en"
        ? `Your task is to configure the Ariadne MCP server in OpenAI Codex CLI. Run the following command in your terminal:\n\ncodex mcp add ariadne --url ${host}/mcp --header "Authorization: Bearer ${token}"\n\nAlternatively, add to ~/.codex/config.toml under [mcp_servers.ariadne]:\nurl = "${host}/mcp"\nheaders = { Authorization = "Bearer ${token}" }\n\nThen verify with "codex mcp list".`
        : `Twoim zadaniem jest skonfigurowanie serwera Ariadne MCP w OpenAI Codex CLI. Uruchom w terminalu polecenie:\n\ncodex mcp add ariadne --url ${host}/mcp --header "Authorization: Bearer ${token}"\n\nAlternatywnie dodaj do pliku ~/.codex/config.toml w sekcji [mcp_servers.ariadne]:\nurl = "${host}/mcp"\nheaders = { Authorization = "Bearer ${token}" }\n\nNastępnie zweryfikuj połączenie poleceniem "codex mcp list".`,
  },
  other: {
    id: "other",
    name: "Inny agent (MCP)",
    format: "text",
    getSnippet: (host, token) =>
      `URL: ${host}/mcp\nHeader: Authorization: Bearer ${token}\nTransport: HTTP / Streamable HTTP`,
    getPrompt: (host, token, locale = "pl") =>
      locale === "en"
        ? `Your task is to configure the Ariadne MCP server in your MCP client. Add a server named "ariadne" with the following settings:\n\n- Server URL: ${host}/mcp\n- Transport: HTTP / Streamable HTTP\n- Header: Authorization: Bearer ${token}\n\nConfirm that Ariadne memory tools are connected and accessible.`
        : `Twoim zadaniem jest skonfigurowanie serwera Ariadne MCP w swoim agencie MCP. Dodaj serwer o nazwie "ariadne" z następującymi parametrami:\n\n- Adres (URL): ${host}/mcp\n- Protokół (Transport): HTTP / Streamable HTTP\n- Nagłówek (Header): Authorization: Bearer ${token}\n\nPotwierdź, że narzędzia pamięci Ariadne są połączone i gotowe do użycia.`,
  },
};

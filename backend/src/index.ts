import { createServer, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.js";
import { resolveUserByToken } from "./service.js";

// MCP over streamable HTTP, one endpoint (plan section 9). Run with the env
// file loaded: npm run dev.

const PORT = Number(process.env.PORT ?? 3000);

function sendError(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

const httpServer = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path !== "/mcp") return sendError(res, 404, "Not found. The MCP endpoint is POST /mcp.");
  // Stateless mode has no server-initiated streams, so GET and DELETE have no job here.
  if (req.method !== "POST") return sendError(res, 405, "Method not allowed. Use POST.");

  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    res.setHeader("WWW-Authenticate", "Bearer");
    return sendError(res, 401, "Missing header: Authorization: Bearer <token>");
  }

  let userId: string;
  try {
    userId = await resolveUserByToken(token);
  } catch {
    res.setHeader("WWW-Authenticate", "Bearer");
    return sendError(res, 401, "Invalid token. Generate a new one in the Ariadne app.");
  }

  // Stateless: a fresh server per request, its tools bound to this token's
  // user. Scoping cannot leak between users because nothing is shared.
  const server = createMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("[mcp] request failed:", error);
    if (!res.headersSent) sendError(res, 500, "Internal server error");
  }
});

httpServer.listen(PORT, () => {
  console.log(`Ariadne MCP listening on http://localhost:${PORT}/mcp`);
});

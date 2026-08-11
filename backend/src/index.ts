import { serve } from "@hono/node-server";
import type { HttpBindings } from "@hono/node-server";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { asUser } from "./db/client.js";
import { createMcpServer } from "./mcp.js";
import { createRestApp } from "./rest.js";
import { type Actor, resolveActorByToken } from "./service.js";

// One process, one port: the REST API of plan section 10 plus the MCP endpoint
// of section 9. Run with the env file loaded: npm run dev.

const PORT = Number(process.env.PORT ?? 3000);

const app = createRestApp();

// A JSON-RPC error envelope, not the REST error shape: what reads this is an MCP
// client, and it parses the response rather than showing it to anyone.
function rpcError(status: number, message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
    { status, headers: { "WWW-Authenticate": "Bearer" } },
  );
}

app.all("/mcp", async (c) => {
  // Stateless mode has no server-initiated streams, so GET and DELETE have no job here.
  if (c.req.method !== "POST") return rpcError(405, "Method not allowed. Use POST.");

  // The auth scheme is case-insensitive per RFC 7235, so match it that way.
  const token = /^Bearer +(.+)$/i.exec(c.req.header("authorization") ?? "")?.[1].trim() ?? "";
  if (!token) return rpcError(401, "Missing header: Authorization: Bearer <token>");

  let actor: Actor;
  try {
    actor = await resolveActorByToken(token);
  } catch {
    // Prefix only, never the whole token: enough to tell a wrong token from an
    // unexpanded "${ARIADNE_TOKEN}" placeholder in a client config.
    console.warn(`[auth] rejected token: ${token.length} chars, starts "${token.slice(0, 6)}"`);
    return rpcError(401, "Invalid token. Generate a new one in the Ariadne app.");
  }

  // Stateless: a fresh server per request, its tools bound to this token's
  // workspace. Scoping cannot leak between archives because nothing is shared.
  const server = createMcpServer(actor);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  // The SDK transport writes to the raw Node response, which Hono exposes as
  // c.env.outgoing. RESPONSE_ALREADY_SENT then tells the adapter to keep off it.
  const { incoming, outgoing } = c.env as HttpBindings;
  outgoing.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    // Same wrapper the REST routes get: one transaction per call, carrying the
    // identity the policies of migration 0008 read. The token was resolved above
    // it, against a table those policies deliberately leave alone.
    await asUser(actor.userId, async () => {
      await server.connect(transport);
      await transport.handleRequest(incoming, outgoing);
    });
  } catch (error) {
    console.error("[mcp] request failed:", error);
    if (!outgoing.headersSent) return rpcError(500, "Internal server error");
  }
  return RESPONSE_ALREADY_SENT;
});

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`Ariadne listening on http://localhost:${port}`);
  console.log("  REST: /auth/login, /me, /tokens, /projects, /pending");
  console.log("  MCP:  POST /mcp");
});

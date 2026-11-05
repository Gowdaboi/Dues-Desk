import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveWorkspace } from "@/lib/mcp/resolve-workspace";
import { createServiceClient } from "@/lib/supabase-server";
import { createDuesDeskMcp } from "@/lib/mcp/server";

// Stateless MCP: each request gets its own transport + server.
// This keeps the Vercel serverless model simple — no session state.
async function handleMcp(
  req: Request,
  token: string
): Promise<Response> {
  const workspace = await resolveWorkspace(token);
  if (!workspace) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = createServiceClient();
  const mcpServer = createDuesDeskMcp(db, workspace.id);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await mcpServer.connect(transport);

  return transport.handleRequest(req);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return handleMcp(req, token);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return handleMcp(req, token);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return handleMcp(req, token);
}

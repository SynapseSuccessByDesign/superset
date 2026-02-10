const MCP_BASE =
  (window as any).__MCP_BASE__ ||
  "http://127.0.0.1:8000";

async function handle(res: Response) {
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function queryMcp(
  token: string,
  question: string,
  conversationId: string,
  dashboardContext?: any,
  sourceHint?: string  // ✅ ADD THIS
) {
  const res = await fetch(`${MCP_BASE}/mcp/query-natural`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      question,
      conversation_id: conversationId,
      dashboard_context: dashboardContext,
      source_hint: sourceHint,  // ✅ ADD THIS
    }),
  });

  return handle(res);
}

export async function submitFeedback(token: string, payload: any) {
  const res = await fetch(`${MCP_BASE}/feedback/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function requestExpert(token: string, payload: any) {
  const res = await fetch(`${MCP_BASE}/feedback/expert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function shareConversation(token: string, payload: any) {
  const res = await fetch(`${MCP_BASE}/feedback/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}
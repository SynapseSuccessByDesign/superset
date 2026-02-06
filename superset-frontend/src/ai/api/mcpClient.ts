const API_BASE = "http://localhost:8000";

export async function queryMcp(
  token: string,
  question: string,
  conversationId: string
) {
  const res = await fetch(`${API_BASE}/mcp/query-natural`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      question,
      conversation_id: conversationId,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Query failed");
  }

  return res.json();
}

import useSupersetAuth from "../auth/useSupersetAuth";
import { queryMcp } from "../api/mcpClient";
import { MCPResponse } from "../types";
import "./ChatPage.css";
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";


const API_BASE_URL = "http://127.0.0.1:8000";

// ============================================================================
// MODIFIED getDashboardContext() - Now accepts supersetToken
// ============================================================================

async function getDashboardContext(mcpToken: string, supersetToken: string | null) {
  try {
    console.log("🔍 Extracting dashboard metadata (NO data fetch)...");

    const dashId =
      (window as any)?.dashboardInfo?.id ||
      window.location.pathname.match(/dashboard\/([^\/\?]+)/)?.[1];

    if (!dashId) {
      console.log("❌ No dashboard ID found");
      return null;
    }

    console.log("✅ Dashboard ID:", dashId);

    // Build headers - use Superset token if available
    const headers: any = {};
    if (supersetToken) {
      headers.Authorization = `Bearer ${supersetToken}`;
      console.log("🔑 Using Superset access token");
    } else {
      console.log("🍪 Using cookie authentication (fallback)");
    }

    // 1. Fetch dashboard metadata
    const dashRes = await fetch(`/api/v1/dashboard/${dashId}`, { headers });

    if (!dashRes.ok) return null;

    const dashJson = await dashRes.json();
    const dashboard = dashJson?.result;

    // Extract chart IDs from position_json
    const positionData =
      typeof dashboard.position_json === "string"
        ? JSON.parse(dashboard.position_json)
        : dashboard.position_json;

    const chartIds = Object.values(positionData || {})
      .filter((item: any) => item.type === "CHART")
      .map((c: any) => c.meta?.chartId)
      .filter(Boolean);

    console.log(`📊 Found ${chartIds.length} charts - fetching metadata only`);

    // 2. Fetch chart metadata for ALL charts
    const chartMetadata = await Promise.all(
      chartIds.map(async (chartId: number) => {
        try {
          const chartRes = await fetch(`/api/v1/chart/${chartId}`, { headers });

          if (!chartRes.ok) return null;

          const chartJson = await chartRes.json();
          const chart = chartJson.result;

          let params = {};
          try {
            params = JSON.parse(chart.params || "{}");
          } catch (e) {
            console.warn(`Failed to parse params for chart ${chartId}`);
          }

          return {
            id: chartId,
            name: chart.slice_name,
            type: chart.viz_type,
            datasource_id: chart.datasource_id,
            datasource_type: chart.datasource_type,
            params: params,
          };
        } catch (err) {
          console.warn(`Chart ${chartId} metadata fetch failed`);
          return null;
        }
      })
    );

    const validCharts = chartMetadata.filter(Boolean);

    const context = {
      source: "superset_dashboard",
      dashboard_id: dashId.toString(),
      dashboard_title: dashboard.dashboard_title,
      chart_count: validCharts.length,
      charts: validCharts,
      filters: dashboard.metadata?.native_filter_configuration || {},
      extracted_at: new Date().toISOString(),
    };

    console.log("✅ Dashboard metadata extracted (no data fetch)");
    console.log(`   Total charts: ${validCharts.length}`);
    console.log(`   Metadata-only payload - backend will fetch data on-demand`);

    return context;
  } catch (e) {
    console.error("❌ Dashboard extraction failed:", e);
    return null;
  }
}

// Add after imports
const FeedbackModal = ({ 
  type, 
  message, 
  onClose 
}: { 
  type: 'success' | 'error'; 
  message: string; 
  onClose: () => void 
}) => (
  <>
    <div className="feedback-modal-overlay" onClick={onClose} />
    <div className={`feedback-modal ${type}`}>
      <div className="feedback-modal-content">
        <div className="feedback-modal-icon">
          {type === 'success' ? '✅' : '❌'}
        </div>
        <div className="feedback-modal-text">
          <div className="feedback-modal-title">
            {type === 'success' ? 'Success' : 'Error'}
          </div>
          <div className="feedback-modal-message" style={{ whiteSpace: 'pre-line' }}>
  {message}
</div>

        </div>
      </div>
      <button className="feedback-modal-close" onClick={onClose}>
        OK
      </button>
    </div>
  </>
);

/* =========================
   Message Model
========================= */
type ChatMessage =
  | { role: "user"; content: string }
  | ({ role: "assistant" } & MCPResponse);

/* =========================
   Helpers
========================= */
function inferSource(sql?: string) {
  if (!sql) return null;
  const s = sql.toLowerCase();
  if (s.includes("dbo.")) {
    return {
      label: "Contracts (Microsoft SQL Server)",
      className: "sqlserver",
    };
  }
  if (s.includes("clickhouse")) {
    return { label: "ClickHouse", className: "clickhouse" };
  }
  if (s.includes("delta") || s.includes("databricks")) {
    return { label: "Azure Databricks", className: "databricks" };
  }
  return null;
}

function normalizeHeader(col: string) {
  return col
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTableFromAnswer(answer: string) {
  const lines = answer.split("\n").map((l) => l.trim());
  const rows = lines.filter(
    (l) => l.startsWith("|") && l.endsWith("|")
  );
  if (rows.length < 3) return null;

  const columns = rows[0]
    .split("|")
    .slice(1, -1)
    .map((c) => normalizeHeader(c.trim()));

  const data = rows.slice(2).map((r) =>
    r.split("|").slice(1, -1).map((c: string) => c.trim())
  );

  return { columns, rows: data };
}

function stripMarkdownTable(answer: string) {
  const lines = answer.split("\n");
  const cleaned: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      inTable = true;
      continue;
    }
    if (inTable && line.trim() === "") {
      inTable = false;
      continue;
    }
    if (!inTable) cleaned.push(line);
  }
  return cleaned.join("\n").trim();
}

function stripNoise(answer: string) {
  return answer
    .replace(/\*\*Confidence score:\*\*.*$/i, "")
    .replace(/Confidence score:.*$/i, "")
    .trim();
}

/* =========================
   Conversation Model
========================= */
type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

/* =========================
   Component
========================= */
export default function ChatPage() {
  const { token, supersetToken, loading: authLoading } = useSupersetAuth();

  // Add these state variables
  const [modalState, setModalState] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const [expertModal, setExpertModal] = useState<{
  show: boolean;
  messageIndex: number | null;
  expertEmail: string;
  context: string;
  submitting: boolean;
}>({
  show: false,
  messageIndex: null,
  expertEmail: "",
  context: "",
  submitting: false
});

const [shareModal, setShareModal] = useState<{
  show: boolean;
  messageIndex: number | null;
  recipients: string;
  submitting: boolean;
}>({
  show: false,
  messageIndex: null,
  recipients: "",
  submitting: false
});


  const [conversations, setConversations] = useState<Conversation[]>([
    { id: "conv-1", title: "New conversation", messages: [] },
  ]);
  const [activeConvId, setActiveConvId] = useState("conv-1");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastDashboardSent, setLastDashboardSent] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation =
  conversations.find((c) => c.id === activeConvId) ??
  conversations[0];


  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
  messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
}

  }, [activeConversation.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  if (authLoading) {
  return (
    <div style={{ padding: 20 }}>
      Connecting AI assistant...
    </div>
  );
}

// ============================================================================
// MODIFIED send() function - Pass supersetToken to getDashboardContext
// ============================================================================

const send = async () => {
  if (!token || !input.trim() || loading) return;

  const userText = input;
  setLoading(true);

  let dashboardContext = null;

  // ✅ FIXED: Always send dashboard context when on dashboard page
  if (window.location.pathname.includes("/superset/dashboard/")) {
    const currentDashboardUrl = window.location.pathname;
    
    // Only FETCH context if dashboard changed or first time
    if (currentDashboardUrl !== lastDashboardSent) {
      console.log("🆕 New dashboard detected - fetching context");
      dashboardContext = await getDashboardContext(token, supersetToken);
      
      if (dashboardContext) {
        // Save the context for reuse in subsequent queries
        localStorage.setItem('currentDashboardContext', JSON.stringify(dashboardContext));
        setLastDashboardSent(currentDashboardUrl);
        console.log("💾 Dashboard context fetched and cached");
      }
    } else {
      // ✅ Reuse the stored context instead of sending null
      const stored = localStorage.getItem('currentDashboardContext');
      if (stored) {
        try {
          dashboardContext = JSON.parse(stored);
          console.log("♻️ Reusing cached dashboard context from localStorage");
        } catch (e) {
          console.error("Failed to parse cached dashboard context:", e);
          // If parse fails, fetch fresh
          dashboardContext = await getDashboardContext(token, supersetToken);
          if (dashboardContext) {
            localStorage.setItem('currentDashboardContext', JSON.stringify(dashboardContext));
          }
        }
      } else {
        // Cache missing - fetch fresh
        console.log("⚠️ Cache missing - fetching fresh context");
        dashboardContext = await getDashboardContext(token, supersetToken);
        if (dashboardContext) {
          localStorage.setItem('currentDashboardContext', JSON.stringify(dashboardContext));
          setLastDashboardSent(currentDashboardUrl);
        }
      }
    }
  } else {
    // Not on dashboard - clear cached context
    localStorage.removeItem('currentDashboardContext');
    setLastDashboardSent(null);
    console.log("ℹ️ Not on dashboard - context cleared");
  }

  // Determine source hint based on whether we have dashboard context
  const sourceHint = dashboardContext ? "superset" : "auto";

  if (dashboardContext) {
    console.log("📦 Sending dashboard context to backend:", {
      dashboard_id: dashboardContext.dashboard_id,
      chart_count: dashboardContext.chart_count
    });
  }

  // Add user message to conversation
  setConversations((prev) =>
    prev.map((c) =>
      c.id === activeConvId
        ? {
            ...c,
            title: c.messages.length === 0 ? userText.slice(0, 40) : c.title,
            messages: [...c.messages, { role: "user", content: userText }],
          }
        : c
    )
  );

  setInput("");
  setError(null);

  try {
    const res = await queryMcp(
      token,
      userText,
      activeConvId,
      dashboardContext, // ✅ Always send context when on dashboard (either fresh or cached)
      sourceHint
    );

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              messages: [...c.messages, { ...res, role: "assistant" }],
            }
          : c
      )
    );
  } catch (e: any) {
    setError(e.message || "Query failed");
  } finally {
    setLoading(false);
  }
};

  // Handle Enter key to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === "Enter" && !e.shiftKey && !loading) {
    e.preventDefault();
    send();
  }
};


  /* =========================
     Feedback Handlers
  ========================= */
  const handleFeedback = async (
    message: any, 
    feedback: 'thumbs_up' | 'thumbs_down',
    messageIndex: number
  ) => {
    if (!token) return;

    // Get the user's question from the previous message
    const userMessage = activeConversation.messages?.[messageIndex - 1];
    const userQuestion =
    userMessage && userMessage.role === "user"
    ? userMessage.content
    : "";

    try {
      const res = await fetch('http://localhost:8000/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: activeConvId,
          request_id: `${activeConvId}-${messageIndex}`,
          question: userQuestion,
          sql_generated: message.SQL || '',
          confidence: message.confidence || 0,
          user_feedback: feedback
        })
      });

      if (res.ok) {
        setModalState({
  show: true,
  type: 'success',
  message: 'Thank you for your feedback!'
});

      } else {
        const errorData = await res.json();
        console.error('Feedback error:', errorData);
        setModalState({
  show: true,
  type: 'error',
  message: errorData.detail || 'Failed to submit feedback'
});

      }
    } catch (e) {
      console.error('Feedback error:', e);
      setModalState({
      show: true,
      type: 'error',
      message: 'Failed to submit feedback'
    });
    }
  };

  // 2. Ask expert for analysis
const handleExpert = (message: any, messageIndex: number) => {
  setExpertModal({
    show: true,
    messageIndex,
    expertEmail: "",
    context: "",
    submitting: false
  });
};

// 3. Share conversation
const handleShare = (messageIndex: number) => {
  setShareModal({
    show: true,
    messageIndex,
    recipients: "",
    submitting: false
  });
};

  
  /* =========================
     Render
  ========================= */
  return (
    <div className="ai-assistant-root chat-layout">
      {/* SIDEBAR */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <button
            className="new-chat-btn"
            onClick={() => {
              const id = `conv-${Date.now()}`;
              setConversations([
                { id, title: "New conversation", messages: [] },
                ...conversations,
              ]);
              setActiveConvId(id);
            }}
          >
            + New chat
          </button>
        </div>

        <div className="conversation-list">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`conversation-item ${
                c.id === activeConvId ? "active" : ""
              }`}
              onClick={() => setActiveConvId(c.id)}
            >
              {c.title}
            </div>
          ))}
        </div>

      </aside>

      {/* MAIN */}
      <main className="chat-main">
        <div className="chat-header center">
        <div className="header-brand">
          <div className="header-text">
            <h2 style = {{color: '#A9A9A9'}}>AI Assistant</h2>

            <p className="welcome-line">
              Welcome! This AI assistant lets you explore SLAPI system data using simple natural language, turning your questions into insights, trends, and visualizations across multiple data sources.
            </p>

            <p className="welcome-sub">
              Ask anything about failures, traffic, comparisons, or performance, and get clear answers with charts and confidence scores.
            </p>
          </div>
        </div>
      </div>

        {error && (
          <div className="access-denied-container">
            <div className="access-denied-card">
              <div className="access-denied-icon">✖</div>
              <div className="access-denied-title">Access denied</div>
              <div className="access-denied-message">
                {error}
              </div>
            </div>
          </div>
        )}

        <div className="chat-messages">
          {activeConversation.messages.map((m, i) => {
            /* USER */
            if (m.role === "user") {
              return (
                <div key={i} className="user-bubble-wrapper">
                  <div className="user-bubble">
                    <div className="message-role">You</div>
                    {m.content}
                  </div>
                </div>
              );
            }

            /* ASSISTANT */
            const table =
              m.data?.columns.length
                ? {
                    columns: m.data.columns.map(normalizeHeader),
                    rows: m.data.rows,
                  }
                : extractTableFromAnswer(m.answer);

            const narrative = stripNoise(
              table
                ? stripMarkdownTable(m.answer)
                : m.answer
            );

            const source = inferSource(m.SQL);

            return (
              <div key={i} className="assistant-bubble-wrapper">
                <div className="assistant-bubble">
                  <div className="message-role">Assistant</div>
                  <ReactMarkdown>{narrative}</ReactMarkdown>
                </div>

                {m.chart?.image_url && (
                  <div className="chart-container">
                    <img
                      src={`${API_BASE_URL}${m.chart.image_url}`}
                      alt={m.chart.spec?.title || "Chart"}
                      className="chart-image"
                    />
                    {/* ADD THIS SECTION */}
    <div className="chart-actions">
  <button 
    className="chart-export-btn"
    onClick={() => {
      const chartId = m.chart?.image_url?.split('/').pop()?.replace('.png', '');
      if (chartId) {
        window.open(`${API_BASE_URL}/charts/download/${chartId}?format=png`, '_blank');
      }
    }}
  >
    📥 Download PNG
  </button>
  <button 
    className="chart-export-btn"
    onClick={() => {
      const chartId = m.chart?.image_url?.split('/').pop()?.replace('.png', '');
      if (chartId) {
        window.open(`${API_BASE_URL}/charts/download/${chartId}?format=pdf`, '_blank');
      }
    }}
  >
    📄 Download PDF
  </button>
</div>
                  </div>
                )}

                {source && (
                  <div className="source-badge">
                    <span className={`source-dot ${source.className}`} />
                    {source.label}
                  </div>
                )}

                {table && (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          {table.columns.map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((r, ri) => (
                          <tr key={ri}>
                            {r.map((v, ci) => (
                              <td key={ci}>{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {m.SQL && (
                  <div className="sql-block">
                    <div className="sql-header">
                      Generated SQL
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(m.SQL!)
                        }
                      >
                        Copy
                      </button>
                    </div>
                    <pre>{m.SQL}</pre>
                  </div>
                )}

                {/* Feedback Section - Always show */}
              <div className="feedback-section">
                <div className="feedback-header">
                  Was this answer helpful?
                </div>
                
                <div className="feedback-buttons">
                  <button 
                    className="feedback-btn thumbs-up"
                    onClick={() => handleFeedback(m, 'thumbs_up', i)}
                  >
                    👍 
                  </button>
                  <button 
                    className="feedback-btn thumbs-down"
                    onClick={() => handleFeedback(m, 'thumbs_down', i)}
                  >
                    👎 
                  </button>
                   <button 
                    className="feedback-btn expert"
                    onClick={() => handleExpert(m, i)}
                  >
                    👨‍💼 Ask an expert
                  </button>
                  <button 
              className="feedback-btn share"
              onClick={() => handleShare(i)}
            >
              🔗 Share
            </button>
                </div>
              </div>

                {m.confidence_reasons?.length > 0 && (
                  <div className="confidence-reasons">
                    {m.confidence_reasons.map((r, idx) => (
                      <div key={idx}>• {r}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
          </div>
        )}

        <div className="chat-input">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
          />
          <button onClick={send} disabled={loading || !input.trim()}>
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </main>
      {modalState.show && (
  <FeedbackModal
    type={modalState.type}
    message={modalState.message}
    onClose={() =>
      setModalState({ ...modalState, show: false })
    }
  />
)}
{expertModal.show && (
  <>
    <div
      className="feedback-modal-overlay"
      onClick={() =>
        setExpertModal((p) => ({ ...p, show: false }))
      }
    />

    <div className="feedback-modal">
      <div className="feedback-modal-content">
        <div className="feedback-modal-icon">👨‍💼</div>

        <div className="feedback-modal-text">
          <div className="feedback-modal-title">
            Request expert analysis
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              Expert email
            </div>

            <input
              value={expertModal.expertEmail}
              onChange={(e) =>
                setExpertModal((p) => ({
                  ...p,
                  expertEmail: e.target.value,
                }))
              }
              placeholder="likitha@aaatechgroup.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              Comment
            </div>

            <textarea
              value={expertModal.context}
              onChange={(e) =>
                setExpertModal((p) => ({
                  ...p,
                  context: e.target.value,
                }))
              }
              placeholder='Add your comment (example: "Can you validate this trend?")'
              style={{
                width: "100%",
                minHeight: 90,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </div>

      <button
  className="feedback-modal-close"
  disabled={
    expertModal.submitting || !expertModal.expertEmail.trim()
  }
  onClick={async () => {
    if (!token) return;
    if (expertModal.messageIndex == null) return;
    if (!activeConversation.messages?.length) return;


    const idx = expertModal.messageIndex;

    const userMsg = activeConversation.messages[idx - 1];
    const userQuestion =
      userMsg && userMsg.role === "user" ? userMsg.content : "";

    setExpertModal((p) => ({ ...p, submitting: true }));

    try {
      const res = await fetch(
        "http://localhost:8000/feedback/expert",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversation_id: activeConvId,
            request_id: `${activeConvId}-${idx}`,
            expert_email: expertModal.expertEmail,
            question: userQuestion,
            answer:
              (activeConversation.messages[idx] as any).answer || "",
            context: expertModal.context,
          }),
        }
      );

      if (res.ok) {
        setExpertModal({
          show: false,
          messageIndex: null,
          expertEmail: "",
          context: "",
          submitting: false,
        });

        setModalState({
          show: true,
          type: "success",
          message: `Expert analysis requested from ${expertModal.expertEmail}`,
        });
      } else {
        const err = await res.json();
        setModalState({
          show: true,
          type: "error",
          message: err.detail || "Failed to request expert",
        });
        setExpertModal((p) => ({ ...p, submitting: false }));
      }
    } catch {
      setModalState({
        show: true,
        type: "error",
        message: "Failed to request expert",
      });
      setExpertModal((p) => ({ ...p, submitting: false }));
    }
  }}
>
  {expertModal.submitting ? "Sending..." : "Send"}
</button>
    </div>
  </>
)}
{shareModal.show && (
  <>
    <div
      className="feedback-modal-overlay"
      onClick={() =>
        setShareModal((p) => ({ ...p, show: false }))
      }
    />

    <div className="feedback-modal">
      <div className="feedback-modal-content">
        <div className="feedback-modal-icon">🔗</div>

        <div className="feedback-modal-text">
          <div className="feedback-modal-title">
            Share conversation
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              Recipient emails (comma separated)
            </div>

            <textarea
              value={shareModal.recipients}
              onChange={(e) =>
                setShareModal((p) => ({
                  ...p,
                  recipients: e.target.value,
                }))
              }
              placeholder="likitha@aaatechgroup.com, venkateshwarrao@aaatechgroup.com"
              style={{
                width: "100%",
                minHeight: 80,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </div>

      <button
        className="feedback-modal-close"
        disabled={
          shareModal.submitting ||
          !shareModal.recipients.trim()
        }
        onClick={async () => {
          if (!token) return;
          if (shareModal.messageIndex == null) return;
          if (!activeConversation.messages?.length) return;


          const emails = shareModal.recipients
            .split(",")
            .map((e) => e.trim())
            .filter((e) => e);

          setShareModal((p) => ({ ...p, submitting: true }));

          try {
            const res = await fetch(
              "http://localhost:8000/feedback/share",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  conversation_id: activeConvId,
                  request_id: `${activeConvId}-${shareModal.messageIndex}`,
                  shared_with: emails,
                }),
              }
            );

            if (res.ok) {
              const data = await res.json();

              if (data.share_url) {
                await navigator.clipboard.writeText(
                  data.share_url
                );
              }

              setShareModal({
                show: false,
                messageIndex: null,
                recipients: "",
                submitting: false,
              });

              setModalState({
                show: true,
                type: "success",
                message:
                  "Conversation shared successfully.\nLink copied to clipboard.",
              });
            } else {
              const err = await res.json();
              setModalState({
                show: true,
                type: "error",
                message:
                  err.detail || "Failed to share conversation",
              });
              setShareModal((p) => ({
                ...p,
                submitting: false,
              }));
            }
          } catch {
            setModalState({
              show: true,
              type: "error",
              message: "Failed to share conversation",
            });
            setShareModal((p) => ({
              ...p,
              submitting: false,
            }));
          }
        }}
      >
        {shareModal.submitting ? "Sharing..." : "Share"}
      </button>
    </div>
  </>
)}

    </div>
  );
}
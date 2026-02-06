/* =========================
   MCP CORE TYPES
========================= */

/**
 * Chart payload returned by MCP
 */
export interface ChartPayload {
  chart_type: "bar" | "line" | "pie" | "area" | "scatter";
  image_url?: string;
  image_base64?: string | null;
  spec?: {
    x: string[];
    y: number[];
    title?: string;
    x_label?: string;
    y_label?: string;
  };
}

/**
 * Tabular dataset returned by MCP
 * This is what enables REAL tables in UI
 */
export interface MCPTableData {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  row_count?: number;
}

/**
 * Metadata about how the answer was generated
 */
export interface MCPConfidence {
  score: number;
  reasons: string[];
}

/**
 * Full MCP response contract
 * Think of this as your "LLM → UI API"
 */
export interface MCPResponse {
  /** Natural language explanation */
  answer: string;

  /** Structured data for table rendering */
  data?: MCPTableData;

  /** Optional visualization */
  chart?: ChartPayload;

  /** Confidence & guardrails */
  confidence: number;
  confidence_reasons: string[];

  /** Conversation tracking */
  conversation_id: string;
  request_id: string;

  /** Debug / audit (optional) */
  SQL?: string;
}

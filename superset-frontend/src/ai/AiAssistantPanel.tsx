import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import ChatPage from "./assistant/ChatPage";

export default function AiAssistantPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mountedRef.current) return;

    mountedRef.current = true;
    ReactDOM.render(<ChatPage />, el);

    return () => {
      // cleanup when hot-reload/unmount happens
      try {
        ReactDOM.unmountComponentAtNode(el);
      } catch {}
      mountedRef.current = false;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 48,
        width: "420px",
        height: "calc(100vh - 48px)",
        background: "#fff",
        borderLeft: "1px solid #e0e0e0",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} style={{ height: "100%" }} />
    </div>
  );
}

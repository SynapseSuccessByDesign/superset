import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import ChatPage from "./assistant/ChatPage";

export default function AiAssistantPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const [open, setOpen] = useState(false);

  // expose toggle globally so "My Button" can control it
  useEffect(() => {
    (window as any).__TOGGLE_AI__ = () =>
      setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mountedRef.current || !open) return;

    mountedRef.current = true;
    ReactDOM.render(<ChatPage />, el);

    return () => {
      try {
        ReactDOM.unmountComponentAtNode(el);
      } catch {}
      mountedRef.current = false;
    };
  }, [open]);

if (!open) return null;

return (
  <div
    style={{
      position: "fixed",
      right: 0,
      top: 48,
      width: "560px",                     // wider → no squeeze
      height: "calc(100vh - 48px)",
      background: "#ffffff",
      borderLeft: "1px solid #e5e7eb",
      zIndex: 99999,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "-4px 0 18px rgba(0,0,0,0.08)",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.28s ease",
    }}
  >
    <div
      ref={containerRef}
      style={{
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    />
  </div>
);
}

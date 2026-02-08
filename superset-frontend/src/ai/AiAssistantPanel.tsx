import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useSelector } from "react-redux";
import ChatPage from "./assistant/ChatPage";
import "./assistant/ChatPage.css";

export default function AiAssistantPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const [open, setOpen] = useState(false);

  const user = useSelector((state: any) => state.user);
  const loggedIn = user && !user.isAnonymous;

  useEffect(() => {
    (window as any).__TOGGLE_AI__ = () => {
      if (!loggedIn) return;
      setOpen(prev => !prev);
    };
    return () => {
      delete (window as any).__TOGGLE_AI__;
    };
  }, [loggedIn]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mountedRef.current || !open || !loggedIn) return;

    mountedRef.current = true;
    ReactDOM.render(<ChatPage />, el);

    return () => {
      try {
        ReactDOM.unmountComponentAtNode(el);
      } catch {}
      mountedRef.current = false;
    };
  }, [open, loggedIn]);

  if (!open || !loggedIn) return null;

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 999998,
          backdropFilter: "blur(2px)",
        }}
      />
      
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          width: "680px", // Increased from 560px
          height: "100vh",
          background: "#f5f7fa",
          borderLeft: "1px solid #e5e7eb",
          zIndex: 999999,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          animation: "slideIn 0.3s ease-out",
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: "#6b7280",
            zIndex: 10,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f3f4f6";
            e.currentTarget.style.borderColor = "#d1d5db";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.borderColor = "#e5e7eb";
          }}
        >
          ✕
        </button>

        <div
          ref={containerRef}
          style={{
            height: "100%",
            width: "100%",
            overflow: "auto",
          }}
        />
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
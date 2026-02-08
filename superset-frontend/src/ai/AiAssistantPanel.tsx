import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useSelector } from "react-redux";
import ChatPage from "./assistant/ChatPage";
import "./assistant/ChatPage.css";


export default function AiAssistantPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  const [open, setOpen] = useState(false);

  // ✅ Read real auth state from Redux (correct in Superset)
  const user = useSelector((state: any) => state.user);
  const loggedIn = user && !user.isAnonymous;

  console.log('[AiAssistantPanel] user:', user, 'loggedIn:', loggedIn);

  // --- Global toggle handler ---
  useEffect(() => {
    (window as any).__TOGGLE_AI__ = () => {
      console.log('[AI Toggle] loggedIn:', loggedIn, 'current open:', open);
      if (!loggedIn) {
        console.warn('[AI Toggle] Blocked - user not logged in');
        return;
      }
      setOpen(prev => {
        console.log('[AI Toggle] Setting open to:', !prev);
        return !prev;
      });
    };

    return () => {
      delete (window as any).__TOGGLE_AI__;
    };
  }, [loggedIn]);

  // --- Mount ChatPage only when open ---
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
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        width: "560px",
        height: "100vh",
        background: "#ffffff",
        borderLeft: "1px solid #e5e7eb",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-4px 0 18px rgba(0,0,0,0.08)",
      }}
    >
      <div
        ref={containerRef}
        style={{
          height: "100%",
          width: "100%",
          overflow: "auto",
        }}
      />
    </div>
  );
}
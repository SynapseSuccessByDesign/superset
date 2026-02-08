import { useEffect, useState } from "react";
import getBootstrapData from "src/utils/getBootstrapData";

const API_BASE = "http://127.0.0.1:8000";

export default function useSupersetAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loginToBackend() {
      try {
        const bootstrap = getBootstrapData();
        const email = bootstrap?.user?.email;

        if (!email) {
          console.error("❌ Superset user email not found");
          setLoading(false);
          return;
        }

        console.log("🔐 Auto login using Superset user:", email);

        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", "dummy_password");

        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded" 
          },
          body: formData,
        });

        if (!res.ok) {
          const error = await res.text();
          console.error("❌ Backend login failed:", res.status, error);
          setLoading(false);
          return;
        }

        const data = await res.json();
        console.log("✅ Login successful, token received");
        setToken(data.access_token);
      } catch (e) {
        console.error("❌ Auto login error:", e);
      } finally {
        setLoading(false);
      }
    }

    loginToBackend();
  }, []);

  return { token, loading };
}
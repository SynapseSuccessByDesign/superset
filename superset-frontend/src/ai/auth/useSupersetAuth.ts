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
          console.error("Superset user email not found");
          setLoading(false);
          return;
        }

        console.log("Auto login using Superset user:", email);

        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: email,
            password: "dummy_password",   // backend ignores / maps internally
          }),
        });

        if (!res.ok) {
          console.error("Backend login failed");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setToken(data.access_token);
      } catch (e) {
        console.error("Auto login error:", e);
      } finally {
        setLoading(false);
      }
    }

    loginToBackend();
  }, []);

  return { token, loading };
}

import { useEffect, useState } from "react";
import getBootstrapData from "src/utils/getBootstrapData";

const API_BASE = "http://127.0.0.1:8000";
const SUPERSET_API_BASE = "http://localhost:9000";

// ✅ Email to username/password mapping
const USER_CREDENTIALS: Record<string, { username: string; password: string }> = {
  "subbu@aaatechgroup.com": { username: "subbu", password: "Admin@123" },
  "likitha@aaatechgroup.com": { username: "likitha", password: "Likitha@123" },
  "venkateshwarrao@aaatechgroup.com": { username: "venkatesh", password: "Venkat@123" },
};

export default function useSupersetAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [supersetToken, setSupersetToken] = useState<string | null>(null);
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

        // ✅ Step 1: Get Superset credentials for this user
        const credentials = USER_CREDENTIALS[email];
        
        if (credentials) {
          try {
            console.log(`🔑 Logging into Superset as ${credentials.username}...`);
            
            const supersetLoginRes = await fetch(`${SUPERSET_API_BASE}/api/v1/security/login`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json" 
              },
              body: JSON.stringify({
                username: credentials.username,
                password: credentials.password,
                provider: "db",
                refresh: true
              }),
            });

            if (supersetLoginRes.ok) {
              const supersetData = await supersetLoginRes.json();
              const supersetAccessToken = supersetData.access_token;
              
              if (supersetAccessToken) {
                console.log("✅ Superset token obtained");
                setSupersetToken(supersetAccessToken);
              } else {
                console.warn("⚠️ No access_token in Superset response");
              }
            } else {
              const error = await supersetLoginRes.text();
              console.error("❌ Superset login failed:", supersetLoginRes.status, error);
            }
          } catch (e) {
            console.error("❌ Superset login error:", e);
          }
        } else {
          console.warn(`⚠️ No credentials configured for ${email}`);
        }

        // ✅ Step 2: Login to MCP backend
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
        console.log("✅ MCP login successful");
        setToken(data.access_token);
      } catch (e) {
        console.error("❌ Auto login error:", e);
      } finally {
        setLoading(false);
      }
    }

    loginToBackend();
  }, []);

  return { token, supersetToken, loading };
}
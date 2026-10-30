import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Support unavailable" }, 503);
    const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Sign in to connect Telegram" }, 401);
    const db = createClient(url, service);
    const { data: profile, error: profileError } = await db.from("profiles").select("banned_at").eq("id", user.id).maybeSingle();
    if (profileError) return json({ error: "Could not check account" }, 503);
    if (!profile || profile.banned_at) return json({ error: "Account unavailable" }, 403);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const { error } = await db.from("telegram_link_tokens").insert({ token_hash: tokenHash, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (error) return json({ error: "Could not connect Telegram" }, 503);
    return json({ url: `https://t.me/nexushelp2bot?start=${token}` });
  } catch {
    return json({ error: "Could not connect Telegram" }, 503);
  }
});
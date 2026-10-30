import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ADMIN_CHAT_ID = 8264469260; // site owner's Telegram chat with @nexushelp2bot
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return json({ error: "Telegram not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { ticket_id } = await req.json().catch(() => ({}));
    if (typeof ticket_id !== "string" || ticket_id.length > 64) return json({ error: "Invalid ticket" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: t } = await admin.from("tickets").select("id,user_id,subject,message,created_at").eq("id", ticket_id).maybeSingle();
    if (!t || t.user_id !== user.id) return json({ error: "Not found" }, 404);
    const { data: p } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();

    const text =
      `🎫 <b>New ticket</b>\n` +
      `<b>From:</b> ${esc(p?.username ?? user.email ?? user.id)}\n` +
      `<b>Subject:</b> ${esc(t.subject)}\n\n${esc(t.message)}\n\n` +
      `<i>#${t.id.slice(0, 8)}</i>`;

    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Telegram send failed [${res.status}]: ${body}`);
      return json({ error: "Telegram send failed", status: res.status, details: body }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

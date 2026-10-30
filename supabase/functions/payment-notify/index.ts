import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const ADMIN_CHAT_ID = 8264469260;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return json({ error: "Telegram not configured" }, 500);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { payment_id } = await req.json().catch(() => ({}));
    if (typeof payment_id !== "string" || !/^[0-9a-f-]{36}$/i.test(payment_id)) return json({ error: "Invalid payment" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: p } = await admin.from("payments").select("id,user_id,coin,amount,total_credit,cart_total,status").eq("id", payment_id).maybeSingle();
    if (!p || p.user_id !== user.id || p.status !== "pending") return json({ error: "Not found" }, 404);
    const { data: prof } = await admin.from("profiles").select("username,balance").eq("id", user.id).maybeSingle();

    const text =
      `💰 <b>New top-up</b>\n<b>From:</b> ${esc(prof?.username ?? user.email ?? user.id)}\n` +
      `<b>Amount:</b> $${Number(p.amount).toFixed(2)} via ${esc(p.coin)}\n` +
      `<b>Credit:</b> $${Number(p.total_credit).toFixed(2)}` +
      (Number(p.cart_total) > 0 ? `\n<b>Order waiting:</b> $${Number(p.cart_total).toFixed(2)}` : "") +
      `\n<b>Current balance:</b> $${Number(prof?.balance ?? 0).toFixed(2)}\n<i>#${p.id.slice(0, 8)}</i>`;
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TELEGRAM_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID, text, parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[
          { text: "✅ Approve", callback_data: `pay:a:${p.id}` },
          { text: "❌ Reject", callback_data: `pay:r:${p.id}` },
        ]] },
      }),
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

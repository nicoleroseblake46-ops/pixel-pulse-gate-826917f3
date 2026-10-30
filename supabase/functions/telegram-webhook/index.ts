const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const ADMIN_CHAT_ID = 8264469260; // site owner's chat with @nexushelp2bot

async function deriveSecret(key: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function safeEqual(a: string | null, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const HELP =
  "👋 <b>Nexus Support</b>\n\n" +
  "Commands:\n" +
  "/ticket <i>your message</i> — open a support ticket\n" +
  "/help — show this menu\n\n" +
  "Example:\n<code>/ticket My deposit hasn't arrived yet</code>\n\n" +
  "You can also just type your message and it will be sent as a ticket.";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return new Response("Not configured", { status: 500 });

  if (!safeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), await deriveSecret(TELEGRAM_API_KEY))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const send = async (chat_id: number, text: string) => {
    const r = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TELEGRAM_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!r.ok) console.error(`sendMessage failed [${r.status}]: ${await r.text()}`);
    return r.ok;
  };

  try {
    const update = await req.json();
    const msg = update.message;
    if (!msg?.chat?.id || typeof msg.text !== "string") return new Response("ok");
    const chatId: number = msg.chat.id;
    const text: string = msg.text.trim().slice(0, 2000);

    // Admin replying to a forwarded ticket -> deliver answer to the customer
    if (chatId === ADMIN_CHAT_ID) {
      const original: string | undefined = msg.reply_to_message?.text;
      const m = original?.match(/Chat ID:\s*(-?\d+)/);
      if (m) {
        const ok = await send(Number(m[1]), `💬 <b>Support reply</b>\n\n${esc(text)}`);
        await send(ADMIN_CHAT_ID, ok ? "✅ Reply delivered." : "⚠️ Could not deliver the reply.");
      } else if (text.startsWith("/")) {
        await send(ADMIN_CHAT_ID, "ℹ️ To answer a customer, swipe-reply to their ticket message.");
      }
      return new Response("ok");
    }

    if (text === "/start" || text === "/help") {
      await send(chatId, HELP);
      return new Response("ok");
    }

    let body = text;
    if (text.startsWith("/ticket")) body = text.replace(/^\/ticket(@\w+)?/, "").trim();
    else if (text.startsWith("/")) { await send(chatId, HELP); return new Response("ok"); }

    if (body.length < 2) {
      await send(chatId, "Please add your message after /ticket, e.g.\n<code>/ticket My order is missing</code>");
      return new Response("ok");
    }

    const from = msg.from ?? {};
    const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Unknown";
    const handle = from.username ? `@${from.username}` : "no username";
    const ref = `T${update.update_id.toString(36).toUpperCase()}`;

    await send(
      ADMIN_CHAT_ID,
      `🎫 <b>New Telegram ticket</b> ${ref}\n<b>From:</b> ${esc(name)} (${esc(handle)})\nChat ID: ${chatId}\n\n${esc(body)}\n\n<i>Reply to this message to answer.</i>`,
    );
    await send(chatId, `✅ Ticket <b>${ref}</b> received. Our support team will reply here shortly.`);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok");
  }
});

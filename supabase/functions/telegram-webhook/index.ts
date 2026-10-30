import { createClient } from "npm:@supabase/supabase-js@2";
import { canRaiseTelegramTicket } from "./eligibility.ts";
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
  "🎫 Raise a ticket — tap the button below, or use /ticket <i>your message</i>\n" +
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

  const KEYBOARD = { keyboard: [[{ text: "🎫 Raise a ticket" }], [{ text: "❓ Help" }]], resize_keyboard: true, is_persistent: true };
  const send = async (chat_id: number, text: string, markup?: unknown) => {
    const r = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TELEGRAM_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) }),
    });
    if (!r.ok) {
      console.error(`sendMessage failed [${r.status}]: ${await r.text()}`);
      return false;
    }
    const result = await r.json();
    if (!result.ok) console.error("sendMessage failed:", result.description);
    return result.ok === true;
  };

  const dbUrl = Deno.env.get("SUPABASE_URL");
  const dbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!dbUrl || !dbKey) return new Response("Not configured", { status: 503 });
  const db = createClient(dbUrl, dbKey);
  try {
    const update = await req.json();
    const cq = update.callback_query;
    if (cq) {
      const tg = (method: string, payload: unknown) => fetch(`${GATEWAY_URL}/${method}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TELEGRAM_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const m = typeof cq.data === "string" ? cq.data.match(/^pay:([ar]):([0-9a-f-]{36})$/i) : null;
      if (cq.from?.id !== ADMIN_CHAT_ID || !m) {
        await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Not allowed" });
        return new Response("ok");
      }
      const { data: result, error } = await db.rpc("bot_review_payment", { _payment_id: m[2], _approve: m[1] === "a" });
      const label = error ? `⚠️ Failed: ${error.message}` : result === "confirmed" ? "✅ Approved — balance credited" : result === "rejected" ? "❌ Rejected" : `ℹ️ Already ${result}`;
      await tg("answerCallbackQuery", { callback_query_id: cq.id, text: label.slice(0, 190) });
      if (!error && cq.message) {
        await tg("editMessageText", {
          chat_id: cq.message.chat.id, message_id: cq.message.message_id, parse_mode: "HTML",
          text: `${esc(cq.message.text ?? "")}\n\n<b>${esc(label)}</b>`,
        });
      }
      return new Response("ok");
    }
    const msg = update.message;
    if (!msg?.chat?.id || typeof msg.text !== "string") return new Response("ok");
    const chatId: number = msg.chat.id;
    const text: string = msg.text.trim().slice(0, 2000);

    // Admin replying to a forwarded ticket -> deliver answer to the customer
    if (chatId === ADMIN_CHAT_ID) {
      const original: string | undefined = msg.reply_to_message?.text;
      const m = original?.match(/Chat ID:\s*(-?\d+)/);
      if (m) {
        const ok = await send(Number(m[1]), `💬 <b>Support reply</b>\n\n${esc(text)}\n\n<i>You can now raise a new ticket if needed.</i>`);
        if (ok) await db.from("telegram_open_tickets").delete().eq("chat_id", Number(m[1]));
        await send(ADMIN_CHAT_ID, ok ? "✅ Reply delivered." : "⚠️ Could not deliver the reply.");
      } else if (text.startsWith("/")) {
        await send(ADMIN_CHAT_ID, "ℹ️ To answer a customer, swipe-reply to their ticket message.");
      }
      return new Response("ok");
    }

    // Only private chats may link accounts or raise support tickets.
    if (msg.chat.type !== "private" || msg.from?.id !== chatId) return new Response("ok");
    const start = text.match(/^\/start(?:@\w+)?(?:\s+([a-f0-9]{48}))?$/i);
    if (start?.[1]) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(start[1]));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const { data: linked, error } = await db.rpc("consume_telegram_link", { _token_hash: hash, _chat_id: chatId });
      if (error || !linked) {
        await send(chatId, "This account link has expired or was already used. Open Tickets on the website and tap Telegram again.", { remove_keyboard: true });
        return new Response("ok");
      }
    }
    const { data: link, error: linkError } = await db.from("telegram_account_links").select("user_id").eq("chat_id", chatId).maybeSingle();
    if (linkError) throw linkError;
    if (!link) {
      await send(chatId, "👋 Welcome to Nexus Support. Connect your site account by opening Tickets on the website and tapping Telegram. A positive account balance is required to raise tickets.", { remove_keyboard: true });
      return new Response("ok");
    }
    const { data: profile, error: profileError } = await db.from("profiles").select("balance,banned_at").eq("id", link.user_id).maybeSingle();
    if (profileError) throw profileError;
    if (!canRaiseTelegramTicket(profile)) {
      await send(chatId, profile?.banned_at ? "This account cannot use support. Your account is restricted." : "👋 Welcome to Nexus Support. You cannot raise a ticket while your site balance is $0 or below. Top up your account, then send /start again.", { remove_keyboard: true });
      return new Response("ok");
    }

    if (start || text === "/help" || text === "❓ Help") {
      await send(chatId, HELP, KEYBOARD);
      return new Response("ok");
    }
    if (text === "🎫 Raise a ticket" || text === "/ticket") {
      await send(chatId, "✍️ Type your issue in one message and send it. Our support team will reply right here.", KEYBOARD);
      return new Response("ok");
    }

    let body = text;
    if (text.startsWith("/ticket")) body = text.replace(/^\/ticket(@\w+)?/, "").trim();
    else if (text.startsWith("/")) { await send(chatId, HELP); return new Response("ok"); }

    if (body.length < 2) {
      await send(chatId, "Please add your message after /ticket, e.g.\n<code>/ticket My order is missing</code>");
      return new Response("ok");
    }

    const { data: open, error: openError } = await db.from("telegram_open_tickets").select("ticket_ref").eq("chat_id", chatId).maybeSingle();
    if (openError) throw openError;
    if (open) {
      await send(chatId, `⏳ Your ticket <b>${esc(open.ticket_ref ?? "")}</b> is still waiting for a reply. You can send a new ticket once support answers it.`, KEYBOARD);
      return new Response("ok");
    }

    const from = msg.from ?? {};
    const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Unknown";
    const handle = from.username ? `@${from.username}` : "no username";
    const ref = `T${update.update_id.toString(36).toUpperCase()}`;

    const { error: reserveError } = await db.from("telegram_open_tickets").insert({ chat_id: chatId, ticket_ref: ref });
    if (reserveError) {
      if (reserveError.code !== "23505") throw reserveError;
      await send(chatId, "⏳ Your earlier ticket is still waiting for a reply.", KEYBOARD);
      return new Response("ok");
    }
    const delivered = await send(
      ADMIN_CHAT_ID,
      `🎫 <b>New Telegram ticket</b> ${ref}\n<b>From:</b> ${esc(name)} (${esc(handle)})\nChat ID: ${chatId}\n\n${esc(body)}\n\n<i>Reply to this message to answer.</i>`,
    );
    if (!delivered) {
      await db.from("telegram_open_tickets").delete().eq("chat_id", chatId).eq("ticket_ref", ref);
      await send(chatId, "We couldn't send your ticket. Please try again shortly.");
      return new Response("ok");
    }
    await send(chatId, `✅ Ticket <b>${ref}</b> received. Our support team will reply here shortly.`);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok");
  }
});

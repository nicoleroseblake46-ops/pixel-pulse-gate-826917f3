import { describe, expect, it } from "vitest";
import { canRaiseTelegramTicket } from "../../supabase/functions/telegram-webhook/eligibility";

describe("Telegram ticket balance eligibility", () => {
  it("blocks a zero-balance account", () => {
    expect(canRaiseTelegramTicket({ balance: 0, banned_at: null })).toBe(false);
  });
  it("allows any positive balance", () => {
    expect(canRaiseTelegramTicket({ balance: "0.01", banned_at: null })).toBe(true);
  });
  it("blocks negative balances", () => {
    expect(canRaiseTelegramTicket({ balance: -1, banned_at: null })).toBe(false);
  });
  it("blocks accounts not linked to a profile", () => {
    expect(canRaiseTelegramTicket(null)).toBe(false);
  });
  it("blocks banned accounts even with balance", () => {
    expect(canRaiseTelegramTicket({ balance: 100, banned_at: "2026-10-30" })).toBe(false);
  });
});
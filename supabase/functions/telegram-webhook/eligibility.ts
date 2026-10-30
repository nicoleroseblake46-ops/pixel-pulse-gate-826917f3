export type SupportProfile = { balance: number | string | null; banned_at: string | null };

export function canRaiseTelegramTicket(profile: SupportProfile | null): boolean {
  return !!profile && !profile.banned_at && Number(profile.balance) > 0;
}
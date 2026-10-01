export type CoinKey = "BTC" | "LTC" | "USDT/TRC20";
export type PaymentMethod = { address: string; enabled: boolean };
export type PaymentMethods = Record<CoinKey, PaymentMethod>;

export const COINS: CoinKey[] = ["BTC", "LTC", "USDT/TRC20"];

export const DEFAULT_METHODS: PaymentMethods = {
  BTC: { address: "bc1qrz7zdzjrht9njz24zhpzvyta82yqdpa59cthsq", enabled: true },
  LTC: { address: "ltc1qu78zvrz0u6n0z4cxn34280p9fag6qrjxunz442", enabled: true },
  "USDT/TRC20": { address: "TBTM7mbjaptqK2sKr8hxqDSMdmaQawd2t8", enabled: true },
};

/** Merge stored admin settings over defaults. */
export const resolveMethods = (raw: unknown): PaymentMethods => {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, Partial<PaymentMethod>>;
  const out = {} as PaymentMethods;
  for (const c of COINS) {
    const s = src[c] ?? {};
    out[c] = {
      address: typeof s.address === "string" && s.address.trim() ? s.address.trim() : DEFAULT_METHODS[c].address,
      enabled: typeof s.enabled === "boolean" ? s.enabled : true,
    };
  }
  return out;
};

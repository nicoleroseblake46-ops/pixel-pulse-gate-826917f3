// Shared delivery formatting so buyers always receive the complete payload.

type AnyProduct = Record<string, any>;

const push = (parts: string[], label: string, value?: unknown) => {
  const v = typeof value === "string" ? value.trim() : value;
  if (v === null || v === undefined || v === "" || v === "-") return;
  parts.push(`${label}: ${v}`);
};

const clean = (v?: string | null) => (v ? v.replace(/[*✅]/g, "").trim() : "");

const pick = (extras: string | null | undefined, key: "EMAIL" | "PHONE") => {
  if (!extras) return "";
  const m = extras.match(new RegExp(`${key}\\s*:\\s*([^|]+)`, "i"));
  return m ? m[1].trim() : "";
};

/** Full card payload: PAN|EXP|CVV plus complete cardholder identity. */
export const buildCardDelivery = (p: AnyProduct, existingCard?: string) => {
  const parts: string[] = [];
  const fullCard = clean(p.full_card) || clean(existingCard);
  const [pan, cardExp, cvv] = (fullCard || "").split("|").map((s) => s?.trim());

  push(parts, "CARD", fullCard);
  push(parts, "NUMBER", pan);
  push(parts, "EXP", cardExp || clean(p.exp));
  push(parts, "CVV", cvv);
  push(parts, "NAME", clean(p.seller));
  push(parts, "ADDRESS", [clean(p.city), clean(p.state), clean(p.zip)].filter(Boolean).join(", "));
  push(parts, "COUNTRY", clean(p.country));
  push(parts, "EMAIL", pick(p.extras, "EMAIL"));
  push(parts, "PHONE", pick(p.extras, "PHONE"));
  push(parts, "BANK", clean(p.bank));
  push(parts, "BIN", clean(p.bin));
  push(parts, "TYPE", [p.brand, p.card_type, p.level].map(clean).filter(Boolean).join(" · "));
  push(parts, "BASE", clean(p.name));
  const validMatch = String(p.name ?? "").match(/(\d{2,3})\s*%\s*valid/i);
  push(parts, "VALIDITY", validMatch ? `${validMatch[1]}%` : clean(p.valid));

  return parts.length ? parts.join(" | ") : undefined;
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

/** Proxy payload — falls back to a deterministic mock endpoint when none is set. */
export const buildProxyDelivery = (p: AnyProduct) => {
  if (p.extras && /PROXY\s*:/i.test(p.extras)) return String(p.extras).trim();

  const h = hash(String(p.id ?? p.name ?? "proxy"));
  const ip = p.host_ip || `${10 + (h % 200)}.${(h >> 3) % 255}.${(h >> 7) % 255}.${1 + ((h >> 11) % 254)}`;
  const port = 8000 + (h % 1500);
  const user = `usr${h.toString(36).slice(0, 6)}`;
  const pass = (h * 2654435761 >>> 0).toString(36).slice(0, 10);

  const parts = [
    `PROXY: ${ip}:${port}`,
    `USER: ${user}`,
    `PASS: ${pass}`,
    `PROTOCOL: ${p.card_type || "SOCKS5/HTTP"}`,
    p.level ? `SPEED: ${p.level}` : "",
    [clean(p.city), clean(p.state), clean(p.country)].filter(Boolean).join(", ")
      ? `LOCATION: ${[clean(p.city), clean(p.state), clean(p.country)].filter(Boolean).join(", ")}`
      : "",
    p.bank ? `PROVIDER: ${p.bank}` : "",
    "ROTATION: sticky 30m",
    p.extras ? String(p.extras).trim() : "",
  ].filter(Boolean);

  return parts.join(" | ");
};

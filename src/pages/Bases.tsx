import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Database, Radio, ArrowUpRight, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CountryFlag } from "@/components/CountryFlag";
import { supabase } from "@/integrations/supabase/client";
import { findCountry } from "@/lib/countries";

type Row = {
  id: string;
  name: string;
  category: string;
  country_code: string | null;
  valid: string | null;
  price: number;
  created_at: string;
};

type BaseGroup = {
  name: string;
  category: string;
  count: number;
  countries: string[];
  validity: string | null;
  minPrice: number;
  updatedAt: string;
};

const validityOf = (name: string, valid: string | null): string | null => {
  const m = name.match(/(\d{2,3})\s*%\s*valid/i);
  if (m) return `${m[1]}%`;
  if (valid && /\d/.test(valid)) return valid;
  return null;
};

const Bases = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name,category,country_code,valid,price,created_at")
      .eq("is_active", true)
      .in("category", ["cards", "sales"])
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`bases-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const bases = useMemo<BaseGroup[]>(() => {
    const map = new Map<string, BaseGroup>();
    for (const r of rows) {
      const key = (r.name ?? "").trim();
      if (!key) continue;
      const code = findCountry(r.country_code)?.code ?? (r.country_code ?? "").toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (code && !existing.countries.includes(code)) existing.countries.push(code);
        if (Number(r.price) < existing.minPrice) existing.minPrice = Number(r.price);
        if (!existing.validity) existing.validity = validityOf(key, r.valid);
      } else {
        map.set(key, {
          name: key,
          category: r.category,
          count: 1,
          countries: code ? [code] : [],
          validity: validityOf(key, r.valid),
          minPrice: Number(r.price) || 0,
          updatedAt: r.created_at,
        });
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const filtered = useMemo(
    () => bases.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())),
    [bases, q],
  );
  const totalLive = filtered.reduce((n, b) => n + b.count, 0);

  return (
    <AppLayout>
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-background to-accent/10 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Live inventory
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight md:text-3xl">Bases</h1>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search base…"
              className="h-10 w-56 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 font-mono text-[11px] uppercase text-muted-foreground">
          <span className="flex items-center gap-1.5 text-primary">
            <Radio className="h-3.5 w-3.5" /> {filtered.length} {filtered.length === 1 ? "base" : "bases"}
          </span>
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" /> {totalLive.toLocaleString()} live cards
          </span>
        </div>
      </section>

      {loading && !rows.length && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      {!loading && !filtered.length && (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center text-muted-foreground">
          No bases found.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((b) => {
          const to = b.category === "sales"
            ? `/sales?base=${encodeURIComponent(b.name)}`
            : `/cards?base=${encodeURIComponent(b.name)}`;
          const pct = b.validity ? parseInt(b.validity, 10) : 0;
          return (
            <Link
              key={b.name}
              to={to}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-smooth hover:-translate-y-0.5 hover:border-primary/50 sm:flex-row sm:items-center sm:gap-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-sm font-extrabold text-foreground transition-colors group-hover:text-primary sm:text-base">
                    {b.name}
                  </h2>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                  {b.countries.length ? (
                    b.countries.slice(0, 10).map((code) => (
                      <span key={code} className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-foreground">
                        <CountryFlag value={code} width={18} /> {code}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Mixed inventory</span>
                  )}
                  {b.countries.length > 10 && (
                    <span className="font-mono text-[11px] text-primary">+{b.countries.length - 10}</span>
                  )}
                </div>
              </div>

              {b.validity && (
                <div className="flex items-center gap-2 sm:w-40 sm:flex-col sm:items-end">
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{b.validity} valid</span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, pct)}%` }} />
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-6 sm:w-44 sm:justify-end">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Live stock</div>
                  <div className="font-mono text-sm font-bold text-foreground">{b.count.toLocaleString()}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From</div>
                  <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">${b.minPrice.toFixed(2)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </AppLayout>
  );
};

export default Bases;

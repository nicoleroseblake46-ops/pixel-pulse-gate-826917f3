import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tag, CreditCard, Zap, Network, Search, ShoppingCart, MonitorSmartphone, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SectionPage } from "@/components/SectionPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/contexts/CommerceContext";
import { useProducts, type Product } from "@/hooks/use-products";
import { Loader } from "@/components/Loader";
import { CountryFlag } from "@/components/CountryFlag";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useAdmin } from "@/hooks/use-admin";
import { toast } from "sonner";


export const Sales = () => {
  const { salesHidden } = useAppSettings();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    if (salesHidden && !isAdmin) navigate("/", { replace: true });
  }, [salesHidden, isAdmin, navigate]);
  if (salesHidden && !isAdmin) return null;
  return <SectionPage title="Sales" Icon={Tag} category="sales" />;
};

/* ---------------- SOCKS ---------------- */

const emptySockFilters = { country: "", state: "", city: "", type: "", provider: "" };

export const Socks = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, addToCart, addManyToCart } = useCommerce();
  const { products, loading } = useProducts("socks");

  const [draft, setDraft] = useState(emptySockFilters);
  const [filters, setFilters] = useState(emptySockFilters);
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [appliedPrice, setAppliedPrice] = useState([0, 500]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const pageSize = 20;

  const filtered = useMemo(() => {
    const t = (v: string | null, q: string) => (v ?? "").toLowerCase().includes(q.trim().toLowerCase());
    return products.filter((s) =>
      t(s.country, filters.country) &&
      t(s.state, filters.state) &&
      t((s as any).city, filters.city) &&
      t(s.card_type, filters.type) &&
      t(s.bank, filters.provider) &&
      Number(s.price) >= appliedPrice[0] &&
      Number(s.price) <= appliedPrice[1]
    );
  }, [products, filters, appliedPrice]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const cartIdFor = (id: string) => `socks-${id}`;
  const composeDelivery = (s: Product) => {
    const parts: string[] = [];
    const addr = [(s as any).city, s.state, s.country].filter(Boolean).join(", ");
    if (addr) parts.push(`LOCATION: ${addr}`);
    if (s.card_type) parts.push(`TYPE: ${s.card_type}`);
    if (s.bank) parts.push(`PROVIDER: ${s.bank}`);
    if (s.level) parts.push(`SPEED: ${s.level}`);
    if (s.extras) parts.push(s.extras);
    return parts.length ? parts.join(" | ") : undefined;
  };
  const buildItem = (s: Product) => ({
    id: cartIdFor(s.id),
    name: s.name,
    meta: `${(s as any).city ?? ""}${(s as any).city && s.country ? " · " : ""}${s.country ?? ""}`.trim() || s.meta,
    price: Number(s.price),
    delivery: composeDelivery(s),
  });

  const addSock = (s: Product) => { addToCart(buildItem(s)); toast.success("Added to cart"); };
  const addSelected = () => {
    const items = filtered.filter((s) => selected[s.id]).map(buildItem);
    if (!items.length) return toast.error("Nothing selected");
    addManyToCart(items);
    toast.success(`${items.length} proxies added`);
    setSelected({});
  };
  const runSearch = () => { setFilters(draft); setAppliedPrice(priceRange); setPage(1); };

  const opts = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map((v) => (v ?? "").trim()).filter(Boolean))).sort();
    return {
      country: uniq(products.map((p) => p.country)),
      state: uniq(products.map((p) => p.state)),
      city: uniq(products.map((p) => (p as any).city)),
      type: uniq(products.map((p) => p.card_type)),
      provider: uniq(products.map((p) => p.bank)),
    };
  }, [products]);

  return (
    <AppLayout>
      <section className="mb-5 rounded-xl border border-border bg-card p-4 md:p-5 animate-fade-up">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <Field label="Country"><FilterSelect placeholder="Any country" value={draft.country} options={opts.country} onChange={(v) => setDraft({ ...draft, country: v })} /></Field>
          <Field label="State"><FilterSelect placeholder="Any state" value={draft.state} options={opts.state} onChange={(v) => setDraft({ ...draft, state: v })} /></Field>
          <Field label="City"><FilterSelect placeholder="Any city" value={draft.city} options={opts.city} onChange={(v) => setDraft({ ...draft, city: v })} /></Field>
          <Field label="Type"><FilterSelect placeholder="Any type" value={draft.type} options={opts.type} onChange={(v) => setDraft({ ...draft, type: v })} /></Field>
          <Field label="Provider"><FilterSelect placeholder="Any provider" value={draft.provider} options={opts.provider} onChange={(v) => setDraft({ ...draft, provider: v })} /></Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Price</span>
              <span className="font-mono text-primary">${priceRange[0]} - ${priceRange[1]}</span>
            </div>
            <Slider min={0} max={500} step={1} value={priceRange} onValueChange={setPriceRange} />
          </div>
          <Button onClick={runSearch} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Search className="h-4 w-4" /> Search
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={addSelected} className="bg-emerald-500 text-white hover:bg-emerald-600">+ Add Cart</Button>
            <Button variant="secondary" onClick={() => navigate("/payments")} className="bg-emerald-700 text-white hover:bg-emerald-800">
              <ShoppingCart className="h-4 w-4" /> Checkout · ${cartTotal.toFixed(2)} ({cartItems.length})
            </Button>
          </div>
          <div className="font-mono text-xs text-muted-foreground">{filtered.length} matches</div>
        </div>

        {loading ? (
          <div className="p-10"><Loader /></div>
        ) : !filtered.length ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No proxies match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-secondary/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th className="w-10"></Th>
                  <Th>Name</Th>
                  <Th>Country</Th>
                  <Th>State</Th>
                  <Th>City</Th>
                  <Th>Type</Th>
                  <Th>Provider</Th>
                  <Th>Speed</Th>
                  <Th>Price</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {paged.map((s) => {
                  const inCart = cartItems.some((i) => i.id === cartIdFor(s.id));
                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
                      <Td>
                        <Checkbox
                          checked={!!selected[s.id]}
                          onCheckedChange={(v) => setSelected((sel) => ({ ...sel, [s.id]: !!v }))}
                        />
                      </Td>
                      <Td className="font-medium">{s.name}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5">
                          <CountryFlag value={s.country_code ?? s.country} width={18} />
                          <span className="text-xs font-medium">{(s.country_code ?? "").toUpperCase() || s.country || "—"}</span>
                        </span>
                      </Td>
                      <Td>{s.state ?? "—"}</Td>
                      <Td>{(s as any).city ?? "—"}</Td>
                      <Td>{s.card_type ? <Pill tone="emerald">{s.card_type}</Pill> : "—"}</Td>
                      <Td className="max-w-[160px] truncate" title={s.bank ?? ""}>{s.bank ?? "—"}</Td>
                      <Td>{s.level ?? "—"}</Td>
                      <Td className="font-mono font-semibold">${Number(s.price).toFixed(2)}</Td>
                      <Td>
                        <Button
                          size="sm"
                          onClick={() => addSock(s)}
                          disabled={inCart}
                          className="h-8 w-8 rounded-md bg-emerald-700 p-0 text-white hover:bg-emerald-800"
                          title={inCart ? "In cart" : "Add to cart"}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} pageSize={pageSize} />
        )}
      </section>
    </AppLayout>
  );
};

export const Proxy = () => <SectionPage title="Proxy" Icon={Network} category="proxy" />;
export const Logs = () => <SectionPage title="Logs" Icon={ScrollText} category="logs" />;

/* ---------------- CARDS ---------------- */

const emptyCardFilters = { bin: "", country: "", state: "", base: "", expYear: "", cardType: "", bank: "" };

export const Cards = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const baseFilter = searchParams.get("base") ?? "";
  const { cartItems, cartTotal, addToCart, addManyToCart } = useCommerce();
  const { products, loading } = useProducts("cards");

  const [draft, setDraft] = useState({ ...emptyCardFilters, base: baseFilter });
  const [filters, setFilters] = useState({ ...emptyCardFilters, base: baseFilter });
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [appliedPrice, setAppliedPrice] = useState([0, 500]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const pageSize = 20;

  useEffect(() => {
    if (baseFilter) {
      setDraft((d) => ({ ...d, base: baseFilter }));
      setFilters((f) => ({ ...f, base: baseFilter }));
    }
  }, [baseFilter]);

  const filtered = useMemo(() => {
    const t = (v: string | null, q: string) => (v ?? "").toLowerCase().includes(q.trim().toLowerCase());
    return products.filter((c) => {
      const expYearMatch = !filters.expYear || (c.exp ?? "").includes(filters.expYear.trim());
      return (
        (c.bin ?? "").includes(filters.bin.trim()) &&
        t(c.country, filters.country) &&
        t(c.state, filters.state) &&
        t(c.name, filters.base) &&
        expYearMatch &&
        t(c.card_type, filters.cardType) &&
        t(c.bank, filters.bank) &&
        Number(c.price) >= appliedPrice[0] &&
        Number(c.price) <= appliedPrice[1]
      );
    });
  }, [products, filters, appliedPrice]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const cartIdFor = (id: string) => `cards-${id}`;
  const composeDelivery = (c: Product) => {
    const anyC = c as any;
    const parts: string[] = [];
    if (anyC.full_card) parts.push(`CARD: ${anyC.full_card}`);
    if (c.exp && !anyC.full_card?.includes(c.exp)) parts.push(`EXP: ${c.exp}`);
    if (c.seller) parts.push(`NAME: ${c.seller}`);
    const addr = [anyC.city, c.state, c.zip].filter(Boolean).join(", ");
    if (addr) parts.push(`ADDRESS: ${addr}`);
    if (c.country) parts.push(`COUNTRY: ${c.country}`);
    if (c.bank) parts.push(`BANK: ${c.bank}`);
    if (c.bin) parts.push(`BIN: ${c.bin}`);
    if (c.brand || c.card_type || c.level) parts.push(`TYPE: ${[c.brand, c.card_type, c.level].filter(Boolean).join(" · ")}`);
    if (c.extras) parts.push(c.extras);
    return parts.length ? parts.join(" | ") : undefined;
  };
  const buildItem = (c: Product) => ({
    id: cartIdFor(c.id),
    name: `${c.brand ?? c.scheme ?? "CARD"} ${c.bin ?? ""}`.trim(),
    meta: `${c.country ?? ""} · ${c.bank ?? ""}`,
    price: Number(c.price),
    delivery: composeDelivery(c),
  });

  const addCard = (c: Product) => {
    addToCart(buildItem(c));
    toast.success("Added to cart");
  };

  const addSelected = () => {
    const items = filtered.filter((c) => selected[c.id]).map(buildItem);
    if (!items.length) { toast.error("Nothing selected"); return; }
    addManyToCart(items);
    toast.success(`${items.length} cards added`);
    setSelected({});
  };

  const runSearch = () => { setFilters(draft); setAppliedPrice(priceRange); setPage(1); };

  // Distinct option lists derived from available products
  const opts = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map((v) => (v ?? "").trim()).filter(Boolean))).sort();
    return {
      country: uniq(products.map((p) => p.country)),
      state: uniq(products.map((p) => p.state)),
      base: uniq(products.map((p) => p.name)),
      cardType: uniq(products.map((p) => p.card_type)),
      bank: uniq(products.map((p) => p.bank)),
      expYear: uniq(products.map((p) => (p.exp ?? "").split("/").pop() ?? null)),
    };
  }, [products]);

  return (
    <AppLayout>
      {/* Search panel */}
      <section className="mb-5 rounded-xl border border-border bg-card p-4 md:p-5 animate-fade-up">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          <Field label="Bin"><Input placeholder="xxx,xxx,xxx" value={draft.bin} onChange={(e) => setDraft({ ...draft, bin: e.target.value })} /></Field>
          <Field label="Country"><FilterSelect placeholder="Any country" value={draft.country} options={opts.country} onChange={(v) => setDraft({ ...draft, country: v })} /></Field>
          <Field label="State"><FilterSelect placeholder="Any state" value={draft.state} options={opts.state} onChange={(v) => setDraft({ ...draft, state: v })} /></Field>
          <Field label="Base"><FilterSelect placeholder="Any base" value={draft.base} options={opts.base} onChange={(v) => setDraft({ ...draft, base: v })} /></Field>
          <Field label="Exp Year"><FilterSelect placeholder="Any year" value={draft.expYear} options={opts.expYear} onChange={(v) => setDraft({ ...draft, expYear: v })} /></Field>
          <Field label="Card Type"><FilterSelect placeholder="Any type" value={draft.cardType} options={opts.cardType} onChange={(v) => setDraft({ ...draft, cardType: v })} /></Field>
          <Field label="Bank"><FilterSelect placeholder="Any bank" value={draft.bank} options={opts.bank} onChange={(v) => setDraft({ ...draft, bank: v })} /></Field>
        </div>


        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Price</span>
              <span className="font-mono text-primary">${priceRange[0]} - ${priceRange[1]}</span>
            </div>
            <Slider min={0} max={500} step={1} value={priceRange} onValueChange={setPriceRange} />
          </div>
          <Button onClick={runSearch} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Search className="h-4 w-4" /> Search
          </Button>
        </div>
      </section>

      {/* Results */}
      <section className="rounded-xl border border-border bg-card animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={addSelected} className="bg-emerald-500 text-white hover:bg-emerald-600">
              + Add Cart
            </Button>
            <Button variant="secondary" onClick={() => navigate("/payments")} className="bg-emerald-700 text-white hover:bg-emerald-800">
              <ShoppingCart className="h-4 w-4" /> Checkout · ${cartTotal.toFixed(2)} ({cartItems.length})
            </Button>
          </div>
          <div className="font-mono text-xs text-muted-foreground">{filtered.length} matches</div>
        </div>

        {loading ? (
          <div className="p-10"><Loader /></div>
        ) : !filtered.length ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No cards match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-secondary/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th className="w-10"></Th>
                  <Th>Card Bin</Th>
                  <Th>Full Name</Th>
                  <Th>Country</Th>
                  <Th>City</Th>
                  <Th>State</Th>
                  <Th>Type</Th>
                  <Th>Schema</Th>
                  <Th>Bank</Th>
                  <Th>Level</Th>
                  <Th>Exp Date</Th>
                  <Th>Zipcode</Th>
                  <Th>Base Name</Th>
                  <Th>Price</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c) => {
                  const inCart = cartItems.some((i) => i.id === cartIdFor(c.id));
                  const scheme = (c.scheme ?? c.brand ?? "").toUpperCase();
                  const type = (c.card_type ?? "").toUpperCase();
                  const fullName = c.seller ?? "—";
                  const city = (c as any).city ?? "—";
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-secondary/30">
                      <Td>
                        <Checkbox
                          checked={!!selected[c.id]}
                          onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))}
                        />
                      </Td>
                      <Td className="font-mono text-foreground">{c.bin ? `${c.bin}***` : "—"}</Td>
                      <Td>{fullName}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5">
                          <CountryFlag value={c.country_code ?? c.country} width={18} />
                          <span className="text-xs font-medium">{(c.country_code ?? "").toUpperCase() || c.country || "—"}</span>
                        </span>
                      </Td>
                      <Td>{city}</Td>
                      <Td>{c.state ?? "—"}</Td>
                      <Td>{type ? <Pill tone="muted">{type}</Pill> : "—"}</Td>
                      <Td>{scheme ? <Pill tone="emerald">{scheme}</Pill> : "—"}</Td>
                      <Td className="max-w-[160px] truncate" title={c.bank ?? ""}>{c.bank ?? "—"}</Td>
                      <Td className="max-w-[140px] truncate" title={c.level ?? ""}>{c.level ?? "—"}</Td>
                      <Td className="font-mono">{c.exp ?? "—"}</Td>
                      <Td className="font-mono">{c.zip ?? "—"}</Td>
                      <Td className="max-w-[180px] truncate text-amber-600" title={c.name}>{c.name}</Td>
                      <Td className="font-mono font-semibold">${Number(c.price).toFixed(2)}</Td>
                      <Td>
                        <Button
                          size="sm"
                          onClick={() => addCard(c)}
                          disabled={inCart}
                          className="h-8 w-8 rounded-md bg-emerald-700 p-0 text-white hover:bg-emerald-800"
                          title={inCart ? "In cart" : "Add to cart"}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} pageSize={pageSize} />
        )}
      </section>
    </AppLayout>
  );
};

/* ---------------- RDP ---------------- */

export const RDP = () => {
  const { cartItems, cartTotal, addToCart } = useCommerce();
  const { products, loading } = useProducts("rdp");
  const navigate = useNavigate();

  const [draft, setDraft] = useState({ hostedBy: "", system: "", ram: "", country: "", hdd: "" });
  const [filters, setFilters] = useState({ hostedBy: "", system: "", ram: "", country: "", hdd: "" });
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [appliedPrice, setAppliedPrice] = useState([0, 500]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const t = (v: string | null, q: string) => (v ?? "").toLowerCase().includes(q.trim().toLowerCase());
    return products.filter((p) =>
      t(p.bank, filters.hostedBy) &&
      t(p.brand, filters.system) &&
      t(p.level, filters.ram) &&
      t(p.country, filters.country) &&
      t(p.card_type, filters.hdd) &&
      Number(p.price) >= appliedPrice[0] &&
      Number(p.price) <= appliedPrice[1]
    );
  }, [products, filters, appliedPrice]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const runSearch = () => { setFilters(draft); setAppliedPrice(priceRange); setPage(1); };

  const add = (p: Product) => {
    const ip = (p as any).host_ip as string | null;
    addToCart({ id: `rdp-${p.id}`, name: p.name, meta: `${p.brand ?? ""} · ${p.country ?? ""}`, price: Number(p.price), delivery: ip ? `RDP ${ip} · ${p.brand ?? ""} · ${p.level ?? ""} RAM · ${p.card_type ?? ""}` : undefined });
    toast.success("Added to cart");
  };

  return (
    <AppLayout>
      <section className="mb-5 rounded-xl border border-border bg-card p-4 md:p-5 animate-fade-up">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Hosted By"><Input placeholder="All" value={draft.hostedBy} onChange={(e) => setDraft({ ...draft, hostedBy: e.target.value })} /></Field>
          <Field label="System"><Input placeholder="All" value={draft.system} onChange={(e) => setDraft({ ...draft, system: e.target.value })} /></Field>
          <Field label="Ram"><Input placeholder="All" value={draft.ram} onChange={(e) => setDraft({ ...draft, ram: e.target.value })} /></Field>
          <Field label="Price Range">
            <div className="px-1 pt-2">
              <Slider min={0} max={500} step={1} value={priceRange} onValueChange={setPriceRange} />
              <div className="mt-1 font-mono text-xs text-muted-foreground">${priceRange[0]} - ${priceRange[1]}</div>
            </div>
          </Field>
          <Field label="Country"><Input placeholder="All" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} /></Field>
          <Field label="HDD"><Input placeholder="All" value={draft.hdd} onChange={(e) => setDraft({ ...draft, hdd: e.target.value })} /></Field>
        </div>
        <div className="mt-4">
          <Button onClick={runSearch} className="bg-indigo-900 text-white hover:bg-indigo-800">
            SEARCH
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Show</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-muted-foreground">Entries</span>
          </div>
          <Button variant="secondary" onClick={() => navigate("/payments")}>
            <ShoppingCart className="h-4 w-4" /> ${cartTotal.toFixed(2)} ({cartItems.length})
          </Button>
        </div>

        {loading ? (
          <div className="p-10"><Loader /></div>
        ) : !filtered.length ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No RDPs available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-secondary/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th>Host - IP</Th>
                  <Th>Country</Th>
                  <Th>Hosted By</Th>
                  <Th>System</Th>
                  <Th>RAM</Th>
                  <Th>HDD SIZE</Th>
                  <Th>Price</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/30">
                    <Td className="font-mono">{(p as any).host_ip ? `${String((p as any).host_ip).split(".").slice(0,2).join(".")}.***.***` : "**********"}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs font-medium">{(p.country_code ?? "").toUpperCase() || p.country || "—"}</span>
                        <CountryFlag value={p.country_code ?? p.country} width={18} />
                      </span>
                    </Td>
                    <Td>{p.bank ?? "Unknown"}</Td>
                    <Td className="uppercase">{p.brand ?? "—"}</Td>
                    <Td>{p.level ?? "—"}</Td>
                    <Td>{p.card_type ?? "—"}</Td>
                    <Td className="font-mono font-semibold text-emerald-600">${Number(p.price).toFixed(0)}</Td>
                    <Td>
                      <Button onClick={() => add(p)} className="h-8 rounded-md bg-indigo-900 px-3 text-white hover:bg-indigo-800">
                        <ShoppingCart className="h-3.5 w-3.5" /> CART
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} pageSize={pageSize} />
        )}
      </section>
    </AppLayout>
  );
};

/* ---------------- shared bits ---------------- */

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="mb-1.5 text-xs font-semibold text-foreground/80">{label}</div>
    {children}
  </div>
);

const ANY_VALUE = "__any__";
const FilterSelect = ({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
}) => (
  <Select value={value || ANY_VALUE} onValueChange={(v) => onChange(v === ANY_VALUE ? "" : v)}>
    <SelectTrigger className="h-10"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent className="max-h-72">
      <SelectItem value={ANY_VALUE}>{placeholder}</SelectItem>
      {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
    </SelectContent>
  </Select>
);

const Th = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <th className={`px-3 py-3 ${className}`}>{children}</th>
);

const Td = ({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) => (
  <td className={`px-3 py-3 align-middle ${className}`} title={title}>{children}</td>
);

const Pill = ({ children, tone }: { children: React.ReactNode; tone: "muted" | "emerald" }) => (
  <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
    tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-secondary text-foreground/80"
  }`}>{children}</span>
);

const Pagination = ({ page, totalPages, setPage, total, pageSize }: { page: number; totalPages: number; setPage: (p: number) => void; total: number; pageSize: number }) => (
  <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
    <div className="font-mono text-xs text-muted-foreground">
      {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
    </div>
    <div className="flex items-center gap-1">
      <Button size="sm" variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </Button>
      <span className="rounded-md bg-indigo-900 px-3 py-1 text-xs font-bold text-white">{page}</span>
      <Button size="sm" variant="secondary" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
        Next <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

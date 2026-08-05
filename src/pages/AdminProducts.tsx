import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Edit3, Plus, Power, RefreshCw, Trash2, X, Package, Tag as TagIcon, CreditCard, Network, Wrench, MonitorSmartphone, Zap, ScrollText, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/use-admin";
import { useAppSettings } from "@/hooks/use-app-settings";
import { supabase } from "@/integrations/supabase/client";
import type { Product, ProductCategory } from "@/hooks/use-products";
import { COUNTRIES, findCountry } from "@/lib/countries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryFlag } from "@/components/CountryFlag";
import { syncTelegram, productToUpsert } from "@/lib/site-sync";

const categories: { value: ProductCategory; label: string; Icon: typeof TagIcon }[] = [
  { value: "sales", label: "Sales", Icon: TagIcon },
  { value: "cards", label: "Cards", Icon: CreditCard },
  { value: "proxy", label: "Proxy", Icon: Network },
  { value: "tools", label: "Tools", Icon: Wrench },
  { value: "rdp", label: "RDP", Icon: MonitorSmartphone },
];

const emptyForm = {
  name: "",
  meta: "",
  price: "",
  tag: "",
  sort_order: "0",
  bin: "",
  country: "",
  state: "",
  city: "",
  brand: "",
  card_type: "",
  bank: "",
  seller: "",
  exp: "",
  zip: "",
  valid: "",
  scheme: "",
  level: "",
  country_code: "",
  extras: "",
  image_url: "",
  vendor_id: "",
  full_card: "",
  host_ip: "",
};

type VendorOpt = { id: string; handle: string; name: string };

const AdminProducts = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { settings, salesHidden, setSetting } = useAppSettings();
  const currentMinDeposit = Number(settings.min_deposit ?? 20);
  const [minDepositInput, setMinDepositInput] = useState<string>(String(currentMinDeposit));
  useEffect(() => { setMinDepositInput(String(Number(settings.min_deposit ?? 20))); }, [settings.min_deposit]);
  const [active, setActive] = useState<ProductCategory>("sales");
  const [items, setItems] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("vendors").select("id,handle,name").order("name").then(({ data }) => {
      setVendors((data ?? []) as VendorOpt[]);
    });
  }, []);

  const isCards = active === "cards";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", active)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load products", { description: error.message });
    setItems((data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    setEditingId(null);
    setForm(emptyForm);
  }, [active, isAdmin]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    setSaving(true);
    const payload = {
      category: active,
      name: form.name.trim(),
      meta: form.meta.trim(),
      price,
      tag: form.tag.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      bin: isCards ? form.bin.trim() || null : null,
      country: form.country.trim() || null,
      state: form.state.trim() || null,
      city: (isCards || active === "socks") ? form.city.trim() || null : null,
      brand: form.brand.trim() || null,
      card_type: form.card_type.trim() || null,
      bank: form.bank.trim() || null,
      seller: isCards ? form.seller.trim() || null : null,
      exp: isCards ? form.exp.trim() || null : null,
      zip: isCards ? form.zip.trim() || null : null,
      valid: isCards ? form.valid.trim() || null : null,
      scheme: isCards ? form.scheme.trim() || null : null,
      level: form.level.trim() || null,
      country_code: form.country_code.trim() || null,
      extras: (isCards || active === "socks") ? form.extras.trim() || null : null,
      image_url: form.image_url.trim() || null,
      vendor_id: form.vendor_id || null,
      full_card: isCards ? form.full_card.trim() || null : null,
      host_ip: active === "rdp" ? form.host_ip.trim() || null : null,
    } as any;
    const { data: saved, error } = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId).select("id,category,name,meta,price,bin,is_active").maybeSingle()
      : await supabase.from("products").insert(payload).select("id,category,name,meta,price,bin,is_active").maybeSingle();
    if (error) toast.error("Save failed", { description: error.message });
    else {
      toast.success(editingId ? "Item updated" : "Item published");
      if (saved) syncTelegram(productToUpsert(saved as any));
      reset();
      await load();
    }
    setSaving(false);
  };

  const edit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      meta: p.meta,
      price: String(p.price),
      tag: p.tag ?? "",
      sort_order: String(p.sort_order),
      bin: p.bin ?? "",
      country: p.country ?? "",
      state: p.state ?? "",
      city: (p as any).city ?? "",
      brand: p.brand ?? "",
      card_type: p.card_type ?? "",
      bank: p.bank ?? "",
      seller: p.seller ?? "",
      exp: p.exp ?? "",
      zip: p.zip ?? "",
      valid: p.valid ?? "",
      scheme: p.scheme ?? "",
      level: p.level ?? "",
      country_code: p.country_code ?? "",
      extras: p.extras ?? "",
      image_url: p.image_url ?? "",
      vendor_id: (p as any).vendor_id ?? "",
      full_card: (p as any).full_card ?? "",
      host_ip: (p as any).host_ip ?? "",
    });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("Delete failed", { description: error.message });
    else {
      toast.success("Item removed");
      syncTelegram({ type: "product.delete", data: { external_id: id } });
      if (editingId === id) reset();
      await load();
    }
  };

  const toggle = async (p: Product) => {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast.error("Toggle failed", { description: error.message });
    else {
      toast.success(p.is_active ? "Item hidden" : "Item visible");
      syncTelegram(productToUpsert({ ...p, is_active: !p.is_active }));
      await load();
    }
  };

  const counts = useMemo(() => items.length, [items]);

  if (adminLoading) return <Loader />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-up space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Admin Console</div>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight neon-text md:text-5xl">Inventory</h1>
            <p className="mt-2 text-muted-foreground">Add, edit, hide or remove items shown across the storefront.</p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Site-wide toggles */}
        <section className="glass rounded-xl border border-border p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/40">
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-display text-base font-bold">Hide Sales section</div>
                <p className="text-xs text-muted-foreground">When ON, the Sales page and sidebar link are hidden for regular users. Admins still see it.</p>
              </div>
            </div>
            <Switch checked={salesHidden} onCheckedChange={(checked) => setSetting("sales_hidden", checked)} />
          </div>
        </section>

        {/* Minimum deposit setting */}
        <section className="glass rounded-xl border border-border p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/40">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-display text-base font-bold">Minimum deposit (USD)</div>
                <p className="text-xs text-muted-foreground">Buyers cannot submit a crypto top-up below this amount. Currently <span className="font-mono text-foreground">${currentMinDeposit.toFixed(2)}</span>.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="1"
                value={minDepositInput}
                onChange={(e) => setMinDepositInput(e.target.value)}
                className="h-10 w-28"
              />
              <Button
                onClick={async () => {
                  const value = Math.max(0, Number(minDepositInput) || 0);
                  await setSetting("min_deposit", value);
                  toast.success(`Minimum deposit set to $${value}`);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </section>

        <DashboardEditor />


        <Tabs value={active} onValueChange={(v) => setActive(v as ProductCategory)}>
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-card/60 p-1">
            {categories.map(({ value, label, Icon }) => (
              <TabsTrigger key={value} value={value} className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((c) => {
            const formSection = (
              <section className="glass rounded-xl p-4 md:p-5">

                <form onSubmit={save} className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-2xl font-black tracking-tight">
                      {editingId ? `Edit ${c.label}` : `New ${c.label} item`}
                    </h2>
                    {editingId && (
                      <Button type="button" variant="ghost" size="sm" onClick={reset}>
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <Input placeholder="Price (USD)" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <Textarea placeholder="Meta description / details" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} className="min-h-20" />

                  {/* Vendor selector removed — vendors no longer used in storefront */}


                  <div className="grid gap-3 md:grid-cols-2">
                    <Input placeholder="Tag (e.g. HOT, NEW) — optional" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
                    <Input placeholder="Sort order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                  </div>

                  <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                    <div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">Product image</div>
                    <div className="flex flex-wrap items-center gap-3">
                      {form.image_url && (
                        <img src={form.image_url} alt="preview" className="h-20 w-20 rounded-md border border-border object-cover" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const ext = file.name.split(".").pop() || "png";
                          const path = `${active}/${crypto.randomUUID()}.${ext}`;
                          const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
                          if (upErr) { toast.error("Upload failed", { description: upErr.message }); return; }
                          const { data } = supabase.storage.from("product-images").getPublicUrl(path);
                          setForm((f) => ({ ...f, image_url: data.publicUrl }));
                          if (editingId) {
                            const { error: updErr } = await supabase.from("products").update({ image_url: data.publicUrl }).eq("id", editingId);
                            if (updErr) { toast.error("Could not attach image to product", { description: updErr.message }); return; }
                            await load();
                            toast.success("Image uploaded & attached");
                          } else {
                            toast.success("Image uploaded — click Publish to save the item");
                          }
                        }}
                        className="text-sm text-muted-foreground"
                      />
                      {form.image_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>
                          <X className="h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>
                    <Input placeholder="Or paste image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="mt-2" />
                  </div>

                  {isCards && (
                    <>
                      <BulkCardsPaste onImported={load} defaultVendorId={form.vendor_id} />
                      <div className="grid gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 md:grid-cols-3">
                        <Input placeholder="Base (e.g. Galaxy:25-04)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <Input placeholder="Seller / Full name" value={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.value })} />
                        <Input placeholder="BIN" value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} />
                        <Input placeholder="Exp (e.g. 2/27)" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value })} />
                        <Input placeholder="ZIP" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                        <Input placeholder="Bank" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
                        <Input placeholder="Valid % (e.g. 85%)" value={form.valid} onChange={(e) => setForm({ ...form, valid: e.target.value })} />
                        <Input placeholder="Scheme (e.g. MASTERCARD)" value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value })} />
                        <Input placeholder="Type (e.g. Credit)" value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })} />
                        <Input placeholder="Level (e.g. STANDARD)" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                        <div className="md:col-span-2">
                          <Select
                            value={findCountry(form.country_code)?.code ?? ""}
                            onValueChange={(code) => {
                              const c = COUNTRIES.find((x) => x.code === code);
                              if (c) setForm({ ...form, country: c.name, country_code: c.code });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Country (with real flag)">
                                {form.country_code && (
                                  <span className="inline-flex items-center gap-2">
                                    <CountryFlag value={form.country_code} width={22} />
                                    <span>{form.country || findCountry(form.country_code)?.name}</span>
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {COUNTRIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                  <span className="inline-flex items-center gap-2">
                                    <CountryFlag value={c.code} width={22} />
                                    <span>{c.name}</span>
                                    <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input placeholder="State / region" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                        <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                        <Input placeholder="Full Card (PAN|MM/YY|CVV) — delivered after purchase" value={form.full_card} onChange={(e) => setForm({ ...form, full_card: e.target.value })} className="md:col-span-3 font-mono" />
                      </div>
                    </>
                  )}

                  {active === "rdp" && (
                    <div className="grid gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 md:grid-cols-2">
                      <Input placeholder="Name / Label" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      <Input placeholder="Host - IP (e.g. 192.168.1.10)" value={form.host_ip} onChange={(e) => setForm({ ...form, host_ip: e.target.value })} className="font-mono" />
                      <Input placeholder="Hosted By" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
                      <Input placeholder="System (e.g. Windows 10)" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                      <Input placeholder="RAM (e.g. 8GB)" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                      <Input placeholder="HDD Size (e.g. 500GB SSD)" value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })} />
                      <div className="md:col-span-2">
                        <Select
                          value={findCountry(form.country_code)?.code ?? ""}
                          onValueChange={(code) => { const c = COUNTRIES.find((x) => x.code === code); if (c) setForm({ ...form, country: c.name, country_code: c.code }); }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Country">
                              {form.country_code && (<span className="inline-flex items-center gap-2"><CountryFlag value={form.country_code} width={22} /><span>{form.country}</span></span>)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {COUNTRIES.map((c) => (<SelectItem key={c.code} value={c.code}><span className="inline-flex items-center gap-2"><CountryFlag value={c.code} width={22} /><span>{c.name}</span></span></SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {active === "socks" && (
                    <div className="grid gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 md:grid-cols-2">
                      <Input placeholder="Name / Label" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      <Input placeholder="Type (Residential / Datacenter / Mobile / ISP)" value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })} />
                      <Input placeholder="Provider" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
                      <Input placeholder="Speed (e.g. 1Gbps)" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                      <div className="md:col-span-2">
                        <Select
                          value={findCountry(form.country_code)?.code ?? ""}
                          onValueChange={(code) => { const c = COUNTRIES.find((x) => x.code === code); if (c) setForm({ ...form, country: c.name, country_code: c.code }); }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Country">
                              {form.country_code && (<span className="inline-flex items-center gap-2"><CountryFlag value={form.country_code} width={22} /><span>{form.country}</span></span>)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {COUNTRIES.map((c) => (<SelectItem key={c.code} value={c.code}><span className="inline-flex items-center gap-2"><CountryFlag value={c.code} width={22} /><span>{c.name}</span></span></SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input placeholder="State / region" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                      <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      <Textarea placeholder="Delivery credentials (host:port:user:pass) — delivered on purchase" value={form.extras} onChange={(e) => setForm({ ...form, extras: e.target.value })} className="md:col-span-2 font-mono" />
                    </div>
                  )}



                  <Button type="submit" disabled={saving}>
                    <Plus className="h-4 w-4" /> {saving ? "Saving..." : editingId ? "Save changes" : "Publish item"}
                  </Button>
                </form>
              </section>
            );
            return (
            <TabsContent key={c.value} value={c.value} className="mt-6 space-y-6">
              {!editingId && formSection}


              <section className="space-y-3">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  <Package className="h-4 w-4" /> {counts} items in {c.label}
                </div>
                {loading ? (
                  <Loader />
                ) : !items.length ? (
                  <div className="rounded-lg border border-border bg-card/60 px-5 py-10 text-center text-muted-foreground">
                    Nothing here yet. Add your first item above.
                  </div>
                ) : (
                  items.map((p) => (
                    <Fragment key={p.id}>
                    <article className="grid gap-3 rounded-lg border border-border bg-card/60 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-lg font-bold text-foreground">{p.name}</h3>
                          {p.tag && <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">{p.tag}</span>}
                          {!p.is_active && <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-destructive">Hidden</span>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{p.meta}</p>
                        {isCards && (
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {p.bin && `BIN ${p.bin} · `}{p.brand} {p.card_type} · {p.bank} · {p.country} {p.state}
                          </p>
                        )}
                        <div className="mt-2 font-mono text-sm font-bold text-primary">${Number(p.price).toFixed(2)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Button type="button" variant="secondary" size="sm" onClick={() => edit(p)}><Edit3 className="h-4 w-4" /> {editingId === p.id ? "Editing…" : "Edit"}</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => toggle(p)}><Power className="h-4 w-4" /> {p.is_active ? "Hide" : "Show"}</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
                      </div>
                    </article>
                    {editingId === p.id && (
                      <div className="animate-fade-up ml-0 md:ml-4 border-l-2 border-primary/50 pl-0 md:pl-4">
                        {formSection}
                      </div>
                    )}
                    </Fragment>
                  ))
                )}
              </section>
            </TabsContent>
            );
          })}

        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminProducts;

type Stat = { label: string; value: string; icon: string };
type Panel = { accent?: string; title?: string; body: string };

const DEFAULT_STATS: Stat[] = [
  { label: "Total CVVs", value: "auto:cards", icon: "CreditCard" },
  { label: "Total RDPs", value: "auto:rdp", icon: "MonitorSmartphone" },
  { label: "Total SOCKS", value: "auto:socks", icon: "Zap" },
  { label: "Total LOGS", value: "auto:logs", icon: "ScrollText" },
  { label: "CVV Update Time", value: "Soon", icon: "History" },
];

const DEFAULT_PANELS: Panel[] = [
  { accent: "danger", body: "Always save our main url..." },
  { accent: "danger", body: "Payments possible in < BTC, LTC, DOGE, USDT TRC20 + ERC20, ETH, XMR >" },
  { accent: "info", body: "Refund method for HQ cards: ..." },
];

const ICON_OPTIONS = ["CreditCard","MonitorSmartphone","Zap","ScrollText","History","Database","Server","Network","Shield","Globe","Wrench"];
const ACCENT_OPTIONS = [
  { value: "danger", label: "Red (danger)" },
  { value: "info", label: "Green (info)" },
  { value: "warning", label: "Yellow (warning)" },
];

type Welcome = { enabled: boolean; title: string; body: string; cta_label: string; cta_href: string; accent: string };
const DEFAULT_WELCOME: Welcome = {
  enabled: true,
  title: "Welcome back, agent",
  body: "Fresh bases just dropped. Top up your wallet and grab premium cards before they're gone.",
  cta_label: "Browse Cards",
  cta_href: "/cards",
  accent: "primary",
};

const DashboardEditor = () => {
  const { settings, setSetting } = useAppSettings();
  const initialStats = (Array.isArray(settings.dashboard_stats) ? settings.dashboard_stats : DEFAULT_STATS) as Stat[];
  const initialPanels = (Array.isArray(settings.dashboard_important) ? settings.dashboard_important : DEFAULT_PANELS) as Panel[];
  const initialWelcome = { ...DEFAULT_WELCOME, ...(settings.dashboard_welcome as Partial<Welcome> | undefined ?? {}) };
  const [stats, setStats] = useState<Stat[]>(initialStats);
  const [panels, setPanels] = useState<Panel[]>(initialPanels);
  const [welcome, setWelcome] = useState<Welcome>(initialWelcome);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setStats(initialStats); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(initialStats)]);
  useEffect(() => { setPanels(initialPanels); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(initialPanels)]);
  useEffect(() => { setWelcome(initialWelcome); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(initialWelcome)]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        setSetting("dashboard_stats", stats),
        setSetting("dashboard_important", panels),
        setSetting("dashboard_welcome", welcome),
      ]);
      toast.success("Dashboard updated");
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass space-y-6 rounded-xl border border-border p-4 md:p-5">
      <div className="space-y-3 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-black">Welcome pop-up (on login)</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={welcome.enabled} onCheckedChange={(v) => setWelcome({ ...welcome, enabled: v })} />
            Enabled
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Input placeholder="Title" value={welcome.title} onChange={(e) => setWelcome({ ...welcome, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="CTA label" value={welcome.cta_label} onChange={(e) => setWelcome({ ...welcome, cta_label: e.target.value })} />
            <Input placeholder="CTA link (e.g. /cards)" value={welcome.cta_href} onChange={(e) => setWelcome({ ...welcome, cta_href: e.target.value })} />
          </div>
        </div>
        <Textarea placeholder="Body" value={welcome.body} onChange={(e) => setWelcome({ ...welcome, body: e.target.value })} className="min-h-20" />
        <Select value={welcome.accent} onValueChange={(v) => setWelcome({ ...welcome, accent: v })}>
          <SelectTrigger className="md:w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary (blue)</SelectItem>
            <SelectItem value="accent">Accent</SelectItem>
            <SelectItem value="emerald">Emerald</SelectItem>
            <SelectItem value="rose">Rose</SelectItem>
            <SelectItem value="amber">Amber</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Shows once per browser session on the dashboard.</p>
      </div>

      <div>
        <h2 className="font-display text-xl font-black">Dashboard — Stats row</h2>
        <p className="text-xs text-muted-foreground">Use <code>auto:cards</code>, <code>auto:rdp</code>, <code>auto:socks</code>, <code>auto:proxy</code>, <code>auto:logs</code>, <code>auto:tools</code>, <code>auto:sales</code> as the value to auto-count active products. Otherwise type any text.</p>
      </div>
      <div className="space-y-3">
        {stats.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border bg-secondary/30 p-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <Input placeholder="Label" value={s.label} onChange={(e) => setStats((arr) => arr.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
            <Input placeholder="Value (or auto:cards)" value={s.value} onChange={(e) => setStats((arr) => arr.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
            <Select value={s.icon} onValueChange={(v) => setStats((arr) => arr.map((x, idx) => idx === i ? { ...x, icon: v } : x))}>
              <SelectTrigger><SelectValue placeholder="Icon" /></SelectTrigger>
              <SelectContent>{ICON_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="destructive" size="sm" onClick={() => setStats((arr) => arr.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setStats((arr) => [...arr, { label: "New stat", value: "0", icon: "CreditCard" }])}>
          <Plus className="h-4 w-4" /> Add stat
        </Button>
      </div>

      <div>
        <h2 className="font-display text-xl font-black">Dashboard — Important panels</h2>
        <p className="text-xs text-muted-foreground">Shown on the right column of the homepage.</p>
      </div>
      <div className="space-y-3">
        {panels.map((p, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
              <Input placeholder="Title (optional)" value={p.title ?? ""} onChange={(e) => setPanels((arr) => arr.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} />
              <Select value={p.accent ?? "danger"} onValueChange={(v) => setPanels((arr) => arr.map((x, idx) => idx === i ? { ...x, accent: v } : x))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACCENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="destructive" size="sm" onClick={() => setPanels((arr) => arr.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea placeholder="Body text (supports line breaks)" value={p.body} onChange={(e) => setPanels((arr) => arr.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))} className="min-h-24" />
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setPanels((arr) => [...arr, { accent: "danger", body: "" }])}>
          <Plus className="h-4 w-4" /> Add panel
        </Button>
      </div>

      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save dashboard"}</Button>
    </section>
  );
};

/**
 * Bulk-paste cards in the format:
 * BIN  BRAND  TYPE  LEVEL  BANK  COUNTRY
 * Columns separated by tab, comma, or " | ". One card per line.
 * Header row (BIN/Brand/...) is auto-skipped.
 * Auto-fills mock seller name, city, state, zip, exp, and full PAN|MM/YY|CVV.
 */
const FIRST_NAMES = ["James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Elizabeth","David","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen","Daniel","Nancy","Matthew","Lisa","Christopher","Margaret","Anthony","Sandra","Mark","Ashley"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Wilson","Anderson","Taylor","Thomas","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker"];
const US_LOCATIONS = [
  { city: "New York", state: "NY", zip: "10001" }, { city: "Los Angeles", state: "CA", zip: "90001" },
  { city: "Chicago", state: "IL", zip: "60601" }, { city: "Houston", state: "TX", zip: "77001" },
  { city: "Phoenix", state: "AZ", zip: "85001" }, { city: "Philadelphia", state: "PA", zip: "19101" },
  { city: "San Antonio", state: "TX", zip: "78201" }, { city: "Miami", state: "FL", zip: "33101" },
  { city: "Atlanta", state: "GA", zip: "30301" }, { city: "Boston", state: "MA", zip: "02101" },
  { city: "Seattle", state: "WA", zip: "98101" }, { city: "Denver", state: "CO", zip: "80201" },
  { city: "Dallas", state: "TX", zip: "75201" }, { city: "San Diego", state: "CA", zip: "92101" },
  { city: "Portland", state: "OR", zip: "97201" }, { city: "Nashville", state: "TN", zip: "37201" },
  { city: "Detroit", state: "MI", zip: "48201" }, { city: "Minneapolis", state: "MN", zip: "55401" },
  { city: "Las Vegas", state: "NV", zip: "89101" }, { city: "Orlando", state: "FL", zip: "32801" },
  { city: "Charlotte", state: "NC", zip: "28201" }, { city: "Austin", state: "TX", zip: "73301" },
];
const LOC_BY_CC: Record<string, { city: string; state: string; zip: string }[]> = {
  US: US_LOCATIONS,
  CA: [{ city: "Toronto", state: "ON", zip: "M5H 2N2" }, { city: "Vancouver", state: "BC", zip: "V6B 1A1" }, { city: "Montreal", state: "QC", zip: "H3B 4W5" }, { city: "Calgary", state: "AB", zip: "T2P 1J9" }, { city: "Ottawa", state: "ON", zip: "K1P 5G4" }, { city: "Edmonton", state: "AB", zip: "T5J 3S4" }, { city: "Winnipeg", state: "MB", zip: "R3C 0V8" }],
  GB: [{ city: "London", state: "ENG", zip: "EC1A 1BB" }, { city: "Manchester", state: "ENG", zip: "M1 1AE" }, { city: "Birmingham", state: "ENG", zip: "B1 1AA" }, { city: "Edinburgh", state: "SCT", zip: "EH1 1YZ" }, { city: "Glasgow", state: "SCT", zip: "G1 1XQ" }, { city: "Liverpool", state: "ENG", zip: "L1 8JQ" }, { city: "Bristol", state: "ENG", zip: "BS1 4DJ" }],
  AU: [{ city: "Sydney", state: "NSW", zip: "2000" }, { city: "Melbourne", state: "VIC", zip: "3000" }, { city: "Brisbane", state: "QLD", zip: "4000" }, { city: "Perth", state: "WA", zip: "6000" }, { city: "Adelaide", state: "SA", zip: "5000" }, { city: "Canberra", state: "ACT", zip: "2600" }],
  DE: [{ city: "Berlin", state: "BE", zip: "10115" }, { city: "Munich", state: "BY", zip: "80331" }, { city: "Hamburg", state: "HH", zip: "20095" }, { city: "Frankfurt", state: "HE", zip: "60311" }, { city: "Cologne", state: "NW", zip: "50667" }, { city: "Stuttgart", state: "BW", zip: "70173" }],
  FR: [{ city: "Paris", state: "IDF", zip: "75001" }, { city: "Marseille", state: "PAC", zip: "13001" }, { city: "Lyon", state: "ARA", zip: "69001" }, { city: "Toulouse", state: "OCC", zip: "31000" }, { city: "Nice", state: "PAC", zip: "06000" }, { city: "Bordeaux", state: "NAQ", zip: "33000" }],
  NL: [{ city: "Amsterdam", state: "NH", zip: "1011" }, { city: "Rotterdam", state: "ZH", zip: "3011" }, { city: "The Hague", state: "ZH", zip: "2511" }, { city: "Utrecht", state: "UT", zip: "3511" }, { city: "Eindhoven", state: "NB", zip: "5611" }],
  IT: [{ city: "Rome", state: "RM", zip: "00118" }, { city: "Milan", state: "MI", zip: "20121" }, { city: "Naples", state: "NA", zip: "80121" }, { city: "Turin", state: "TO", zip: "10121" }, { city: "Florence", state: "FI", zip: "50121" }],
  ES: [{ city: "Madrid", state: "MD", zip: "28001" }, { city: "Barcelona", state: "CT", zip: "08001" }, { city: "Valencia", state: "VC", zip: "46001" }, { city: "Seville", state: "AN", zip: "41001" }, { city: "Bilbao", state: "PV", zip: "48001" }],
  PT: [{ city: "Lisbon", state: "LIS", zip: "1000-001" }, { city: "Porto", state: "POR", zip: "4000-001" }, { city: "Braga", state: "BRA", zip: "4700-001" }],
  BE: [{ city: "Brussels", state: "BRU", zip: "1000" }, { city: "Antwerp", state: "ANR", zip: "2000" }, { city: "Ghent", state: "OVL", zip: "9000" }],
  CH: [{ city: "Zurich", state: "ZH", zip: "8001" }, { city: "Geneva", state: "GE", zip: "1201" }, { city: "Basel", state: "BS", zip: "4001" }, { city: "Bern", state: "BE", zip: "3011" }],
  AT: [{ city: "Vienna", state: "W", zip: "1010" }, { city: "Graz", state: "ST", zip: "8010" }, { city: "Salzburg", state: "SB", zip: "5020" }],
  SE: [{ city: "Stockholm", state: "AB", zip: "11122" }, { city: "Gothenburg", state: "O", zip: "41103" }, { city: "Malmö", state: "M", zip: "21120" }],
  NO: [{ city: "Oslo", state: "03", zip: "0154" }, { city: "Bergen", state: "46", zip: "5003" }, { city: "Trondheim", state: "50", zip: "7011" }, { city: "Stavanger", state: "11", zip: "4006" }],
  DK: [{ city: "Copenhagen", state: "84", zip: "1050" }, { city: "Aarhus", state: "82", zip: "8000" }, { city: "Odense", state: "83", zip: "5000" }],
  FI: [{ city: "Helsinki", state: "18", zip: "00100" }, { city: "Tampere", state: "11", zip: "33100" }, { city: "Turku", state: "19", zip: "20100" }],
  IE: [{ city: "Dublin", state: "L", zip: "D01" }, { city: "Cork", state: "M", zip: "T12" }, { city: "Galway", state: "C", zip: "H91" }],
  PL: [{ city: "Warsaw", state: "MZ", zip: "00-001" }, { city: "Kraków", state: "MA", zip: "30-001" }, { city: "Wrocław", state: "DS", zip: "50-001" }, { city: "Gdańsk", state: "PM", zip: "80-001" }],
  CZ: [{ city: "Prague", state: "PR", zip: "110 00" }, { city: "Brno", state: "JM", zip: "602 00" }, { city: "Ostrava", state: "MO", zip: "702 00" }],
  RO: [{ city: "Bucharest", state: "B", zip: "010011" }, { city: "Cluj-Napoca", state: "CJ", zip: "400001" }, { city: "Timișoara", state: "TM", zip: "300001" }],
  GR: [{ city: "Athens", state: "A1", zip: "10431" }, { city: "Thessaloniki", state: "54", zip: "54621" }, { city: "Patras", state: "13", zip: "26221" }],
  TR: [{ city: "Istanbul", state: "34", zip: "34000" }, { city: "Ankara", state: "06", zip: "06000" }, { city: "Izmir", state: "35", zip: "35000" }, { city: "Bursa", state: "16", zip: "16000" }],
  RU: [{ city: "Moscow", state: "MOW", zip: "101000" }, { city: "Saint Petersburg", state: "SPE", zip: "190000" }, { city: "Novosibirsk", state: "NVS", zip: "630000" }],
  UA: [{ city: "Kyiv", state: "30", zip: "01001" }, { city: "Lviv", state: "46", zip: "79000" }, { city: "Odesa", state: "51", zip: "65000" }],
  NZ: [{ city: "Auckland", state: "AUK", zip: "1010" }, { city: "Wellington", state: "WGN", zip: "6011" }, { city: "Christchurch", state: "CAN", zip: "8011" }],
  JP: [{ city: "Tokyo", state: "13", zip: "100-0001" }, { city: "Osaka", state: "27", zip: "530-0001" }, { city: "Kyoto", state: "26", zip: "600-8001" }, { city: "Yokohama", state: "14", zip: "220-0001" }, { city: "Nagoya", state: "23", zip: "460-0001" }],
  KR: [{ city: "Seoul", state: "11", zip: "04524" }, { city: "Busan", state: "26", zip: "48058" }, { city: "Incheon", state: "28", zip: "22332" }],
  CN: [{ city: "Beijing", state: "BJ", zip: "100000" }, { city: "Shanghai", state: "SH", zip: "200000" }, { city: "Guangzhou", state: "GD", zip: "510000" }, { city: "Shenzhen", state: "GD", zip: "518000" }, { city: "Chengdu", state: "SC", zip: "610000" }, { city: "Hangzhou", state: "ZJ", zip: "310000" }],
  HK: [{ city: "Central", state: "HK", zip: "000" }, { city: "Kowloon", state: "KL", zip: "000" }, { city: "Tsim Sha Tsui", state: "KL", zip: "000" }],
  SG: [{ city: "Singapore", state: "SG", zip: "018956" }, { city: "Jurong", state: "SG", zip: "600101" }, { city: "Tampines", state: "SG", zip: "520201" }],
  MY: [{ city: "Kuala Lumpur", state: "14", zip: "50000" }, { city: "George Town", state: "07", zip: "10000" }, { city: "Johor Bahru", state: "01", zip: "80000" }],
  TH: [{ city: "Bangkok", state: "10", zip: "10100" }, { city: "Chiang Mai", state: "50", zip: "50000" }, { city: "Phuket", state: "83", zip: "83000" }],
  VN: [{ city: "Ho Chi Minh City", state: "SG", zip: "70000" }, { city: "Hanoi", state: "HN", zip: "10000" }, { city: "Da Nang", state: "DN", zip: "50000" }],
  PH: [{ city: "Manila", state: "MNL", zip: "1000" }, { city: "Cebu City", state: "CEB", zip: "6000" }, { city: "Davao", state: "DAV", zip: "8000" }],
  ID: [{ city: "Jakarta", state: "JK", zip: "10110" }, { city: "Surabaya", state: "JI", zip: "60111" }, { city: "Bandung", state: "JB", zip: "40111" }],
  IN: [{ city: "Mumbai", state: "MH", zip: "400001" }, { city: "Delhi", state: "DL", zip: "110001" }, { city: "Bengaluru", state: "KA", zip: "560001" }, { city: "Chennai", state: "TN", zip: "600001" }, { city: "Kolkata", state: "WB", zip: "700001" }, { city: "Hyderabad", state: "TG", zip: "500001" }],
  PK: [{ city: "Karachi", state: "SD", zip: "74000" }, { city: "Lahore", state: "PB", zip: "54000" }, { city: "Islamabad", state: "IS", zip: "44000" }],
  AE: [{ city: "Dubai", state: "DU", zip: "00000" }, { city: "Abu Dhabi", state: "AZ", zip: "00000" }, { city: "Sharjah", state: "SH", zip: "00000" }],
  SA: [{ city: "Riyadh", state: "01", zip: "11564" }, { city: "Jeddah", state: "02", zip: "21577" }, { city: "Mecca", state: "02", zip: "24231" }],
  IL: [{ city: "Tel Aviv", state: "TA", zip: "6100000" }, { city: "Jerusalem", state: "JM", zip: "9100000" }, { city: "Haifa", state: "HA", zip: "3100000" }],
  ZA: [{ city: "Johannesburg", state: "GP", zip: "2000" }, { city: "Cape Town", state: "WC", zip: "8001" }, { city: "Durban", state: "KZN", zip: "4001" }],
  NG: [{ city: "Lagos", state: "LA", zip: "100001" }, { city: "Abuja", state: "FC", zip: "900001" }, { city: "Kano", state: "KN", zip: "700001" }, { city: "Ibadan", state: "OY", zip: "200001" }],
  EG: [{ city: "Cairo", state: "C", zip: "11511" }, { city: "Alexandria", state: "ALX", zip: "21500" }, { city: "Giza", state: "GZ", zip: "12511" }],
  KE: [{ city: "Nairobi", state: "30", zip: "00100" }, { city: "Mombasa", state: "28", zip: "80100" }, { city: "Kisumu", state: "09", zip: "40100" }],
  MA: [{ city: "Casablanca", state: "06", zip: "20000" }, { city: "Rabat", state: "07", zip: "10000" }, { city: "Marrakech", state: "39", zip: "40000" }],
  MX: [{ city: "Mexico City", state: "CMX", zip: "01000" }, { city: "Guadalajara", state: "JAL", zip: "44100" }, { city: "Monterrey", state: "NLE", zip: "64000" }, { city: "Puebla", state: "PUE", zip: "72000" }, { city: "Tijuana", state: "BCN", zip: "22000" }],
  BR: [{ city: "São Paulo", state: "SP", zip: "01000-000" }, { city: "Rio de Janeiro", state: "RJ", zip: "20000-000" }, { city: "Brasília", state: "DF", zip: "70000-000" }, { city: "Salvador", state: "BA", zip: "40000-000" }, { city: "Fortaleza", state: "CE", zip: "60000-000" }],
  AR: [{ city: "Buenos Aires", state: "C", zip: "C1000" }, { city: "Córdoba", state: "X", zip: "X5000" }, { city: "Rosario", state: "S", zip: "S2000" }],
  CL: [{ city: "Santiago", state: "RM", zip: "8320000" }, { city: "Valparaíso", state: "VS", zip: "2340000" }, { city: "Concepción", state: "BI", zip: "4030000" }],
  CO: [{ city: "Bogotá", state: "DC", zip: "110111" }, { city: "Medellín", state: "ANT", zip: "050001" }, { city: "Cali", state: "VAC", zip: "760001" }, { city: "Barranquilla", state: "ATL", zip: "080001" }],
  PE: [{ city: "Lima", state: "LIM", zip: "15001" }, { city: "Arequipa", state: "ARE", zip: "04001" }, { city: "Trujillo", state: "LAL", zip: "13001" }],
  VE: [{ city: "Caracas", state: "DC", zip: "1010" }, { city: "Maracaibo", state: "ZUL", zip: "4001" }, { city: "Valencia", state: "CAR", zip: "2001" }],
  CM: [{ city: "Douala", state: "LT", zip: "00237" }, { city: "Yaoundé", state: "CE", zip: "00237" }, { city: "Bamenda", state: "NW", zip: "00237" }],
};
const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];
const seedFromString = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

const brandFromBin = (bin: string): string => {
  const d1 = bin[0];
  const d2 = bin.slice(0, 2);
  const d4 = parseInt(bin.slice(0, 4) || "0", 10);
  if (d1 === "4") return "VISA";
  if (["51","52","53","54","55"].includes(d2)) return "MASTERCARD";
  if (d4 >= 2221 && d4 <= 2720) return "MASTERCARD";
  if (d2 === "34" || d2 === "37") return "AMEX";
  if (d2 === "60" || d2 === "62" || d2 === "64" || d2 === "65") return "DISCOVER";
  if (d2 === "35") return "JCB";
  if (d2 === "36" || d2 === "30" || d2 === "38") return "DINERS";
  return "";
};

const BANK_COUNTRY: { kw: string; cc: string }[] = [
  ...["SUTTON","CHASE","JPMORGAN","WELLS FARGO","BANK OF AMERICA","BOFA","CAPITAL ONE","CITI","CITIBANK","US BANK","USBANK","PNC","NAVY FEDERAL","USAA","DISCOVER","AMERICAN EXPRESS","AMEX","REGIONS","FIFTH THIRD","HUNTINGTON","KEYBANK","BB&T","TRUIST","SYNCHRONY","GOLDMAN","METABANK","GREEN DOT","COMERICA","M&T","CITIZENS","ALLY","SOFI","VARO","CHIME","MERCURY","BREX"].map(kw => ({ kw, cc: "US" })),
  ...["BARCLAYS","LLOYDS","HSBC","NATWEST","MONZO","STARLING","HALIFAX","NATIONWIDE","SANTANDER UK","REVOLUT","TSB","METRO BANK","VIRGIN MONEY","CO-OPERATIVE","COOPERATIVE","CLYDESDALE","YORKSHIRE","FIRST DIRECT","ROYAL BANK OF SCOTLAND","RBS","BRITISH","UNITED KINGDOM"].map(kw => ({ kw, cc: "GB" })),
  ...["ROYAL BANK OF CANADA","RBC","TD CANADA","SCOTIABANK","BMO","CIBC","DESJARDINS","TANGERINE","CANADA","CANADIAN"].map(kw => ({ kw, cc: "CA" })),
  ...["COMMONWEALTH","WESTPAC","ANZ","NAB","BENDIGO","MACQUARIE","AUSTRALIA","AUSTRALIAN"].map(kw => ({ kw, cc: "AU" })),
  ...["DEUTSCHE","COMMERZBANK","SPARKASSE","POSTBANK","N26","DKB","DZ BANK","GERMANY","GERMAN"].map(kw => ({ kw, cc: "DE" })),
  ...["BNP PARIBAS","CREDIT AGRICOLE","SOCIETE GENERALE","LA BANQUE POSTALE","CREDIT MUTUEL","BPCE","FRANCE"].map(kw => ({ kw, cc: "FR" })),
  ...["ING","ABN AMRO","RABOBANK","BUNQ","SNS BANK","NETHERLANDS","DUTCH"].map(kw => ({ kw, cc: "NL" })),
  ...["INTESA","UNICREDIT","MONTE DEI PASCHI","BANCA","ITALY","ITALIAN"].map(kw => ({ kw, cc: "IT" })),
  ...["BBVA","CAIXA","BANKINTER","SABADELL","SPAIN","SPANISH"].map(kw => ({ kw, cc: "ES" })),
];

// Expanded issuer BIN prefixes → country (fallback when bank text is ambiguous).
const BIN_COUNTRY: { prefix: string; cc: string }[] = [
  ...["4462","4543","4658","4751","4929","5301","5355","5404","5413","5522","5641","5648","4659","4744","4745","4917","5187","5232","5432"].map(p => ({ prefix: p, cc: "GB" })),
  ...["4506","4520","4530","4536","4540","4560","4590","5191","5254","5490","4519","4724","4779","5162","5223","5241","5568"].map(p => ({ prefix: p, cc: "CA" })),
  ...["4557","4564","4921","5163","5313","5610","4072","4325","4362","4529","5218","5581"].map(p => ({ prefix: p, cc: "AU" })),
  ...["4104","4547","5453","5544","4176","4306","4319","4324","4568","5100","5170","5265","5390","5406"].map(p => ({ prefix: p, cc: "DE" })),
  ...["4970","4974","4978","5131","4972","4973","4976","4977","5132","5133","5134","5171"].map(p => ({ prefix: p, cc: "FR" })),
  ...["4032","4988","4034","4842","4844","5299","5405"].map(p => ({ prefix: p, cc: "NL" })),
  ...["4023","4517","5333","4024","4025","4523","4599","5334","5401"].map(p => ({ prefix: p, cc: "IT" })),
  ...["4548","4930","5480","4915","5140","5474","5482"].map(p => ({ prefix: p, cc: "ES" })),
  ...["4147","4266","4485","4532","4716","5200","5300","5400","5500","6011","3400","3700"].map(p => ({ prefix: p, cc: "US" })),
];

const COUNTRY_ALIASES: Record<string, string> = {
  UK: "GB", "U.K.": "GB", "UNITED KINGDOM": "GB", ENGLAND: "GB", BRITAIN: "GB", "GREAT BRITAIN": "GB", SCOTLAND: "GB", WALES: "GB", GB: "GB", GBR: "GB",
  USA: "US", "U.S.": "US", "U.S.A.": "US", "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US", AMERICA: "US", US: "US",
  CANADA: "CA", CAN: "CA", CA: "CA",
  AUSTRALIA: "AU", AUS: "AU", AU: "AU",
  GERMANY: "DE", DEUTSCHLAND: "DE", GER: "DE", DEU: "DE", DE: "DE",
  FRANCE: "FR", FRA: "FR", FR: "FR",
  NETHERLANDS: "NL", HOLLAND: "NL", NLD: "NL", NL: "NL",
  ITALY: "IT", ITA: "IT", IT: "IT",
  SPAIN: "ES", ESP: "ES", ES: "ES",
  JAPAN: "JP", JPN: "JP", JP: "JP",
  BRAZIL: "BR", BRA: "BR", BR: "BR",
  MEXICO: "MX", MEX: "MX", MX: "MX",
  IRELAND: "IE", IRL: "IE", IE: "IE",
  BELGIUM: "BE", BEL: "BE", BE: "BE",
  SWITZERLAND: "CH", CHE: "CH", CH: "CH",
  AUSTRIA: "AT", AUT: "AT", AT: "AT",
  SWEDEN: "SE", SWE: "SE", SE: "SE",
  NORWAY: "NO", NOR: "NO", NO: "NO",
  DENMARK: "DK", DNK: "DK", DK: "DK",
  POLAND: "PL", POL: "PL", PL: "PL",
  CAMEROON: "CM", CMR: "CM", CM: "CM",
  COLOMBIA: "CO", COL: "CO", CO: "CO",
  ARGENTINA: "AR", ARG: "AR", AR: "AR",
  CHILE: "CL", CHL: "CL", CL: "CL",
  PERU: "PE", PER: "PE", PE: "PE",
  VENEZUELA: "VE", VEN: "VE", VE: "VE",
  NIGERIA: "NG", NGA: "NG", NG: "NG",
  "SOUTH AFRICA": "ZA", ZAF: "ZA", ZA: "ZA",
  KENYA: "KE", KEN: "KE", KE: "KE",
  INDIA: "IN", IND: "IN", IN: "IN",
  CHINA: "CN", CHN: "CN", CN: "CN",
  "HONG KONG": "HK", HKG: "HK", HK: "HK",
  SINGAPORE: "SG", SGP: "SG", SG: "SG",
  PHILIPPINES: "PH", PHL: "PH", PH: "PH",
  THAILAND: "TH", THA: "TH", TH: "TH",
  INDONESIA: "ID", IDN: "ID", ID: "ID",
  MALAYSIA: "MY", MYS: "MY", MY: "MY",
  VIETNAM: "VN", VNM: "VN", VN: "VN",
  TURKEY: "TR", TUR: "TR", TR: "TR",
  RUSSIA: "RU", RUS: "RU", RU: "RU",
  UKRAINE: "UA", UKR: "UA", UA: "UA",
  ROMANIA: "RO", ROU: "RO", RO: "RO",
  PORTUGAL: "PT", PRT: "PT", PT: "PT",
  GREECE: "GR", GRC: "GR", GR: "GR",
  "NEW ZEALAND": "NZ", NZL: "NZ", NZ: "NZ",
  "UNITED ARAB EMIRATES": "AE", UAE: "AE", ARE: "AE", AE: "AE",
  "SAUDI ARABIA": "SA", SAU: "SA", SA: "SA",
  ISRAEL: "IL", ISR: "IL", IL: "IL",
  EGYPT: "EG", EGY: "EG", EG: "EG",
  MOROCCO: "MA", MAR: "MA", MA: "MA",
  GEORGIA: "GE", GEO: "GE", GE: "GE",
  BELARUS: "BY", BLR: "BY", BY: "BY",
  PAKISTAN: "PK", PAK: "PK", PK: "PK",
};

const resolveCountry = (raw: string) => {
  if (!raw) return undefined;
  const t = raw.trim().toUpperCase();
  if (!t) return undefined;
  const alias = COUNTRY_ALIASES[t];
  if (alias) return findCountry(alias);
  const direct = findCountry(t) || findCountry(t.slice(0, 2));
  if (direct) return direct;
  const hit = COUNTRIES.find((c) => t.includes(c.name.toUpperCase()));
  if (hit) return hit;
  return undefined;
};

const countryFromContext = (country: string, bank: string, bin: string) => {
  // Trust the pasted country column first — never override it with bank/BIN guesses.
  const direct = resolveCountry(country);
  if (direct) return direct;
  const b = ` ${(bank || "").toUpperCase()} `;
  const hit = BANK_COUNTRY.find((x) => b.includes(` ${x.kw} `) || b.includes(x.kw));
  if (hit) return findCountry(hit.cc);
  for (const len of [6, 5, 4]) {
    const p = bin.slice(0, len);
    const binHit = BIN_COUNTRY.find((x) => x.prefix === p);
    if (binHit) return findCountry(binHit.cc);
  }
  return undefined;
};


// Full realistic name — no masking (delivered as full cardholder identity).
const fullName = (seed: number) => `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed >> 3)}`;

const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me"];

// Country dial codes + local number lengths for realistic phone generation.
const PHONE_FMT: Record<string, { dial: string; len: number }> = {
  US: { dial: "+1", len: 10 }, CA: { dial: "+1", len: 10 }, GB: { dial: "+44", len: 10 },
  DE: { dial: "+49", len: 10 }, FR: { dial: "+33", len: 9 }, NL: { dial: "+31", len: 9 },
  ES: { dial: "+34", len: 9 }, IT: { dial: "+39", len: 10 }, PT: { dial: "+351", len: 9 },
  BE: { dial: "+32", len: 9 }, CH: { dial: "+41", len: 9 }, AT: { dial: "+43", len: 10 },
  SE: { dial: "+46", len: 9 }, NO: { dial: "+47", len: 8 }, DK: { dial: "+45", len: 8 },
  FI: { dial: "+358", len: 9 }, IE: { dial: "+353", len: 9 }, PL: { dial: "+48", len: 9 },
  CZ: { dial: "+420", len: 9 }, RO: { dial: "+40", len: 9 }, GR: { dial: "+30", len: 10 },
  TR: { dial: "+90", len: 10 }, RU: { dial: "+7", len: 10 }, UA: { dial: "+380", len: 9 },
  AU: { dial: "+61", len: 9 }, NZ: { dial: "+64", len: 9 }, JP: { dial: "+81", len: 10 },
  KR: { dial: "+82", len: 10 }, CN: { dial: "+86", len: 11 }, HK: { dial: "+852", len: 8 },
  SG: { dial: "+65", len: 8 }, MY: { dial: "+60", len: 9 }, TH: { dial: "+66", len: 9 },
  VN: { dial: "+84", len: 9 }, PH: { dial: "+63", len: 10 }, ID: { dial: "+62", len: 10 },
  IN: { dial: "+91", len: 10 }, PK: { dial: "+92", len: 10 }, AE: { dial: "+971", len: 9 },
  SA: { dial: "+966", len: 9 }, IL: { dial: "+972", len: 9 }, ZA: { dial: "+27", len: 9 },
  NG: { dial: "+234", len: 10 }, EG: { dial: "+20", len: 10 }, KE: { dial: "+254", len: 9 },
  MA: { dial: "+212", len: 9 }, MX: { dial: "+52", len: 10 }, BR: { dial: "+55", len: 11 },
  AR: { dial: "+54", len: 10 }, CL: { dial: "+56", len: 9 }, CO: { dial: "+57", len: 10 },
  PE: { dial: "+51", len: 9 }, VE: { dial: "+58", len: 10 }, CM: { dial: "+237", len: 9 },
};

const mockCardDetails = (bin: string, cc: string | null, rowIdx: number) => {
  const seed = seedFromString(`${bin}:${cc ?? ""}:${rowIdx}:${Math.random().toString(36).slice(2, 10)}`);
  const locs = LOC_BY_CC[cc ?? ""] ?? LOC_BY_CC[cc ?? "US"] ?? US_LOCATIONS;
  const loc = pick(locs, seed >> 5);
  const month = String(((Math.abs(seed) % 12) + 1)).padStart(2, "0");
  const year = String(26 + (Math.abs(seed >> 7) % 4));
  const trailing = String(Math.floor(1000000000 + Math.abs(seed * 2654435761) % 9000000000)).slice(0, 10);
  const pan = (bin + trailing).slice(0, 16);
  const cvv = String(100 + (Math.abs(seed >> 11) % 900));
  const first = pick(FIRST_NAMES, seed);
  const last = pick(LAST_NAMES, seed >> 3);
  const name = `${first} ${last}`;
  const domain = pick(EMAIL_DOMAINS, seed >> 13);
  const emailNum = String(Math.abs(seed >> 9) % 900 + 10);
  const email = `${first}.${last}${emailNum}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + `@${domain}`;
  const fmt = PHONE_FMT[cc ?? "US"] ?? PHONE_FMT.US;
  const phoneDigits = String(Math.abs(seed * 1103515245 + 12345))
    .padStart(fmt.len, "0")
    .slice(-fmt.len)
    .replace(/^0/, "9");
  const phone = `${fmt.dial} ${phoneDigits}`;
  return {
    name,
    email,
    phone,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
    exp: `${month}/${year}`,
    full_card: `${pan}|${month}/${year}|${cvv}`,
  };
};




const BulkCardsPaste = ({ onImported, defaultVendorId }: { onImported: () => Promise<void> | void; defaultVendorId?: string }) => {
  const [raw, setRaw] = useState("");
  const [base, setBase] = useState("");
  const [price, setPrice] = useState("20");
  const [busy, setBusy] = useState(false);

  const parse = (text: string) => {
    const rawLines = text.split(/\r?\n/).map((l) => l.trim());
    const lines = rawLines.filter(Boolean);
    const rows: { bin: string; brand: string; card_type: string; level: string; bank: string; country: string }[] = [];
    if (!lines.length) return rows;

    // Detect format: if at least one line has an inline delimiter (tab, |, comma, or 2+ spaces)
    // AND starts with a BIN, treat it as one-card-per-line. Otherwise treat as field-per-line.
    const hasInlineDelim = lines.some((l) => /^\d{4,}/.test(l) && /(\t|\s\|\s|,|\s{2,})/.test(l));

    if (hasInlineDelim) {
      for (const line of lines) {
        if (/^bin\b/i.test(line) && /brand|type|bank|country/i.test(line)) continue;
        const parts = line.split(/\t|\s*\|\s*|,\s*|\s{2,}/).map((p) => p.trim()).filter(Boolean);
        if (!parts.length) continue;
        const [bin, brand = "", card_type = "", level = "", bank = "", country = ""] = parts;
        if (!/^\d{4,}/.test(bin)) continue;
        rows.push({ bin: bin.replace(/\D/g, "").slice(0, 6), brand, card_type, level, bank, country });
      }
      return rows;
    }

    // Field-per-line mode: walk through tokens, whenever we hit a BIN start a 6-field record.
    // Order expected: BIN, BRAND, TYPE, LEVEL, BANK, COUNTRY. Missing tail fields tolerated.
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^bin$/i.test(l)) { i++; continue; }
      if (!/^\d{4,}$/.test(l.replace(/\s+/g, ""))) { i++; continue; }
      const bin = l.replace(/\D/g, "").slice(0, 6);
      const fields: string[] = [];
      let j = i + 1;
      while (j < lines.length && fields.length < 5 && !/^\d{4,}$/.test(lines[j].replace(/\s+/g, ""))) {
        fields.push(lines[j]);
        j++;
      }
      const [brand = "", card_type = "", level = "", bank = "", country = ""] = fields;
      rows.push({ bin, brand, card_type, level, bank, country });
      i = j;
    }
    return rows;
  };

  const preview = useMemo(() => parse(raw), [raw]);

  const importNow = async () => {
    if (!preview.length) { toast.error("Nothing to import"); return; }
    const priceN = Number(price);
    if (!Number.isFinite(priceN) || priceN < 0) { toast.error("Enter a valid default price"); return; }
    setBusy(true);
    const payload = preview.map((r, idx) => {
      const brand = (r.brand || brandFromBin(r.bin) || "VISA").toUpperCase();
      const card_type = (r.card_type || "CREDIT").toUpperCase();
      const level = (r.level || "CLASSIC").toUpperCase();
      const bank = (r.bank || "UNKNOWN BANK").toUpperCase();
      const c = countryFromContext(r.country, bank, r.bin);
      const mock = mockCardDetails(r.bin, c?.code ?? null, idx);
      return {
        category: "cards" as const,
        name: base.trim() || `Base ${new Date().toISOString().slice(0, 10)}`,
        meta: "",
        price: priceN,
        bin: r.bin,
        brand,
        scheme: brand,
        card_type,
        level,
        bank,
        country: c?.name ?? (r.country ? r.country.trim() : ""),
        country_code: c?.code ?? "",
        vendor_id: defaultVendorId || null,
        seller: mock.name,
        city: mock.city,
        state: mock.state,
        zip: mock.zip,
        exp: mock.exp,
        valid: "85%",
        full_card: mock.full_card,
        extras: `EMAIL: ${mock.email} | PHONE: ${mock.phone}`,
      } as any;
    });
    const { data: inserted, error } = await supabase.from("products").insert(payload).select("id,category,name,meta,price,bin,is_active");
    setBusy(false);
    if (error) { toast.error("Bulk import failed", { description: error.message }); return; }
    toast.success(`Imported ${payload.length} cards — brand, country & flag auto-detected`);
    if (inserted?.length) syncTelegram(inserted.map((p: any) => productToUpsert(p)));
    setRaw("");
    await onImported();
  };


  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="font-display text-sm font-bold">Bulk paste cards</div>
          <div className="text-[11px] text-muted-foreground">
            Paste anything from just <code>BIN</code> to <code>BIN BRAND TYPE LEVEL BANK COUNTRY</code>. Missing fields (brand, country, flag, city, state, zip, name, exp, full PAN) are auto-detected & filled.
          </div>

        </div>
        <span className="rounded-full bg-primary/20 px-2 py-0.5 font-mono text-[10px] text-primary">{preview.length} parsed</span>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_140px]">
        <Input placeholder="Base name (applied to all rows)" value={base} onChange={(e) => setBase(e.target.value)} />
        <Input placeholder="Price USD" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={"440393\tVISA\tDEBIT\tPREPAID CLASSIC\tSUTTON BANK\tUNITED STATES"}
        className="mt-2 min-h-32 font-mono text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={importNow} disabled={busy || !preview.length}>
          <Plus className="h-4 w-4" /> {busy ? "Importing..." : `Import ${preview.length} cards`}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRaw("")} disabled={!raw}>Clear</Button>
      </div>
    </div>
  );
};



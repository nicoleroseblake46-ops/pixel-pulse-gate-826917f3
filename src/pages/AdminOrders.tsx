import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { RefreshCw, ShoppingBag, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { toast } from "sonner";

const client = supabase as any;

type Order = {
  id: string;
  user_id: string;
  cart_total: number;
  coin: string;
  status: string;
  created_at: string;
  metadata: any;
};

type Profile = { id: string; username: string | null };

const getCartItems = (metadata: any): any[] => {
  if (!metadata || typeof metadata !== "object") return [];
  const items = metadata.cart_items;
  return Array.isArray(items) ? items : [];
};

const AdminOrders = () => {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [topUp, setTopUp] = useState<{ id: string; username: string } | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await client
      .from("payments")
      .select("id,user_id,cart_total,coin,status,created_at,metadata")
      .eq("status", "confirmed")
      .gt("cart_total", 0)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) { toast.error("Load failed", { description: error.message }); setLoading(false); return; }
    const ids = [...new Set((data ?? []).map((o: Order) => o.user_id))];
    if (ids.length) {
      const { data: profs } = await client.from("profiles").select("id, username").in("id", ids);
      setProfiles(Object.fromEntries((profs ?? []).map((p: Profile) => [p.id, p])));
    }
    setOrders((data ?? []) as Order[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const flat = useMemo(() => {
    const query = q.trim().toLowerCase();
    return orders.flatMap((o) => {
      const items = getCartItems(o.metadata);
      return items.map((it: any, idx: number) => ({
        key: `${o.id}-${idx}`,
        index: idx,
        orderId: o.id,
        userId: o.user_id,
        username: profiles[o.user_id]?.username ?? "Unknown",
        createdAt: o.created_at,
        name: String(it?.name ?? "Item"),
        meta: String(it?.meta ?? ""),
        price: Number(it?.price ?? 0),
        delivery: it?.delivery ? String(it.delivery) : "",
        itemId: String(it?.id ?? ""),
      }));
    }).filter((r) =>
      !query ||
      r.username.toLowerCase().includes(query) ||
      r.name.toLowerCase().includes(query) ||
      r.itemId.toLowerCase().includes(query) ||
      r.orderId.toLowerCase().includes(query)
    );
  }, [orders, profiles, q]);

  const totalRevenue = useMemo(
    () => orders.reduce((s, o) => s + Number(o.cart_total || 0), 0),
    [orders]
  );

  const saveDelivery = async (orderId: string, index: number) => {
    setBusy(true);
    const { error } = await client.rpc("admin_set_order_delivery", {
      _payment_id: orderId, _item_index: index, _delivery: editValue,
    });
    if (error) toast.error("Could not save", { description: error.message });
    else { toast.success("Delivery updated"); setEditKey(null); await load(); }
    setBusy(false);
  };

  const addMoney = async () => {
    if (!topUp) return;
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount === 0) return toast.error("Enter a non-zero amount");
    setBusy(true);
    const { data, error } = await client.rpc("admin_adjust_balance", {
      _user_id: topUp.id, _amount: amount, _note: "Admin top-up from purchases",
    });
    if (error) toast.error("Failed", { description: error.message });
    else {
      toast.success("Balance updated", { description: `New balance: $${Number(data).toFixed(2)}` });
      setTopUp(null); setTopUpAmount("");
    }
    setBusy(false);
  };

  if (adminLoading) return <Loader />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-up space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Admin Console</div>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight md:text-5xl">Client Purchases</h1>
            <p className="mt-2 text-muted-foreground">Every item every user has bought, with delivery details.</p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Orders" value={orders.length} />
          <Stat label="Items sold" value={flat.length} />
          <Stat label="Revenue" value={`$${totalRevenue.toFixed(2)}`} />
        </div>

        {topUp && (
          <section className="rounded-xl border border-primary/40 bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Add money</div>
            <div className="mt-1 font-display text-xl font-black">{topUp.username}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                type="number" step="0.01" placeholder="Amount $" value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)} className="max-w-[160px] font-mono"
              />
              <Button disabled={busy} onClick={addMoney}>{busy ? "Adding..." : "Add to balance"}</Button>
              <Button variant="ghost" onClick={() => { setTopUp(null); setTopUpAmount(""); }}>Cancel</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Use a negative amount to deduct. Credited instantly.</p>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by user, item, or order ID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {loading ? <Loader /> : !flat.length ? (
            <div className="py-10 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No matching purchases.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="min-w-[300px]">Delivery</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flat.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>
                        <div className="font-medium">{r.username}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{r.userId.slice(0, 8)}</div>
                        <Button size="sm" variant="ghost" className="mt-1 h-6 px-2 text-[11px]"
                          onClick={() => { setTopUp({ id: r.userId, username: r.username }); setTopUpAmount(""); }}>
                          Add money
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.meta}</div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-primary">${r.price.toFixed(2)}</TableCell>
                      <TableCell>
                        {editKey === r.key ? (
                          <div className="space-y-2">
                            <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="min-h-[90px] font-mono text-[11px]" />
                            <div className="flex gap-2">
                              <Button size="sm" disabled={busy} onClick={() => saveDelivery(r.orderId, r.index)}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditKey(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {r.delivery ? (
                              <code className="block max-w-[400px] whitespace-pre-wrap break-words rounded border border-border bg-secondary/40 px-2 py-1 font-mono text-[11px]">
                                {r.delivery}
                              </code>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                              onClick={() => { setEditKey(r.key); setEditValue(r.delivery); }}>
                              Edit delivery
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[10px]">#{r.orderId.slice(0, 8)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="mt-1 font-display text-3xl font-black text-primary">{value}</div>
  </div>
);

export default AdminOrders;

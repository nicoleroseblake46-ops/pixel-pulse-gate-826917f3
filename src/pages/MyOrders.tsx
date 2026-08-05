import { useEffect, useMemo, useState } from "react";
import { Clock, PackageCheck, PackageX, ShoppingBag, Copy, Undo2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";

interface DeliveredItem {
  id: string;
  name: string;
  meta: string;
  price: number;
  delivery?: string;
  orderId: string;
  orderedAt: string;
  paymentStatus: string;
  refundStatus: string | null;
}

const getCartItems = (metadata: Json) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [] as any[];
  const cartItems = (metadata as any).cart_items;
  if (!Array.isArray(cartItems)) return [];
  return cartItems
    .filter((i) => i && typeof i === "object" && !Array.isArray(i))
    .map((item) => ({
      id: String(item.id ?? "item"),
      name: String(item.name ?? "Purchased item"),
      meta: String(item.meta ?? "Order delivery"),
      price: Number(item.price ?? 0),
      delivery: item.delivery ? String(item.delivery) : undefined,
    }));
};

const statusCopy = (status: string) => {
  if (status === "confirmed") return { label: "Delivered", Icon: PackageCheck, className: "border-success/40 bg-success/10 text-success" };
  if (status === "rejected") return { label: "Unavailable", Icon: PackageX, className: "border-destructive/40 bg-destructive/10 text-destructive" };
  return { label: "Processing", Icon: Clock, className: "border-primary/40 bg-primary/10 text-primary" };
};

const MyOrders = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<DeliveredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundDialogFor, setRefundDialogFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const composeDeliveryFromProduct = (p: any, existing?: string) => {
    const parts: string[] = [];
    if (p.full_card) parts.push(`CARD: ${p.full_card}`);
    else if (existing) parts.push(`CARD: ${existing}`);
    if (p.exp && !(p.full_card ?? existing ?? "").includes(p.exp)) parts.push(`EXP: ${p.exp}`);
    if (p.seller) parts.push(`NAME: ${p.seller}`);
    const addr = [p.city, p.state, p.zip].filter(Boolean).join(", ");
    if (addr) parts.push(`ADDRESS: ${addr}`);
    if (p.country) parts.push(`COUNTRY: ${p.country}`);
    if (p.bank) parts.push(`BANK: ${p.bank}`);
    if (p.bin) parts.push(`BIN: ${p.bin}`);
    if (p.brand || p.card_type || p.level) parts.push(`TYPE: ${[p.brand, p.card_type, p.level].filter(Boolean).join(" · ")}`);
    if (p.extras) parts.push(String(p.extras));
    return parts.length ? parts.join(" | ") : existing;
  };

  const loadOrders = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select("id, created_at, status, metadata, refund_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const flat = (data ?? []).flatMap((order: any) =>
      getCartItems(order.metadata).map((item) => ({
        ...item,
        orderId: order.id,
        orderedAt: order.created_at,
        paymentStatus: order.status,
        refundStatus: order.refund_status ?? null,
      })),
    );

    // Enrich card items by fetching product details, so old orders also show full info.
    const cardProductIds = Array.from(new Set(
      flat.filter((i) => i.id.startsWith("cards-")).map((i) => i.id.slice("cards-".length))
    ));
    let productMap: Record<string, any> = {};
    if (cardProductIds.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, full_card, seller, city, state, zip, exp, country, bank, bin, brand, card_type, level, extras")
        .in("id", cardProductIds);
      productMap = Object.fromEntries((prods ?? []).map((p: any) => [p.id, p]));
    }

    setItems(
      flat.map((item) => {
        if (!item.id.startsWith("cards-")) return item;
        const p = productMap[item.id.slice("cards-".length)];
        if (!p) return item;
        return { ...item, delivery: composeDeliveryFromProduct(p, item.delivery) };
      })
    );
    setLoading(false);
  };

  useEffect(() => { loadOrders().catch(() => setLoading(false)); }, [user?.id]);

  const deliveredCount = useMemo(() => items.filter((i) => i.paymentStatus === "confirmed").length, [items]);

  const submitRefund = async () => {
    if (!refundDialogFor) return;
    const { error } = await (supabase as any).rpc("request_refund", { _payment_id: refundDialogFor, _reason: reason });
    if (error) toast.error("Refund failed", { description: error.message });
    else { toast.success("Refund requested"); setRefundDialogFor(null); setReason(""); await loadOrders(); }
  };

  return (
    <AppLayout>
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary glow-primary">
            <ShoppingBag className="h-6 w-6 text-background" />
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">/ My Orders</div>
            <h1 className="font-display text-4xl font-black tracking-tight md:text-5xl"><span className="neon-text">My Orders</span></h1>
          </div>
        </div>
        <p className="mt-3 text-muted-foreground">Delivered items, copy-ready details, and refunds.</p>
      </div>

      <section className="glass rounded-xl p-4 animate-fade-up md:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Order Delivery</div>
          <div className="font-mono text-xs text-muted-foreground">{deliveredCount} DELIVERED · {items.length} TOTAL</div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="min-w-[260px]">Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Refund</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const s = statusCopy(item.paymentStatus);
              const StatusIcon = s.Icon;
              const canRefund = item.paymentStatus === "confirmed" && !item.refundStatus;
              return (
                <TableRow key={`${item.orderId}-${item.id}`}>
                  <TableCell className="min-w-[200px]">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.meta}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs text-primary">#{item.orderId.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(item.orderedAt).toLocaleDateString()}</div>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-primary">${item.price.toFixed(2)}</TableCell>
                  <TableCell>
                    {item.paymentStatus === "confirmed" && item.delivery ? (
                      <div className="flex items-center gap-2">
                        <code className="block max-w-[320px] truncate rounded border border-border bg-secondary/40 px-2 py-1 font-mono text-xs">{item.delivery}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { await copyToClipboard(item.delivery!); toast.success("Copied"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : item.paymentStatus === "confirmed" ? (
                      <a href="https://t.me/Skipalog" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">Telegram @Skipalog</a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={s.className}><StatusIcon className="mr-1 h-3 w-3" />{s.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.refundStatus ? (
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">{item.refundStatus}</Badge>
                    ) : canRefund ? (
                      <Button size="sm" variant="ghost" onClick={() => setRefundDialogFor(item.orderId)}>
                        <Undo2 className="h-3.5 w-3.5" /> Refund
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
            {!items.length && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{loading ? "Loading orders..." : "No delivered items yet."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={loadOrders} disabled={loading}>Refresh</Button>
        </div>
      </section>

      <Dialog open={!!refundDialogFor} onOpenChange={(o) => !o && setRefundDialogFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a refund</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tell us why — admins will review and refund to your balance if approved.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Card was dead / wrong info / ..." className="min-h-24" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefundDialogFor(null)}>Cancel</Button>
            <Button onClick={submitRefund}>Submit refund request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MyOrders;

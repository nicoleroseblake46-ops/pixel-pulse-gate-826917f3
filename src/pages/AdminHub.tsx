import { useEffect, useState } from "react";
import { Navigate, NavLink } from "react-router-dom";
import {
  Check, X, RefreshCw, ShieldCheck, MessageSquareText, Package,
  FilePenLine, Globe, Wallet, ArrowRight, Clock, Send, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const admin = supabase as any;

type Payment = {
  id: string; user_id: string; amount: number; total_credit: number; coin: string;
  status: string; created_at: string;
};
type Ticket = {
  id: string; user_id: string; subject: string; message: string; status: string;
  admin_reply: string | null; created_at: string;
};
type Profile = { id: string; username: string | null };

const tiles = [
  { label: "Accounts",  to: "/admin/users",    icon: Users, hint: "Signups, join times, balances" },
  { label: "Inventory", to: "/admin/products", icon: Package, hint: "Products, cards, pricing" },
  { label: "News",      to: "/admin/news",     icon: FilePenLine, hint: "Announcements & updates" },
  { label: "Payments",  to: "/admin/payments", icon: Wallet, hint: "Deposits, refunds, top-ups" },
  { label: "Orders",    to: "/admin/orders",   icon: ShieldCheck, hint: "Client purchases & delivery" },
  { label: "Tickets",   to: "/admin/tickets",  icon: MessageSquareText, hint: "Support conversations" },
  { label: "Visitors",  to: "/admin/visitors", icon: Globe, hint: "IP & traffic logs" },
];

const AdminHub = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: pRows }, { data: tRows }] = await Promise.all([
      admin.from("payments").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(20),
      admin.from("tickets").select("id,user_id,subject,message,status,admin_reply,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(20),
    ]);
    const ids = [...new Set([...(pRows ?? []).map((r: any) => r.user_id), ...(tRows ?? []).map((r: any) => r.user_id)])];
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("id, username").in("id", ids);
      setProfiles(Object.fromEntries((profs ?? []).map((p: Profile) => [p.id, p])));
    }
    setPayments(pRows ?? []);
    setTickets(tRows ?? []);
    setReplies(Object.fromEntries((tRows ?? []).map((t: Ticket) => [t.id, t.admin_reply ?? ""])));
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch((e) => { toast.error("Load failed", { description: e.message }); setLoading(false); });
  }, [isAdmin]);

  const reviewPayment = async (id: string, action: "approve" | "reject") => {
    setWorkingId(id);
    const { error } = await admin.rpc(action === "approve" ? "approve_payment" : "reject_payment", { _payment_id: id });
    if (error) toast.error("Failed", { description: error.message });
    else { toast.success(action === "approve" ? "Payment approved" : "Payment rejected"); await load(); }
    setWorkingId(null);
  };

  const replyTicket = async (t: Ticket, status: "answered" | "closed") => {
    const reply = (replies[t.id] ?? "").trim();
    if (status === "answered" && !reply) return toast.error("Write a reply first");
    setWorkingId(t.id);
    const { error } = await admin.from("tickets").update({
      status, admin_reply: reply || t.admin_reply,
      resolved_at: status === "closed" ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) toast.error("Update failed", { description: error.message });
    else { toast.success(status === "closed" ? "Ticket closed" : "Reply sent"); await load(); }
    setWorkingId(null);
  };

  if (adminLoading) return <Loader />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-up space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Admin Console</div>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight md:text-5xl">
              <span className="bg-gradient-primary bg-clip-text text-transparent">Command Center</span>
            </h1>
            <p className="mt-2 text-muted-foreground">Approve, reply and manage everything from one screen.</p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pending payments" value={payments.length} tone="primary" icon={Wallet} />
          <StatCard label="Open tickets" value={tickets.length} tone="accent" icon={MessageSquareText} />
          <StatCard
            label="Credit at stake"
            value={`$${payments.reduce((s, p) => s + Number(p.total_credit || 0), 0).toFixed(2)}`}
            tone="success" icon={ShieldCheck}
          />
          <StatCard label="Sections" value={tiles.length} tone="muted" icon={Package} />
        </div>

        {/* Quick nav tiles */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-[var(--glow-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display font-bold">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.hint}</div>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-smooth group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </NavLink>
            );
          })}
        </div>

        {loading ? (
          <Loader />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pending payments */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-elevated)]">
              <header className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-black">Pending payments</h2>
                  <p className="text-xs text-muted-foreground">Approve to credit user balance instantly.</p>
                </div>
                <NavLink to="/admin/payments" className="text-xs font-semibold text-primary hover:underline">View all →</NavLink>
              </header>

              {payments.length === 0 ? (
                <EmptyState icon={Wallet} text="No pending deposits — all clear." />
              ) : (
                <ul className="space-y-3">
                  {payments.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{profiles[p.user_id]?.username ?? "Unknown"}</div>
                          <Badge variant="secondary" className="font-mono text-[10px]">{p.coin}</Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(p.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold text-primary">+${Number(p.total_credit).toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">Deposit ${Number(p.amount).toFixed(2)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => reviewPayment(p.id, "approve")} disabled={workingId === p.id}>
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => reviewPayment(p.id, "reject")} disabled={workingId === p.id}>
                          <X className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Open tickets */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-elevated)]">
              <header className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-black">Open tickets</h2>
                  <p className="text-xs text-muted-foreground">Reply inline — no page hop needed.</p>
                </div>
                <NavLink to="/admin/tickets" className="text-xs font-semibold text-primary hover:underline">View all →</NavLink>
              </header>

              {tickets.length === 0 ? (
                <EmptyState icon={MessageSquareText} text="Inbox zero." />
              ) : (
                <ul className="space-y-3">
                  {tickets.slice(0, 6).map((t) => (
                    <li key={t.id} className="rounded-lg border border-border/70 bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{t.subject}</div>
                          <div className="text-xs text-muted-foreground">
                            {profiles[t.user_id]?.username ?? "Unknown"} · {new Date(t.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge className="shrink-0 bg-accent/20 text-accent-foreground">open</Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.message}</p>
                      <Textarea
                        value={replies[t.id] ?? ""}
                        onChange={(e) => setReplies((r) => ({ ...r, [t.id]: e.target.value }))}
                        placeholder="Quick reply…"
                        className="mt-2 min-h-16 bg-input text-sm"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => replyTicket(t, "answered")} disabled={workingId === t.id}>
                          <Send className="h-4 w-4" /> Send reply
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => replyTicket(t, "closed")} disabled={workingId === t.id}>
                          <Check className="h-4 w-4" /> Close
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const StatCard = ({
  label, value, tone, icon: Icon,
}: { label: string; value: string | number; tone: "primary" | "accent" | "success" | "muted"; icon: any }) => {
  const toneClass = {
    primary: "from-primary to-primary-glow text-primary-foreground",
    accent:  "from-accent to-accent-glow text-accent-foreground",
    success: "from-emerald-500 to-teal-500 text-white",
    muted:   "from-muted to-secondary text-foreground",
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-30 blur-2xl", toneClass)} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-3xl font-black">{value}</div>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
    <Icon className="mb-2 h-8 w-8 opacity-40" />
    <div className="text-sm">{text}</div>
  </div>
);

export default AdminHub;

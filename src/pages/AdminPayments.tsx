import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Check, ShieldCheck, UserPlus, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { toast } from "sonner";

type Payment = {
  id: string;
  user_id: string;
  amount: number;
  bonus_amount: number;
  total_credit: number;
  cart_total: number;
  coin: string;
  status: string;
  created_at: string;
  refund_status?: string | null;
  refund_reason?: string | null;
};

type Profile = { id: string; username: string | null; balance: number };

const adminClient = supabase as any;

const AdminPayments = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const [adjustUser, setAdjustUser] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);


  const pendingCount = useMemo(() => payments.filter((payment) => payment.status === "pending").length, [payments]);
  const pendingImpact = useMemo(
    () => payments.filter((payment) => payment.status === "pending").reduce((total, payment) => total + Number(payment.total_credit), 0),
    [payments],
  );

  const loadPayments = async () => {
    setLoading(true);
    const { data: paymentRows, error: paymentError } = await adminClient.from("payments").select("*").order("created_at", { ascending: false });
    if (paymentError) throw paymentError;

    const userIds = [...new Set((paymentRows as Payment[]).map((payment) => payment.user_id))];
    const { data: profileRows, error: profileError } = await adminClient.from("profiles").select("id, username, balance").in("id", userIds);
    if (profileError) throw profileError;

    setPayments(paymentRows as Payment[]);
    setProfiles(Object.fromEntries((profileRows as Profile[]).map((profile) => [profile.id, profile])));
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadPayments().catch((error) => {
      toast.error("Could not load payments", { description: error instanceof Error ? error.message : "Please try again." });
      setLoading(false);
    });
  }, [isAdmin]);

  const reviewPayment = async (paymentId: string, action: "approve" | "reject") => {
    setWorkingId(paymentId);
    const { error } = await adminClient.rpc(action === "approve" ? "approve_payment" : "reject_payment", { _payment_id: paymentId });
    if (error) {
      toast.error("Review failed", { description: error.message });
    } else {
      toast.success(action === "approve" ? "Payment approved" : "Payment rejected");
      await loadPayments();
    }
    setWorkingId(null);
  };

  const reviewRefund = async (paymentId: string, approve: boolean) => {
    setWorkingId(paymentId);
    const { error } = await adminClient.rpc("review_refund", { _payment_id: paymentId, _approve: approve });
    if (error) toast.error("Refund review failed", { description: error.message });
    else { toast.success(approve ? "Refund approved & credited" : "Refund denied"); await loadPayments(); }
    setWorkingId(null);
  };

  const assignAdminRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = adminEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter an email address");
      return;
    }

    setAssigningAdmin(true);
    const { data, error } = await adminClient.rpc("assign_admin_role_by_email", { _email: email });
    if (error) {
      toast.error("Admin assignment failed", { description: error.message });
    } else {
      toast.success("Admin access confirmed", { description: `${data?.username ?? email} now has admin permissions.` });
      setAdminEmail("");
    }
    setAssigningAdmin(false);
  };

  const adjustBalance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = adjustUser.trim();
    const amount = Number(adjustAmount);
    if (!query) return toast.error("Enter a username or user ID");
    if (!Number.isFinite(amount) || amount === 0) return toast.error("Enter a non-zero amount");

    setAdjusting(true);
    // Resolve user by id or username
    let userId: string | null = null;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(query)) userId = query;
    else {
      // Accept username, email, or partial — strip domain if an email was pasted
      const handle = query.includes("@") ? query.split("@")[0] : query;
      let matches: { id: string; username: string | null }[] = [];

      const exact = await adminClient.from("profiles").select("id, username").ilike("username", handle).limit(2);
      matches = exact.data ?? [];

      if (!matches.length) {
        const partial = await adminClient.from("profiles").select("id, username").ilike("username", `%${handle}%`).limit(5);
        matches = partial.data ?? [];
      }

      if (!matches.length) { setAdjusting(false); return toast.error("No user found", { description: `Nothing matches "${query}". Check the exact username in Users, or paste their user ID.` }); }
      if (matches.length > 1) { setAdjusting(false); return toast.error("Multiple users match", { description: matches.map((m) => m.username).filter(Boolean).join(", ") }); }
      userId = matches[0].id;
    }


    const { data, error } = await adminClient.rpc("admin_adjust_balance", {
      _user_id: userId, _amount: amount, _note: adjustNote.trim() || null,
    });
    if (error) toast.error("Adjustment failed", { description: error.message });
    else {
      toast.success(`Balance updated`, { description: `New balance: $${Number(data).toFixed(2)}` });
      setAdjustUser(""); setAdjustAmount(""); setAdjustNote("");
      await loadPayments();
    }
    setAdjusting(false);
  };


  if (adminLoading) return <Loader />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-up space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Admin Console</div>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight neon-text md:text-5xl">Payment Review</h1>
            <p className="mt-2 text-muted-foreground">Approve deposits only after confirmation. Rejections never change balances.</p>
          </div>
          <Button variant="secondary" onClick={() => loadPayments()} disabled={loading}>Refresh</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass rounded-xl p-4"><div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pending</div><div className="mt-2 font-display text-3xl font-black text-primary">{pendingCount}</div></div>
          <div className="glass rounded-xl p-4"><div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Balance Impact</div><div className="mt-2 font-display text-3xl font-black text-primary">${pendingImpact.toFixed(2)}</div></div>
          <div className="glass rounded-xl p-4"><div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Reviewed</div><div className="mt-2 font-display text-3xl font-black text-primary">{payments.length - pendingCount}</div></div>
        </div>

        {/* Refund queue */}
        {payments.some((p) => p.refund_status === "requested") && (
          <section className="glass rounded-xl border border-amber-500/30 p-4 md:p-5">
            <h2 className="mb-3 font-display text-xl font-black">Refund requests</h2>
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Order</TableHead><TableHead>Amount</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.filter((p) => p.refund_status === "requested").map((payment) => (
                  <TableRow key={`refund-${payment.id}`}>
                    <TableCell>{profiles[payment.user_id]?.username ?? "Unknown"}</TableCell>
                    <TableCell className="font-mono text-xs">#{payment.id.slice(0,8)}</TableCell>
                    <TableCell className="font-mono text-primary">${Number(payment.cart_total).toFixed(2)}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={payment.refund_reason ?? ""}>{payment.refund_reason ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => reviewRefund(payment.id, true)} disabled={workingId === payment.id}><Check /> Refund</Button>
                        <Button size="sm" variant="destructive" onClick={() => reviewRefund(payment.id, false)} disabled={workingId === payment.id}><X /> Deny</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}


        <section className="glass rounded-xl p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Admin Access</div>
              <h2 className="mt-1 font-display text-2xl font-black tracking-tight">Assign admin by email</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter an existing account email to grant admin permissions.</p>
            </div>
            <form onSubmit={assignAdminRole} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
              <Input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="admin@example.com"
                className="bg-secondary/50"
                disabled={assigningAdmin}
                required
              />
              <Button type="submit" disabled={assigningAdmin} className="shrink-0">
                <UserPlus className="h-4 w-4" />
                {assigningAdmin ? "Confirming..." : "Confirm Admin"}
              </Button>
            </form>
          </div>
        </section>

        <section className="glass rounded-xl p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Manual Top-Up</div>
              <h2 className="mt-1 font-display text-2xl font-black tracking-tight">Add balance to a user</h2>
              <p className="mt-1 text-sm text-muted-foreground">Credit or debit a user's balance instantly — no submit needed from their side. Use a negative amount to deduct.</p>
            </div>
            <form onSubmit={adjustBalance} className="grid w-full gap-2 sm:grid-cols-[1fr_120px_auto] lg:max-w-2xl">
              <Input value={adjustUser} onChange={(e) => setAdjustUser(e.target.value)} placeholder="Username or user ID" className="bg-secondary/50" disabled={adjusting} required />
              <Input type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="Amount $" className="bg-secondary/50 font-mono" disabled={adjusting} required />
              <Button type="submit" disabled={adjusting} className="shrink-0">{adjusting ? "Applying..." : "Add Balance"}</Button>
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Note (optional)" className="bg-secondary/50 sm:col-span-3" disabled={adjusting} />
            </form>
          </div>
        </section>


        <section className="glass rounded-xl p-4 md:p-5">
          {loading ? <Loader /> : (
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Status</TableHead><TableHead>Deposit</TableHead><TableHead>Credit Impact</TableHead><TableHead>Balance After</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const profile = profiles[payment.user_id];
                  const beforeBalance = Number(profile?.balance ?? 0);
                  const impact = payment.status === "pending" ? Number(payment.total_credit) : 0;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell><div className="font-medium">{profile?.username ?? "Unknown user"}</div><div className="font-mono text-xs text-muted-foreground">{payment.user_id.slice(0, 8)}</div></TableCell>
                      <TableCell><Badge variant={payment.status === "pending" ? "secondary" : payment.status === "confirmed" ? "default" : "destructive"}>{payment.status}</Badge></TableCell>
                      <TableCell className="font-mono">${Number(payment.amount).toFixed(2)} {payment.coin}</TableCell>
                      <TableCell className="font-mono text-primary">+${Number(payment.total_credit).toFixed(2)}</TableCell>
                      <TableCell className="font-mono">${(beforeBalance + impact).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {payment.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => reviewPayment(payment.id, "approve")} disabled={workingId === payment.id}><Check /> Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => reviewPayment(payment.id, "reject")} disabled={workingId === payment.id}><X /> Reject</Button>
                          </div>
                        ) : <ShieldCheck className="ml-auto h-5 w-5 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminPayments;
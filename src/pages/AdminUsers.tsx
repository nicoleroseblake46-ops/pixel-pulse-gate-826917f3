import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Users, RefreshCw, Search, Ban } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  username: string | null;
  created_at: string;
  balance: number;
  banned_at: string | null;
};

const fmtJoined = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const datePart = sameDay(d, today)
    ? "Today"
    : sameDay(d, yesterday)
      ? "Yesterday"
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timePart = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return { datePart, timePart };
};

const AdminUsers = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, created_at, balance, banned_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Load failed", { description: error.message });
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch((e) => {
      toast.error("Load failed", { description: e.message });
      setLoading(false);
    });
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => (p.username ?? "").toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [profiles, query]);

  const totalBalance = profiles.reduce((s, p) => s + Number(p.balance || 0), 0);
  const bannedCount = profiles.filter((p) => p.banned_at).length;

  if (adminLoading) return <Loader />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-up space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Admin Console</div>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight md:text-5xl">
              <span className="bg-gradient-primary bg-clip-text text-transparent">Accounts</span>
            </h1>
            <p className="mt-2 text-muted-foreground">Every signup, newest first — with join time, balance and status.</p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total accounts" value={profiles.length} icon={Users} />
          <StatCard label="Combined balance" value={`$${totalBalance.toFixed(2)}`} icon={Users} />
          <StatCard label="Banned" value={bannedCount} icon={Ban} />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username or user ID…"
            className="pl-9 bg-input"
          />
        </div>

        {/* List */}
        {loading ? (
          <Loader />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
            <Users className="mb-2 h-8 w-8 opacity-40" />
            <div className="text-sm">{query ? "No account matches that search." : "No accounts yet."}</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)]">
            <div className="hidden grid-cols-[2fr_3fr_1fr_1fr] gap-4 border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:grid">
              <div>Username</div>
              <div>Joined</div>
              <div>Balance</div>
              <div>Status</div>
            </div>
            <ul className="divide-y divide-border/60">
              {filtered.map((p) => {
                const { datePart, timePart } = fmtJoined(p.created_at);
                return (
                  <li
                    key={p.id}
                    className="grid grid-cols-1 gap-2 px-5 py-3 transition-smooth hover:bg-sidebar-accent/40 md:grid-cols-[2fr_3fr_1fr_1fr] md:items-center md:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.username ?? "(no username)"}</div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">{p.id}</div>
                    </div>
                    <div>
                      <div className="text-sm">
                        {datePart} <span className="text-muted-foreground">· {timePart}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground md:hidden">{p.id}</div>
                    </div>
                    <div className="font-mono font-bold text-primary">${Number(p.balance || 0).toFixed(2)}</div>
                    <div>
                      {p.banned_at ? (
                        <Badge variant="destructive" className="font-mono text-[10px]">BANNED</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 font-mono text-[10px] text-emerald-400">ACTIVE</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const StatCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) => (
  <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary-glow opacity-20 blur-2xl" />
    <div className="relative flex items-center justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-3xl font-black">{value}</div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export default AdminUsers;

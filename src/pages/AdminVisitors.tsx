import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";

type VisitorLog = {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  path: string | null;
  referrer: string | null;
  country: string | null;
  user_id: string | null;
  created_at: string;
};

type Geo = { city?: string; region?: string; country?: string };

// One row per unique account (guests fall back to one row per IP)
type Row = {
  key: string;
  ip: string;
  visits: number;
  firstSeen: string; // previous (earliest) visit
  lastSeen: string; // newest visit
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  user_id: string | null;
  country: string | null;
};

const fmt = (iso: string) => new Date(iso).toLocaleString();

const AdminVisitors = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [geo, setGeo] = useState<Record<string, Geo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      // Exclude staff/admin traffic (including your own account) so this only shows real site visitors
      const [{ data: roles }, { data: authData }, { data, error }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
        supabase.auth.getUser(),
        supabase
          .from("visitor_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      const adminIds = new Set((roles || []).map((r: { user_id: string }) => r.user_id));
      const myId = authData?.user?.id;
      if (myId) adminIds.add(myId);
      const logs = ((data as VisitorLog[]) || []).filter((l) => !(l.user_id && adminIds.has(l.user_id)));

      // Collapse to one row per unique account (guests: one row per IP).
      // Logs arrive newest-first, so the first hit is the newest visit.
      const byAccount = new Map<string, Row>();
      for (const l of logs) {
        const ip = l.ip_address?.trim();
        if (!ip) continue;
        const key = l.user_id || `guest:${ip}`;
        const existing = byAccount.get(key);
        if (existing) {
          existing.visits += 1;
          existing.firstSeen = l.created_at; // walking backwards in time
        } else {
          byAccount.set(key, {
            key,
            ip,
            visits: 1,
            firstSeen: l.created_at,
            lastSeen: l.created_at,
            path: l.path,
            referrer: l.referrer,
            user_agent: l.user_agent,
            user_id: l.user_id,
            country: l.country,
          });
        }
      }
      const list = Array.from(byAccount.values())
        .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
        .slice(0, 300);
      setRows(list);
      setLoading(false);

      // Resolve locations in parallel batches so the table fills in fast.
      const ips = [...new Set(list.map((r) => r.ip))];
      const CHUNK = 12;
      for (let i = 0; i < ips.length; i += CHUNK) {
        const batch = ips.slice(i, i + CHUNK);
        await Promise.all(
          batch.map(async (ip) => {
            try {
              const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
              if (!res.ok) return;
              const j = await res.json();
              if (j?.error) return;
              setGeo((g) => ({
                ...g,
                [ip]: { city: j.city || undefined, region: j.region || undefined, country: j.country_name || undefined },
              }));
            } catch {
              /* ignore lookup failures */
            }
          }),
        );
      }
    })();
  }, [isAdmin]);

  if (adminLoading) return null;
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-8 text-muted-foreground">Admin access required.</div>
      </AppLayout>
    );
  }

  const locationLabel = (r: Row) => {
    const g = geo[r.ip];
    if (!g) return r.country || "—";
    return [g.city, g.region, g.country].filter(Boolean).join(", ") || r.country || "—";
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="font-display text-3xl font-black">Visitor IPs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} unique accounts · each listed once with previous and newest visit
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Previous visit</th>
                <th className="px-4 py-3">New visit</th>
                <th className="px-4 py-3">Visits</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">User Agent</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No visits logged yet.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.key} className="border-t border-border hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {r.user_id ? r.user_id.slice(0, 8) : <span className="text-muted-foreground">guest</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono">{r.ip}</td>
                    <td className="px-4 py-2">{locationLabel(r)}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {r.visits > 1 ? fmt(r.firstSeen) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{fmt(r.lastSeen)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.visits}</td>
                    <td className="px-4 py-2">{r.path || "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-muted-foreground" title={r.referrer || ""}>{r.referrer || "—"}</td>
                    <td className="max-w-[260px] truncate px-4 py-2 text-xs text-muted-foreground" title={r.user_agent || ""}>{r.user_agent || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminVisitors;

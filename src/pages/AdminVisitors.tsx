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

type Row = {
  ip: string;
  visits: number;
  lastSeen: string;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  user_id: string | null;
  country: string | null;
};

const AdminVisitors = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [geo, setGeo] = useState<Record<string, Geo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      // Exclude staff/admin traffic so this only shows real site visitors
      const [{ data: roles }, { data, error }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
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
      const logs = ((data as VisitorLog[]) || []).filter((l) => !(l.user_id && adminIds.has(l.user_id)));

      // Collapse to one row per unique IP (most recent visit wins)
      const byIp = new Map<string, Row>();
      for (const l of logs) {
        const ip = l.ip_address?.trim();
        if (!ip) continue;
        const existing = byIp.get(ip);
        if (existing) {
          existing.visits += 1;
        } else {
          byIp.set(ip, {
            ip,
            visits: 1,
            lastSeen: l.created_at,
            path: l.path,
            referrer: l.referrer,
            user_agent: l.user_agent,
            user_id: l.user_id,
            country: l.country,
          });
        }
      }
      const list = Array.from(byIp.values()).slice(0, 300);
      setRows(list);
      setLoading(false);

      // Resolve exact location per unique IP (city-level)
      for (const r of list) {
        try {
          const res = await fetch(`https://ipapi.co/${encodeURIComponent(r.ip)}/json/`);
          if (!res.ok) continue;
          const j = await res.json();
          if (j?.error) continue;
          setGeo((g) => ({
            ...g,
            [r.ip]: { city: j.city || undefined, region: j.region || undefined, country: j.country_name || undefined },
          }));
        } catch {
          /* ignore lookup failures */
        }
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
    if (!g) return r.country || "Looking up…";
    return [g.city, g.region, g.country].filter(Boolean).join(", ") || r.country || "—";
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="font-display text-3xl font-black">Visitor IPs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} unique IPs · each IP listed once with exact location
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Visits</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">User Agent</th>
                <th className="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No visits logged yet.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.ip} className="border-t border-border hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{new Date(r.lastSeen).toLocaleString()}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono">{r.ip}</td>
                    <td className="px-4 py-2">{locationLabel(r)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.visits}</td>
                    <td className="px-4 py-2">{r.path || "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-muted-foreground" title={r.referrer || ""}>{r.referrer || "—"}</td>
                    <td className="max-w-[260px] truncate px-4 py-2 text-xs text-muted-foreground" title={r.user_agent || ""}>{r.user_agent || "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.user_id ? r.user_id.slice(0, 8) : "—"}</td>
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

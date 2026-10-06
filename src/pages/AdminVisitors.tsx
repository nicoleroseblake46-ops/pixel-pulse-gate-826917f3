import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Globe2,
  Laptop,
  MapPin,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CountryFlag } from "@/components/CountryFlag";
import { Loader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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

type Profile = {
  id: string;
  username: string | null;
  created_at: string;
  banned_at: string | null;
};

type Geo = { city?: string; region?: string; country?: string; countryCode?: string };
type Filter = "all" | "today" | "accounts" | "anonymous";

type ActivityGroup = {
  key: string;
  kind: "account" | "anonymous";
  userId: string | null;
  username: string;
  joinedAt: string | null;
  bannedAt: string | null;
  visits: VisitorLog[];
  lastSeen: string | null;
  latestIp: string | null;
  country: string | null;
};

const PAGE_SIZE = 20;
const GEO_CACHE_KEY = "visitor-location-cache-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const readGeoCache = (): Record<string, Geo> => {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) ?? "{}") as Record<string, Geo>;
  } catch {
    return {};
  }
};

const deviceLabel = (agent?: string | null) => {
  if (!agent) return "Unknown device";
  const browser = agent.includes("Firefox/")
    ? "Firefox"
    : agent.includes("Edg/")
      ? "Edge"
      : agent.includes("Chrome/") || agent.includes("CriOS/")
        ? "Chrome"
        : agent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const device = /iPhone|iPad/i.test(agent)
    ? "iOS"
    : /Android/i.test(agent)
      ? "Android"
      : /Windows/i.test(agent)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(agent)
          ? "macOS"
          : /Linux/i.test(agent)
            ? "Linux"
            : "Device";
  return `${browser} on ${device}`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "No activity yet";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminVisitors = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [geo, setGeo] = useState<Record<string, Geo>>(readGeoCache);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    const [{ data: profileRows, error: profileError }, { data: logRows, error: logError }] = await Promise.all([
      supabase.from("profiles").select("id, username, created_at, banned_at").order("created_at", { ascending: false }),
      supabase
        .from("visitor_logs")
        .select("id, ip_address, user_agent, path, referrer, country, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(3000),
    ]);

    const error = profileError ?? logError;
    if (error) toast.error("Activity could not load", { description: error.message });
    setProfiles((profileRows as Profile[]) ?? []);
    setLogs((logRows as VisitorLog[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch((error: Error) => {
      toast.error("Activity could not load", { description: error.message });
      setLoading(false);
      setRefreshing(false);
    });
  }, [isAdmin]);

  const groups = useMemo<ActivityGroup[]>(() => {
    const accountLogs = new Map<string, VisitorLog[]>();
    const anonymousLogs = new Map<string, VisitorLog[]>();

    for (const log of logs) {
      if (log.user_id) {
        const current = accountLogs.get(log.user_id) ?? [];
        current.push(log);
        accountLogs.set(log.user_id, current);
      } else {
        const ip = log.ip_address?.trim() || "Unknown IP";
        const current = anonymousLogs.get(ip) ?? [];
        current.push(log);
        anonymousLogs.set(ip, current);
      }
    }

    const knownIds = new Set(profiles.map((profile) => profile.id));
    const accountGroups = profiles.map((profile): ActivityGroup => {
      const visits = accountLogs.get(profile.id) ?? [];
      const latest = visits[0];
      return {
        key: `account:${profile.id}`,
        kind: "account",
        userId: profile.id,
        username: profile.username || "Unnamed account",
        joinedAt: profile.created_at,
        bannedAt: profile.banned_at,
        visits,
        lastSeen: latest?.created_at ?? null,
        latestIp: latest?.ip_address ?? null,
        country: latest?.country ?? null,
      };
    });

    for (const [userId, visits] of accountLogs) {
      if (knownIds.has(userId)) continue;
      const latest = visits[0];
      accountGroups.push({
        key: `account:${userId}`,
        kind: "account",
        userId,
        username: "Deleted account",
        joinedAt: null,
        bannedAt: null,
        visits,
        lastSeen: latest?.created_at ?? null,
        latestIp: latest?.ip_address ?? null,
        country: latest?.country ?? null,
      });
    }

    const anonymousGroups = Array.from(anonymousLogs, ([ip, visits]): ActivityGroup => {
      const latest = visits[0];
      return {
        key: `anonymous:${ip}`,
        kind: "anonymous",
        userId: null,
        username: "Anonymous visitor",
        joinedAt: null,
        bannedAt: null,
        visits,
        lastSeen: latest?.created_at ?? null,
        latestIp: ip === "Unknown IP" ? null : ip,
        country: latest?.country ?? null,
      };
    });

    return [...accountGroups, ...anonymousGroups].sort((a, b) => {
      if (!a.lastSeen && !b.lastSeen) return (b.joinedAt ?? "").localeCompare(a.joinedAt ?? "");
      if (!a.lastSeen) return 1;
      if (!b.lastSeen) return -1;
      return b.lastSeen.localeCompare(a.lastSeen);
    });
  }, [logs, profiles]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const cutoff = Date.now() - DAY_MS;
    return groups.filter((group) => {
      if (filter === "today" && (!group.lastSeen || new Date(group.lastSeen).getTime() < cutoff)) return false;
      if (filter === "accounts" && group.kind !== "account") return false;
      if (filter === "anonymous" && group.kind !== "anonymous") return false;
      if (!search) return true;
      const recent = group.visits.slice(0, 5);
      return [
        group.username,
        group.userId,
        group.latestIp,
        group.country,
        ...recent.flatMap((visit) => [visit.path, visit.referrer, deviceLabel(visit.user_agent)]),
      ].some((value) => value?.toLowerCase().includes(search));
    });
  }, [filter, groups, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setExpanded(null);
  }, [filter, query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const missingIps = Array.from(new Set(
      visible.map((group) => group.latestIp).filter((ip): ip is string => Boolean(ip) && !geo[ip as string])
    )).slice(0, PAGE_SIZE);
    if (!missingIps.length) return;

    let cancelled = false;
    Promise.allSettled(
      missingIps.map(async (ip) => {
        const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
        if (!response.ok) throw new Error("Location unavailable");
        const result = await response.json();
        if (result?.error) throw new Error("Location unavailable");
        return {
          ip,
          value: {
            city: result.city || undefined,
            region: result.region || undefined,
            country: result.country_name || undefined,
            countryCode: result.country_code || undefined,
          } as Geo,
        };
      })
    ).then((results) => {
      if (cancelled) return;
      const resolved = results.reduce<Record<string, Geo>>((next, result) => {
        if (result.status === "fulfilled") next[result.value.ip] = result.value.value;
        return next;
      }, {});
      if (!Object.keys(resolved).length) return;
      setGeo((current) => {
        const next = { ...current, ...resolved };
        try {
          localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(Object.fromEntries(Object.entries(next).slice(-250))));
        } catch {
          // Location caching is optional.
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [visible, geo]);

  const activeToday = groups.filter((group) => group.lastSeen && Date.now() - new Date(group.lastSeen).getTime() < DAY_MS).length;
  const anonymousCount = groups.filter((group) => group.kind === "anonymous").length;
  const visitsToday = logs.filter((log) => Date.now() - new Date(log.created_at).getTime() < DAY_MS).length;

  if (adminLoading) return <Loader />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-up space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Admin Console</div>
            <h1 className="mt-2 font-display text-3xl font-black md:text-5xl">Account activity</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Accounts, visits, locations and devices in one place.
            </p>
          </div>
          <Button variant="secondary" onClick={() => load(true)} disabled={refreshing || loading}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Refresh
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
          <Metric label="Accounts" value={profiles.length} icon={Users} />
          <Metric label="Active today" value={activeToday} icon={Activity} />
          <Metric label="Visits today" value={visitsToday} icon={Clock3} />
          <Metric label="Anonymous IPs" value={anonymousCount} icon={Globe2} />
        </section>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search account, ID, IP, location or path…"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 sm:flex">
            {([
              ["all", "All"],
              ["today", "Active today"],
              ["accounts", "Accounts"],
              ["anonymous", "Anonymous"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "ghost"}
                onClick={() => setFilter(value)}
                className="justify-center"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <Loader />
        ) : visible.length === 0 ? (
          <div className="border-y border-border py-16 text-center text-sm text-muted-foreground">
            No activity matches this view.
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="hidden grid-cols-[2fr_1.25fr_1.35fr_.6fr_1.1fr_36px] gap-4 border-b border-border bg-muted/40 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground lg:grid">
              <span>Account</span><span>Last activity</span><span>Location & IP</span><span>Visits</span><span>Device</span><span />
            </div>
            <div className="divide-y divide-border">
              {visible.map((group) => {
                const latest = group.visits[0];
                const location = group.latestIp ? geo[group.latestIp] : undefined;
                const locationText = [location?.city, location?.region, location?.country].filter(Boolean).join(", ") || group.country || (group.latestIp ? "Locating…" : "No location");
                const isExpanded = expanded === group.key;
                return (
                  <article key={group.key} className={cn("transition-colors", isExpanded && "bg-muted/20")}>
                    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[2fr_1.25fr_1.35fr_.6fr_1.1fr_36px] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted font-display font-bold">
                          {group.kind === "account" ? group.username.charAt(0).toUpperCase() : <Globe2 className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold">{group.username}</span>
                            {group.kind === "anonymous" ? (
                              <Badge variant="secondary" className="font-mono text-[9px]">GUEST</Badge>
                            ) : group.bannedAt ? (
                              <Badge variant="destructive" className="font-mono text-[9px]">BANNED</Badge>
                            ) : (
                              <Badge variant="outline" className="font-mono text-[9px]">ACCOUNT</Badge>
                            )}
                          </div>
                          <div className="truncate font-mono text-[10px] text-muted-foreground">
                            {group.userId || group.latestIp || "Unknown visitor"}
                          </div>
                        </div>
                      </div>
                      <InfoBlock icon={Clock3} label="Last activity" value={formatDateTime(group.lastSeen)} />
                      <div className="flex min-w-0 items-center gap-2">
                        <CountryFlag value={location?.countryCode || location?.country || group.country} width={22} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate text-sm">{locationText}</div>
                          <div className="truncate font-mono text-[10px] text-muted-foreground">{group.latestIp || "No IP recorded"}</div>
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-lg font-bold">{group.visits.length}</div>
                        <div className="text-[10px] text-muted-foreground">recorded</div>
                      </div>
                      <InfoBlock icon={Laptop} label="Device" value={deviceLabel(latest?.user_agent)} />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={isExpanded ? `Hide ${group.username} activity` : `Show ${group.username} activity`}
                        onClick={() => setExpanded(isExpanded ? null : group.key)}
                        disabled={!group.visits.length}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-background px-4 py-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h2 className="font-display text-sm font-bold">Recent activity</h2>
                          {group.joinedAt && <span className="text-xs text-muted-foreground">Joined {formatDateTime(group.joinedAt)}</span>}
                        </div>
                        <div className="space-y-2">
                          {group.visits.slice(0, 8).map((visit) => (
                            <div key={visit.id} className="grid gap-2 rounded-md border border-border bg-card px-3 py-3 text-sm sm:grid-cols-[1.1fr_1fr_1.2fr_1.4fr] sm:items-center">
                              <span className="font-mono text-xs">{formatDateTime(visit.created_at)}</span>
                              <span className="flex min-w-0 items-center gap-2"><Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{visit.path || "/"}</span></span>
                              <span className="flex min-w-0 items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate font-mono text-xs">{visit.ip_address || "No IP"}</span></span>
                              <span className="truncate text-xs text-muted-foreground" title={visit.user_agent || undefined}>{deviceLabel(visit.user_agent)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{filtered.length} results · page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button size="icon" variant="secondary" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
};

const Metric = ({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) => (
  <div className="flex min-h-24 items-center justify-between bg-card p-4">
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-black">{value}</div>
    </div>
    <Icon className="h-5 w-5 text-muted-foreground" />
  </div>
);

const InfoBlock = ({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) => (
  <div className="flex min-w-0 items-center gap-2">
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground lg:hidden" />
    <div className="min-w-0">
      <div className="text-[10px] uppercase text-muted-foreground lg:hidden">{label}</div>
      <div className="truncate text-sm" title={value}>{value}</div>
    </div>
  </div>
);

export default AdminVisitors;
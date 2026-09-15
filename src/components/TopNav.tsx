import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home, CreditCard, MonitorSmartphone, Network, Wrench, Zap, ScrollText,
  ShoppingBag, MessageSquareText, Bell, Mail, ShoppingCart, Wallet,
  User, Menu, X, ChevronDown, LogOut, ShieldCheck, FilePenLine, Package, Globe,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCommerce } from "@/contexts/CommerceContext";
import { useAdmin } from "@/hooks/use-admin";
import { useAppSettings } from "@/hooks/use-app-settings";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const mainNav = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Cards", url: "/cards", icon: CreditCard, hasDropdown: true },
  { title: "RDP", url: "/rdp", icon: MonitorSmartphone },
  { title: "Proxy", url: "/proxy", icon: Network },
  { title: "Tools", url: "/tools", icon: Wrench, hasDropdown: true },
  { title: "My Orders", url: "/orders", icon: ShoppingBag, hasDropdown: true },

  { title: "Tickets", url: "/tickets", icon: MessageSquareText },
];

export const TopNav = () => {
  const { user, signOut } = useAuth();
  const { balance, cartItems } = useCommerce();
  const { isAdmin } = useAdmin();
  const { salesHidden } = useAppSettings();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [pendingPayments, setPendingPayments] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const pendingAdmin = pendingPayments + openTickets;

  useEffect(() => {
    if (!user) {
      setDisplayName("User");
      return;
    }
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setDisplayName((data?.username as string) || user.email?.split("@")[0] || "User"));
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [{ count: pc }, { count: tc }] = await Promise.all([
        (supabase as any).from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      setPendingPayments(pc ?? 0);
      setOpenTickets(tc ?? 0);
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isAdmin]);

  const visibleNav = mainNav.filter((it) => !(it.title === "Sales" && salesHidden && !isAdmin));

  return (
    <>
      {/* Top utility bar */}
      <header className="fixed left-0 right-0 top-0 z-50 h-14 bg-gradient-primary text-white shadow-[0_4px_20px_-8px_hsl(232_84%_20%/0.5)]">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-12 items-center justify-center rounded-t-full rounded-bl-xl rounded-br-sm bg-white shadow-sm">
              <span className="font-display text-xl font-black text-primary">N</span>
            </div>
            <span className="font-display text-lg font-black tracking-wide drop-shadow-sm">NEXUS</span>
          </NavLink>

          {/* Right utilities */}
          <div className="flex items-center gap-1 md:gap-3">
            <ThemeToggle className="h-9 w-9 text-white hover:bg-white/15" />
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <NavLink to="/tickets" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15" aria-label="Messages">
              <Mail className="h-5 w-5" />
            </NavLink>
            <NavLink to="/payments" className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {!!cartItems.length && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                  {cartItems.length}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/payments"
              className="hidden items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25 md:flex"
            >
              <Wallet className="h-4 w-4" />
              <span>Add Funds</span>
              <span className="font-mono">${balance.toFixed(2)}</span>
            </NavLink>
            <NavLink
              to="/profile"
              className="flex h-9 items-center gap-2 rounded-lg bg-white/15 px-2 hover:bg-white/25"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white font-display text-xs font-black text-primary">
                {(displayName || "U").charAt(0).toUpperCase()}
              </span>
            </NavLink>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="ml-1 rounded-md p-1.5 hover:bg-white/15 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Horizontal nav bar */}
      <nav className="fixed left-0 right-0 top-14 z-40 hidden h-12 border-b border-border bg-white shadow-sm dark:bg-card md:block">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-1 px-4 md:px-6">
          {visibleNav.map((item) => {
            const active = loc.pathname === item.url;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-smooth",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
                {item.hasDropdown && <ChevronDown className="h-3 w-3 opacity-60" />}
              </NavLink>
            );
          })}

          {isAdmin && (
            <div className="ml-auto flex items-center gap-1">
              <NavLink
                to="/admin"
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-smooth",
                  loc.pathname.startsWith("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin</span>
                {pendingAdmin > 0 && (
                  <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {pendingAdmin}
                  </span>
                )}
              </NavLink>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 z-30 bg-white/95 backdrop-blur-xl dark:bg-card/95 md:hidden">
          <div className="space-y-1 p-4">
            {visibleNav.map((it) => {
              const Icon = it.icon;
              const active = loc.pathname === it.url;
              return (
                <NavLink
                  key={it.url}
                  to={it.url}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-smooth",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  {it.title}
                </NavLink>
              );
            })}
            <NavLink
              to="/payments"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-smooth",
                loc.pathname === "/payments" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <Wallet className="h-5 w-5" /> Payments
            </NavLink>
            <NavLink
              to="/profile"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-smooth",
                loc.pathname === "/profile" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <User className="h-5 w-5" /> Profile
            </NavLink>
            {isAdmin && (
              <>
                <div className="my-2 border-t border-border" />
                <NavLink to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3 font-semibold text-primary hover:bg-primary/20">
                  <ShieldCheck className="h-5 w-5" /> Admin Console
                  {pendingAdmin > 0 && <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{pendingAdmin}</span>}
                </NavLink>
                <NavLink to="/admin/news" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground hover:bg-secondary">
                  <FilePenLine className="h-5 w-5" /> News Admin
                </NavLink>
                <NavLink to="/admin/products" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground hover:bg-secondary">
                  <Package className="h-5 w-5" /> Inventory Admin
                </NavLink>
                <NavLink to="/admin/payments" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground hover:bg-secondary">
                  <ShieldCheck className="h-5 w-5" /> Payments Admin
                </NavLink>
                <NavLink to="/admin/tickets" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground hover:bg-secondary">
                  <MessageSquareText className="h-5 w-5" /> Tickets Admin
                </NavLink>
                <NavLink to="/admin/visitors" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground hover:bg-secondary">
                  <Globe className="h-5 w-5" /> Visitor IPs
                </NavLink>
              </>
            )}
            <div className="my-2 border-t border-border" />
            <button
              onClick={() => { setMobileOpen(false); signOut(); }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" /> Disconnect
            </button>
          </div>
        </div>
      )}
    </>
  );
};

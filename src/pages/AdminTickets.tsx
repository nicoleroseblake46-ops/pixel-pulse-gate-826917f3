import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";

type Ticket = { id: string; user_id: string; subject: string; message: string; status: string; admin_reply: string | null; created_at: string };

const AdminTickets = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const loadTickets = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("tickets").select("id,user_id,subject,message,status,admin_reply,created_at").order("created_at", { ascending: false });
    setLoading(false);
    if (error) throw error;
    setTickets(data ?? []);
    setReplies(Object.fromEntries((data ?? []).map((ticket: Ticket) => [ticket.id, ticket.admin_reply ?? ""])));
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadTickets().catch((error) => toast.error("Could not load tickets", { description: error.message }));
  }, [isAdmin]);

  const updateTicket = async (ticket: Ticket, status: "answered" | "closed") => {
    const reply = (replies[ticket.id] ?? "").trim();
    if (status === "answered" && !reply) return toast.error("Write a reply first");
    const { error } = await (supabase as any).from("tickets").update({ status, admin_reply: reply || ticket.admin_reply, resolved_at: status === "closed" ? new Date().toISOString() : null }).eq("id", ticket.id);
    if (error) return toast.error("Ticket update failed", { description: error.message });
    toast.success(status === "closed" ? "Ticket closed" : "Reply sent");
    loadTickets();
  };

  const deleteTicket = async (id: string) => {
    const { error } = await (supabase as any).from("tickets").delete().eq("id", id);
    if (error) return toast.error("Delete failed", { description: error.message });
    toast.success("Ticket removed");
    loadTickets();
  };

  const deleteMany = async (mode: "closed" | "all") => {
    const ids = tickets.filter((t) => mode === "all" || t.status !== "open").map((t) => t.id);
    if (!ids.length) return toast.info("Nothing to delete");
    if (!confirm(`Delete ${ids.length} ticket(s)? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("tickets").delete().in("id", ids);
    if (error) return toast.error("Delete failed", { description: error.message });
    toast.success(`${ids.length} ticket(s) deleted`);
    loadTickets();
  };

  if (adminLoading) return <Loader />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-up space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-normal text-primary">Admin Console</div>
            <h1 className="font-display text-4xl font-black">Ticket Control</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={loadTickets} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button variant="outline" onClick={() => deleteMany("closed")}><Trash2 className="h-4 w-4" /> Delete answered/closed</Button>
            <Button variant="destructive" onClick={() => deleteMany("all")}><Trash2 className="h-4 w-4" /> Delete all</Button>
          </div>
        </div>

        {loading ? <Loader /> : tickets.map((ticket) => (
          <article key={ticket.id} className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-elevated)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">{ticket.subject}</h2>
              <span className="rounded-full bg-secondary px-3 py-1 font-mono text-xs font-bold uppercase text-primary">{ticket.status}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{ticket.message}</p>
            <Textarea value={replies[ticket.id] ?? ""} onChange={(event) => setReplies((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Reply to this ticket" className="mt-4 min-h-28 bg-input" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => updateTicket(ticket, "answered")}>Send Reply</Button>
              <Button variant="secondary" onClick={() => updateTicket(ticket, "closed")}>Close</Button>
              <Button variant="destructive" onClick={() => deleteTicket(ticket.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
            </div>
          </article>
        ))}
        {!loading && !tickets.length && <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">No tickets yet.</div>}
      </div>
    </AppLayout>
  );
};

export default AdminTickets;
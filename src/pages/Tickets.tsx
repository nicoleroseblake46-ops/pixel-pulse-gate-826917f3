import { useEffect, useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

type Ticket = { id: string; subject: string; message: string; status: string; admin_reply: string | null; created_at: string };

const ticketSchema = z.object({
  subject: z.string().trim().min(2, "Enter a subject").max(120, "Subject is too long"),
  message: z.string().trim().min(2, "Enter your message").max(2000, "Message is too long"),
});

const Tickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const openTelegram = async () => {
    if (connectingTelegram) return;
    setConnectingTelegram(true);
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const { data, error } = await supabase.functions.invoke("telegram-link", { body: {} });
      if (error) {
        const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        throw new Error(details);
      }
      if (typeof data?.url !== "string" || !data.url.startsWith("https://t.me/nexushelp2bot?start=")) throw new Error("Invalid support link");
      if (popup) popup.location.href = data.url;
      else window.location.assign(data.url);
    } catch (error) {
      popup?.close();
      toast.error("Could not open Telegram", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setConnectingTelegram(false);
    }
  };

  const loadTickets = () => {
    if (!user) return;
    (supabase as any).from("tickets").select("id,subject,message,status,admin_reply,created_at").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }: { data: Ticket[] | null }) => setTickets(data ?? []));
  };

  useEffect(() => {
    loadTickets();
    const channel = supabase.channel("my-tickets").on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, loadTickets).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const submitTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const parsed = ticketSchema.safeParse({ subject, message });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

    setSaving(true);
    const { data: created, error } = await (supabase as any).from("tickets").insert({ user_id: user.id, subject: parsed.data.subject, message: parsed.data.message, status: "open" }).select("id").single();
    setSaving(false);
    if (error) return toast.error("Ticket failed", { description: error.message });
    toast.success("Ticket sent");
    if (created?.id) supabase.functions.invoke("ticket-notify", { body: { ticket_id: created.id } }).catch(() => {});
    setSubject("");
    setMessage("");
    loadTickets();
  };

  return (
    <AppLayout>
      <section className="animate-fade-up space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-4xl font-black text-foreground">Create Ticket</h1>
          <Button
            variant="outline"
            onClick={openTelegram}
            disabled={connectingTelegram}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.06-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
            {connectingTelegram ? "Opening Telegram…" : "Chat with support on Telegram"}
          </Button>
        </div>

        <form onSubmit={submitTicket} className="rounded-sm border border-border bg-card px-5 py-6 shadow-[var(--shadow-elevated)]">
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Enter A Subject" className="h-12 rounded-sm border-border bg-input text-lg" />
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Enter your Message" className="mt-4 min-h-36 resize-y rounded-sm border-border bg-input text-lg" />
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 font-display font-black uppercase tracking-normal text-primary-foreground hover:bg-primary/90">
              <Send className="h-4 w-4" /> {saving ? "Sending" : "Submit"}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold">{ticket.subject}</h2>
                <span className="rounded-full bg-secondary px-3 py-1 font-mono text-xs font-bold uppercase text-primary">{ticket.status}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{ticket.message}</p>
              {ticket.admin_reply && <div className="mt-4 rounded-md bg-secondary p-4"><div className="font-mono text-xs font-bold uppercase text-primary">Admin reply</div><p className="mt-2 whitespace-pre-wrap">{ticket.admin_reply}</p></div>}
            </article>
          ))}
          {!tickets.length && <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground"><MessageSquareText className="mx-auto mb-2 h-6 w-6" />No tickets yet.</div>}
        </div>
      </section>
    </AppLayout>
  );
};

export default Tickets;
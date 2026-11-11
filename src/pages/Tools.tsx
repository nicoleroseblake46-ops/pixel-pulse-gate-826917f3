import { useMemo, useState } from "react";
import { Wrench, ShoppingCart, Sparkles, RefreshCcw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommerce } from "@/contexts/CommerceContext";
import { useProducts } from "@/hooks/use-products";
import { Loader } from "@/components/Loader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRICE_PER_CHECK = 0.5;
const LIVE_RATE = 0.9; // ~90% of cards return Live

type Parsed = { raw: string; pan: string; mm: string; yy: string; cvv: string };

const parseLine = (line: string): Parsed | null => {
  const cleaned = line.trim();
  if (!cleaned) return null;
  // Accepts PAN|MM/YY|CVV  or  PAN|MM|YY|CVV  with various separators
  const parts = cleaned.split(/[|,;: ]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const pan = parts[0].replace(/\D/g, "");
  let mm = "";
  let yy = "";
  let cvv = "";
  if (parts.length === 3) {
    const [m, y] = (parts[1] || "").split(/[\/\-.]/);
    mm = (m ?? "").replace(/\D/g, "");
    yy = (y ?? "").replace(/\D/g, "");
    cvv = (parts[2] ?? "").replace(/\D/g, "");
  } else {
    mm = (parts[1] ?? "").replace(/\D/g, "");
    yy = (parts[2] ?? "").replace(/\D/g, "");
    cvv = (parts[3] ?? "").replace(/\D/g, "");
  }
  if (!pan || !mm || !yy || !cvv) return null;
  return { raw: cleaned, pan, mm, yy, cvv };
};

const Tools = () => {
  const { cartItems, addToCart, balance, refreshBalance } = useCommerce();
  const { products, loading } = useProducts("tools");
  const [input, setInput] = useState("");
  const [alive, setAlive] = useState<string[]>([]);
  const [dead, setDead] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [refunded, setRefunded] = useState(0);

  const lines = useMemo(
    () => input.split(/\r?\n/).map(parseLine).filter((l): l is Parsed => l !== null),
    [input],
  );
  const totalCost = lines.length * PRICE_PER_CHECK;
  const insufficient = totalCost > balance;

  const runCheck = async () => {
    if (!lines.length) { toast.error("Add at least one card"); return; }
    if (insufficient) {
      toast.error("Insufficient balance", { description: `Need $${totalCost.toFixed(2)}.` });
      return;
    }
    setRunning(true);
    setAlive([]);
    setDead([]);
    setRefunded(0);

    const { error: chargeError } = await supabase.rpc("charge_checker_fee", {
      _count: lines.length,
      _price_per_check: PRICE_PER_CHECK,
    });
    if (chargeError) {
      setRunning(false);
      toast.error("Could not charge fee", { description: chargeError.message });
      return;
    }
    await refreshBalance();

    let deadCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      await new Promise((r) => setTimeout(r, 220));
      const isLive = Math.random() < LIVE_RATE;
      if (isLive) setAlive((prev) => [...prev, l.raw]);
      else { setDead((prev) => [...prev, l.raw]); deadCount++; }
    }

    if (deadCount > 0) {
      const { error: refundErr } = await supabase.rpc("refund_checker_fee", {
        _count: deadCount,
        _price_per_check: PRICE_PER_CHECK,
      });
      if (!refundErr) {
        const amount = deadCount * PRICE_PER_CHECK;
        setRefunded(amount);
        await refreshBalance();
        toast.success(`Refunded $${amount.toFixed(2)} for ${deadCount} dead`);
      }
    }
    setRunning(false);
  };

  const addItem = (item: typeof products[number]) => {
    addToCart({ id: `tools-${item.id}`, name: item.name, meta: item.meta, price: Number(item.price) });
    toast.success("Added to cart");
  };

  return (
    <AppLayout>
      {/* CC Checker */}
      <section className="mb-10 animate-fade-up">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Wrench className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold leading-none">Bulk validator</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">Format: PAN|MM/YY|CVV</div>
              </div>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
              <span>{lines.length} valid line{lines.length === 1 ? "" : "s"}</span>
              <span className="text-foreground">Total <span className="font-bold">${totalCost.toFixed(2)}</span></span>
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-2">
            {/* Input */}
            <div className="border-b border-border p-4 md:border-b-0 md:border-r">
              <Textarea
                placeholder={`1234123412341234|12/34|123\n5678567856785678|07/29|456`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[260px] resize-y rounded-lg border-border bg-background font-mono text-sm leading-6"
              />
              <div className="mt-3 flex items-center gap-2">
                <Button
                  onClick={runCheck}
                  disabled={running || !lines.length || insufficient}
                  className="h-11 flex-1 rounded-lg font-semibold"
                >
                  {running
                    ? "Checking…"
                    : insufficient && lines.length
                      ? `Need $${totalCost.toFixed(2)}`
                      : `Run check · $${totalCost.toFixed(2)}`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setInput(""); setAlive([]); setDead([]); setRefunded(0); }}
                  disabled={running}
                  className="h-11"
                >
                  Clear
                </Button>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <RefreshCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>
                  Dead cards auto-refund <span className="font-mono font-semibold text-foreground">${PRICE_PER_CHECK.toFixed(2)}</span> each on completion.
                  {refunded > 0 && <span className="ml-1 font-mono text-success">Last run: +${refunded.toFixed(2)}</span>}
                </span>
              </div>
            </div>

            {/* Results */}
            <div className="grid gap-3 p-4">
              <ResultPanel label="Alive" tone="success" items={alive} />
              <ResultPanel label="Dead" tone="destructive" items={dead} />
            </div>
          </div>
        </div>
      </section>


      {/* Other tools (admin-managed inventory) */}
      <section className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-primary">
          <Sparkles className="h-4 w-4" /> More tools
        </div>
        {loading ? (
          <Loader />
        ) : !products.length ? (
          <div className="glass rounded-xl px-6 py-12 text-center text-muted-foreground">
            No additional tools listed. Check back soon.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((item, i) => {
              const cartId = `tools-${item.id}`;
              const inCart = cartItems.some((c) => c.id === cartId);
              return (
                <article
                  key={item.id}
                  className="glass group relative overflow-hidden rounded-xl p-5 transition-smooth hover:-translate-y-1 hover:border-primary/40 animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-primary opacity-0 transition-smooth group-hover:opacity-100" />
                  {item.tag && (
                    <span className="absolute right-4 top-4 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">
                      {item.tag}
                    </span>
                  )}
                  <h3 className="font-display text-lg font-bold">{item.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
                    <span className="font-mono text-lg font-bold text-primary text-glow">${Number(item.price).toFixed(2)}</span>
                    <Button size="sm" variant={inCart ? "secondary" : "default"} onClick={() => addItem(item)} disabled={inCart}>
                      <ShoppingCart /> {inCart ? "Added" : "Add"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppLayout>
  );
};

const ResultPanel = ({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "success" | "destructive";
  items: string[];
}) => {
  const toneClasses =
    tone === "success"
      ? "border-success/30"
      : "border-destructive/30";
  const dotClass = tone === "success" ? "bg-success" : "bg-destructive";
  const headingClass = tone === "success" ? "text-success" : "text-destructive";
  return (
    <div className={`rounded-lg border bg-background ${toneClasses}`}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {items.length} {items.length === 1 ? "hit" : "hits"}
        </span>
      </div>
      <div className="min-h-[120px] max-h-[200px] overflow-auto p-2 font-mono text-xs leading-6">
        {items.length ? (
          items.map((line, i) => (
            <div key={`${i}-${line}`} className={`truncate ${headingClass}`}>
              {line}
            </div>
          ))
        ) : (
          <div className="flex h-full min-h-[100px] items-center justify-center text-muted-foreground">
            Awaiting results…
          </div>
        )}
      </div>
    </div>
  );
};

export default Tools;

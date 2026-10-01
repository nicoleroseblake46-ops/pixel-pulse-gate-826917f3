import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/hooks/use-app-settings";
import { COINS, resolveMethods, type PaymentMethods } from "@/lib/payment-methods";
import { toast } from "sonner";

export const PaymentMethodsEditor = () => {
  const { settings, setSetting } = useAppSettings();
  const [draft, setDraft] = useState<PaymentMethods>(() => resolveMethods(settings.payment_methods));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(resolveMethods(settings.payment_methods)); }, [settings.payment_methods]);

  const save = async () => {
    if (!COINS.some((c) => draft[c].enabled)) return toast.error("Keep at least one payment method on");
    if (COINS.some((c) => draft[c].enabled && draft[c].address.trim().length < 20)) return toast.error("Enter a full wallet address for every enabled method");
    setSaving(true);
    await setSetting("payment_methods", draft);
    setSaving(false);
    toast.success("Payment methods saved");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <Wallet className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-display text-base font-bold">Payment methods</div>
          <p className="text-xs text-muted-foreground">Turn coins on/off and change the deposit wallet buyers see.</p>
        </div>
      </div>
      <div className="space-y-2">
        {COINS.map((c) => (
          <div key={c} className="grid items-center gap-2 sm:grid-cols-[120px_1fr_auto]">
            <div className="font-mono text-sm font-bold">{c}</div>
            <Input
              value={draft[c].address}
              onChange={(e) => setDraft({ ...draft, [c]: { ...draft[c], address: e.target.value } })}
              className="h-9 font-mono text-xs"
              placeholder={`${c} wallet address`}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={draft[c].enabled} onCheckedChange={(v) => setDraft({ ...draft, [c]: { ...draft[c], enabled: v } })} />
              {draft[c].enabled ? "On" : "Off"}
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save methods"}</Button>
      </div>
    </section>
  );
};

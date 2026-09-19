import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCommerce } from "@/contexts/CommerceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, ShoppingCart } from "lucide-react";
import { NavLink } from "react-router-dom";

const Profile = () => {
  const { user } = useAuth();
  const { balance, cartItems } = useCommerce();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.username) setUsername(data.username as string);
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ username }).eq("id", user.id);
    setSaving(false);
    if (error) {
      const taken = error.message.toLowerCase().includes("profiles_username_unique") || error.code === "23505";
      toast.error(taken ? "That username is taken" : error.message, taken ? { description: "Pick another one — usernames must be unique." } : undefined);
    } else toast.success("Profile updated");
  };

  const initial = (username || user?.email || "?").charAt(0).toUpperCase();

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-4 animate-fade-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary font-display text-2xl font-black text-primary-foreground shadow-[var(--shadow-elevated)]">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold">{username || "Account"}</h1>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <NavLink to="/payments" className="rounded-xl border border-border bg-card p-4 transition-smooth hover:border-primary/40">
            <Wallet className="h-4 w-4 text-primary" />
            <div className="mt-2 font-display text-xl font-bold">${balance.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Balance</div>
          </NavLink>
          <NavLink to="/payments" className="rounded-xl border border-border bg-card p-4 transition-smooth hover:border-primary/40">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <div className="mt-2 font-display text-xl font-bold">{cartItems.length}</div>
            <div className="text-xs text-muted-foreground">In cart</div>
          </NavLink>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Username</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2" />
          <Button onClick={save} disabled={saving} className="mt-4 w-full sm:w-auto">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;

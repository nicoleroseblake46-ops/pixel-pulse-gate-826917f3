import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, Check, Copy, CreditCard, ShoppingCart, Trash2, Wallet, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCommerce } from "@/contexts/CommerceContext";
import { useCryptoRates, formatCrypto } from "@/hooks/use-crypto-rates";
import { useAppSettings } from "@/hooks/use-app-settings";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";

import { COINS, resolveMethods, type CoinKey } from "@/lib/payment-methods";
const presetAmounts = [20, 50, 100, 200, 500];
const bonuses: Record<number, number> = { 100: 8, 200: 20, 500: 65, 1000: 150 };


const Payments = () => {
  const { balance, cartItems, cartTotal, removeFromCart, createPendingPayment, purchaseCartWithBalance } = useCommerce();
  const { rates, loading: ratesLoading } = useCryptoRates();
  const { settings } = useAppSettings();
  const MIN_DEPOSIT = Math.max(0, Number(settings.min_deposit ?? 20));
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const methods = resolveMethods(settings.payment_methods);
  const enabledCoins = COINS.filter((c) => methods[c].enabled);
  const [pickedCoin, setCoin] = useState<CoinKey>("BTC");
  const coin: CoinKey = enabledCoins.includes(pickedCoin) ? pickedCoin : (enabledCoins[0] ?? "BTC");
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const checkoutAmount = selected ?? Number(amount);
  const bonus = bonuses[checkoutAmount] ?? 0;
  const walletAddress = methods[coin].address;
  const rate = rates[coin];
  const cryptoAmount = checkoutAmount > 0 && rate > 0 ? checkoutAmount / rate : 0;
  const cryptoDisplay = formatCrypto(cryptoAmount, coin);

  const addressCopied = copiedAddress === `${coin}:${walletAddress}`;

  const copyWallet = async () => {
    const ok = await copyToClipboard(walletAddress);
    setCopiedAddress(`${coin}:${walletAddress}`);
    if (ok) {
      setCopied(true);
      toast.success("Wallet copied");
      setTimeout(() => setCopied(false), 1600);
    } else {
      toast.error("Copy failed — long-press to copy");
    }
  };

  const copyCryptoAmount = async () => {
    if (!cryptoAmount) return;
    const ok = await copyToClipboard(cryptoDisplay);
    if (ok) {
      setCopiedAmount(true);
      toast.success(`${cryptoDisplay} ${coin.split("/")[0]} copied`);
      setTimeout(() => setCopiedAmount(false), 1600);
    } else {
      toast.error("Copy failed — long-press to copy");
    }
  };

  const checkout = async () => {
    if (!checkoutAmount || checkoutAmount < MIN_DEPOSIT) {
      toast.error(`Minimum deposit is $${MIN_DEPOSIT}`);
      return;
    }
    if (!addressCopied) {
      toast.error("Copy the payment address first", { description: "Tap \"Copy address\" and send your payment before submitting." });
      return;
    }

    setSubmitting(true);
    try {
      const paymentId = await createPendingPayment(checkoutAmount, bonus, coin, walletAddress);
      toast.success("Payment pending", { description: `Order ${paymentId.slice(0, 8)} is awaiting confirmation.` });
      setAmount("");
      setSelected(null);
    } catch (error) {
      toast.error("Checkout failed", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const buyCart = async () => {
    setPurchasing(true);
    try {
      const orderId = await purchaseCartWithBalance();
      toast.success("Purchase complete", { description: `Order ${orderId.slice(0, 8)} is now in My Orders.` });
    } catch (error) {
      toast.error("Purchase failed", { description: error instanceof Error ? error.message : "Please top up first." });
    } finally {
      setPurchasing(false);
    }
  };

  const hasCart = !!cartItems.length;
  const canBuyWithBalance = hasCart && balance >= cartTotal;
  const shortfall = hasCart ? Math.max(0, cartTotal - balance) : 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl animate-fade-up">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-black tracking-tight md:text-3xl">Wallet</h1>
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-right shadow-sm">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Balance</div>
            <div className="font-display text-xl font-black text-primary">${balance.toFixed(2)}</div>
          </div>
        </div>


        {hasCart && (
          <section className="glass-strong mb-5 rounded-2xl border border-primary/40 p-5 shadow-2xl md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary">
                  <ShoppingCart className="h-4 w-4" /> Checkout with balance
                </div>
                <h2 className="mt-1 font-display text-2xl font-black">Pay instantly using your funds</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Cart total</div>
                    <div className="font-display text-lg font-black">${cartTotal.toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Available</div>
                    <div className="font-display text-lg font-black text-primary">${balance.toFixed(2)}</div>
                  </div>
                  <div className={`rounded-lg border p-3 ${canBuyWithBalance ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/10"}`}>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{canBuyWithBalance ? "After purchase" : "Top up needed"}</div>
                    <div className="font-display text-lg font-black">
                      {canBuyWithBalance ? `$${(balance - cartTotal).toFixed(2)}` : `$${shortfall.toFixed(2)}`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="group flex items-center justify-between gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-secondary/30">
                      <span className="min-w-0 flex-1 truncate text-foreground/90">
                        {item.name} <span className="text-xs text-muted-foreground">· {item.meta}</span>
                      </span>
                      <span className="font-mono text-foreground">${item.price.toFixed(2)}</span>
                      <button
                        onClick={() => { removeFromCart(item.id); toast.success("Removed from cart"); }}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-56">
                <Button
                  onClick={buyCart}
                  disabled={purchasing || !canBuyWithBalance}
                  className="h-12 bg-gradient-primary font-display text-base font-bold text-background glow-primary hover:opacity-90"
                >
                  <CreditCard /> {purchasing ? "Processing..." : `Pay $${cartTotal.toFixed(2)}`}
                </Button>
                {!canBuyWithBalance && (
                  <p className="text-center text-xs font-semibold text-muted-foreground">
                    Top up <span className="text-foreground">${shortfall.toFixed(2)}</span> more below to checkout.
                  </p>
                )}
                {canBuyWithBalance && (
                  <p className="text-center text-xs font-semibold text-primary">Funds ready · instant delivery</p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-black tracking-tight">Top up with crypto</h2>
            <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">Min ${MIN_DEPOSIT}</span>
          </div>

          <div className="mb-5 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Use the right currency, address, and amount. Lost funds cannot be recovered.
            </p>
          </div>

          <label className="text-sm font-semibold">Amount (USD)</label>
          <Input
            type="number"
            min={MIN_DEPOSIT}
            step="0.01"
            value={amount}
            onChange={(event) => { setAmount(event.target.value); setSelected(null); }}
            placeholder={`Minimum $${MIN_DEPOSIT}`}
            className="mt-2 h-11 rounded-lg border border-border bg-background px-3 text-base font-semibold focus-visible:ring-primary"
          />

          <div className="mt-4 grid grid-cols-3 gap-3">
            {enabledCoins.map((value) => (
              <button key={value} onClick={() => setCoin(value)} className={`rounded-lg border p-3 font-display font-bold transition-smooth ${coin === value ? "border-primary bg-primary text-primary-foreground glow-primary" : "border-border bg-secondary/20 hover:border-primary/60"}`}>
                {value}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {presetAmounts.map((value) => (
              <button
                key={value}
                onClick={() => { setSelected(value); setAmount(String(value)); }}
                className={`rounded-lg border p-4 text-center transition-smooth hover:border-primary/60 ${selected === value ? "border-primary bg-primary/15 glow-primary" : "border-border bg-secondary/20"}`}
              >
                <div className="font-display text-xl font-black">${value.toFixed(2)}</div>
                {!!bonuses[value] && <div className="mt-1 font-semibold text-muted-foreground">+ ${bonuses[value].toFixed(2)} bonus</div>}
              </button>
            ))}
          </div>

          {checkoutAmount > 0 && (
            <div className="mt-5 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    You will send {ratesLoading ? "(updating rate…)" : `· 1 ${coin.split("/")[0]} ≈ $${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  </div>
                  <div className="mt-1 font-display text-2xl font-black text-primary text-glow">
                    ≈ {cryptoDisplay} <span className="text-base text-foreground/80">{coin.split("/")[0]}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-muted-foreground">
                    For ${checkoutAmount.toFixed(2)}{bonus > 0 ? ` · +$${bonus.toFixed(2)} bonus` : ""}
                  </div>
                </div>
                <Button variant="secondary" onClick={copyCryptoAmount} className="shrink-0" disabled={!cryptoAmount}>
                  {copiedAmount ? <Check /> : <Copy />} Copy amount
                </Button>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Live rate from CoinGecko · refreshed every 2 min. Send the exact crypto amount above to the {coin} address below. Network fees are paid by you.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-secondary/20 p-4 sm:flex-row sm:items-center">
            <div className="mx-auto rounded-lg bg-foreground p-3 sm:mx-0">
              <QRCodeSVG value={walletAddress} size={108} bgColor="#fafafa" fgColor="#0a0a0f" level="M" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground"><Wallet className="h-4 w-4" /> {coin} deposit address</div>
              <code
                className="block w-full break-all rounded-md bg-background/70 px-3 py-2 font-mono text-[11px] leading-relaxed select-all sm:text-xs"
                onClick={copyWallet}
                title="Tap to copy"
              >
                {walletAddress}
              </code>
              <Button variant="secondary" onClick={copyWallet} className="mt-2 w-full sm:w-auto">
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy address"}
              </Button>
            </div>
          </div>

          {!addressCopied && (
            <p className="mt-4 text-right text-xs font-semibold text-amber-600">Copy the {coin} address above to unlock Submit.</p>
          )}
          <div className="mt-3 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button variant="ghost" onClick={() => { setAmount(""); setSelected(null); }}>Cancel</Button>
            <Button onClick={checkout} disabled={submitting || !addressCopied} className="h-11 bg-gradient-primary px-8 font-display font-bold text-background glow-primary hover:opacity-90">
              {submitting ? "Submitting..." : "Submit Top Up"}
            </Button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Payments;
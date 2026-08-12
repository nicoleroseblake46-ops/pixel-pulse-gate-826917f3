import { AppLayout } from "@/components/AppLayout";
import { LucideIcon, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommerce } from "@/contexts/CommerceContext";
import { toast } from "sonner";
import { ProductCategory, useProducts } from "@/hooks/use-products";
import { Loader } from "@/components/Loader";

interface Props {
  title: string;
  tagline?: string;
  Icon: LucideIcon;
  category: ProductCategory;
}

export const SectionPage = ({ title, Icon, category }: Props) => {
  const { cartItems, addToCart } = useCommerce();
  const { products, loading } = useProducts(category);

  const addItem = (item: typeof products[number]) => {
    addToCart({
      id: `${category}-${item.id}`,
      name: item.name,
      meta: item.meta,
      price: Number(item.price),
      delivery: category === "proxy" ? buildProxyDelivery(item) : item.extras || undefined,
    });
    toast.success("Added to cart", { description: item.name });
  };


  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3 animate-fade-up">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      </div>

      {loading ? (
        <Loader />
      ) : !products.length ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
          No items available right now. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((item, i) => {
            const cartId = `${category}-${item.id}`;
            const inCart = cartItems.some((c) => c.id === cartId);
            return (
              <article
                key={item.id}
                className="group rounded-xl border border-border bg-card p-5 transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {item.tag && (
                  <span className="mb-2 inline-block rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">
                    {item.tag}
                  </span>
                )}
                {item.image_url && (
                  <div className="mb-4 -mx-5 -mt-5 overflow-hidden border-b border-border/50">
                    <img src={item.image_url} alt={item.name} loading="lazy" className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                )}
                <h3 className="font-display text-lg font-bold">{item.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
                  <span className="font-mono text-lg font-bold text-primary">${Number(item.price).toFixed(2)}</span>
                  <Button size="sm" variant={inCart ? "secondary" : "default"} onClick={() => addItem(item)} disabled={inCart}>
                    <ShoppingCart /> {inCart ? "Added" : "Add"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

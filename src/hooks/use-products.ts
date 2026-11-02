import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProductCategory = "sales" | "cards" | "proxy" | "tools" | "socks" | "rdp" | "logs";

export type Product = {
  id: string;
  category: ProductCategory;
  name: string;
  meta: string;
  price: number;
  tag: string | null;
  sort_order: number;
  is_active: boolean;
  bin: string | null;
  country: string | null;
  state: string | null;
  brand: string | null;
  card_type: string | null;
  bank: string | null;
  seller: string | null;
  exp: string | null;
  zip: string | null;
  valid: string | null;
  scheme: string | null;
  level: string | null;
  country_code: string | null;
  extras: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export const useProducts = (category: ProductCategory) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("category", category)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (mounted) {
        setProducts((data ?? []) as Product[]);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`products-${category}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `category=eq.${category}` }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [category]);

  return { products, loading };
};

// Gerado a partir do banco (Supabase → generate_typescript_types) em 2026-11-06, após a migração fase2_market.
// Regenerar sempre que uma migration mudar tabelas, enums ou funções.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          cep: string;
          city: string;
          complement: string | null;
          created_at: string;
          district: string;
          id: string;
          is_default: boolean;
          label: string;
          number: string;
          recipient: string;
          state: string;
          street: string;
          user_id: string;
        };
        Insert: {
          cep: string;
          city: string;
          complement?: string | null;
          created_at?: string;
          district: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          number: string;
          recipient: string;
          state: string;
          street: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          data: Json;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          data?: Json;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      cart_items: {
        Row: { added_at: string; product_id: string; quantity: number; user_id: string };
        Insert: { added_at?: string; product_id: string; quantity: number; user_id: string };
        Update: { added_at?: string; product_id?: string; quantity?: number; user_id?: string };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: { id: number; name: string; position: number; slug: string };
        Insert: { id?: never; name: string; position?: number; slug: string };
        Update: { id?: never; name?: string; position?: number; slug?: string };
        Relationships: [];
      };
      feature_flags: {
        Row: { description: string | null; enabled: boolean; key: string };
        Insert: { description?: string | null; enabled?: boolean; key: string };
        Update: { description?: string | null; enabled?: boolean; key?: string };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          actor_id: string | null;
          created_at: string;
          delta: number;
          id: number;
          order_id: string | null;
          product_id: string;
          reason: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          delta: number;
          id?: never;
          order_id?: string | null;
          product_id: string;
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_movements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          title: string;
          unit_price_cents: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          title: string;
          unit_price_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          buyer_id: string;
          cancelled_reason: string | null;
          created_at: string;
          id: string;
          number: number;
          shipping_address: Json;
          shipping_cents: number;
          status: Database["public"]["Enums"]["order_status"];
          store_id: string;
          subtotal_cents: number;
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          cancelled_reason?: string | null;
          created_at?: string;
          id?: string;
          number?: never;
          shipping_address: Json;
          shipping_cents?: number;
          status?: Database["public"]["Enums"]["order_status"];
          store_id: string;
          subtotal_cents: number;
          total_cents: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: { created_at: string; id: string; path: string; position: number; product_id: string };
        Insert: { created_at?: string; id?: string; path: string; position?: number; product_id: string };
        Update: { created_at?: string; id?: string; path?: string; position?: number; product_id?: string };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: number | null;
          compare_at_cents: number | null;
          condition: Database["public"]["Enums"]["product_condition"];
          created_at: string;
          description: string | null;
          id: string;
          price_cents: number;
          search: unknown;
          status: Database["public"]["Enums"]["product_status"];
          stock: number;
          store_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category_id?: number | null;
          compare_at_cents?: number | null;
          condition?: Database["public"]["Enums"]["product_condition"];
          created_at?: string;
          description?: string | null;
          id?: string;
          price_cents: number;
          search?: unknown;
          status?: Database["public"]["Enums"]["product_status"];
          stock?: number;
          store_id: string;
          title: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      stores: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          owner_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          owner_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cancel_order: { Args: { _order_id: string; _reason?: string }; Returns: undefined };
      checkout: { Args: { _address_id: string }; Returns: string[] };
      create_store: { Args: { _description?: string; _name: string; _slug: string }; Returns: string };
    };
    Enums: {
      app_role:
        | "buyer"
        | "seller"
        | "affiliate"
        | "creator"
        | "admin_super"
        | "admin_finance"
        | "admin_ops"
        | "moderator"
        | "support"
        | "analyst";
      order_status: "pending_payment" | "paid" | "shipped" | "delivered" | "cancelled";
      product_condition: "new" | "used" | "refurbished";
      product_status: "draft" | "active" | "paused";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

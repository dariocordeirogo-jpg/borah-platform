// Gerado a partir do banco (Supabase → generate_typescript_types) em 2026-11-06, após a migração fase3_leiloes (tabelas de leilão adicionadas à mão, conferidas com a migration).
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
      auctions: {
        Row: {
          id: string;
          lineage_id: string;
          relist_count: number;
          store_id: string;
          product_id: string;
          title: string;
          starting_price_cents: number;
          min_increment_cents: number;
          reserve_price_cents: number | null;
          current_price_cents: number | null;
          leader_id: string | null;
          leader_alias: string | null;
          bids_count: number;
          starts_at: string;
          ends_at: string;
          duration: unknown;
          snipe_window_s: number;
          snipe_extend_s: number;
          max_extensions: number;
          extensions_count: number;
          status: Database["public"]["Enums"]["auction_status"];
          outcome: "sold" | "no_bids" | "reserve_not_met" | "unpaid" | "cancelled" | null;
          winner_id: string | null;
          winning_bid_cents: number | null;
          ended_at: string | null;
          payment_due_at: string | null;
          order_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { [k: string]: never };
        Update: { [k: string]: never };
        Relationships: [
          {
            foreignKeyName: "auctions_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auctions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      auction_bids: {
        Row: {
          id: number;
          auction_id: string;
          bidder_id: string;
          bidder_alias: string;
          amount_cents: number;
          idempotency_key: string;
          created_at: string;
        };
        Insert: { [k: string]: never };
        Update: { [k: string]: never };
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey";
            columns: ["auction_id"];
            isOneToOne: false;
            referencedRelation: "auctions";
            referencedColumns: ["id"];
          },
        ];
      };
      bid_blocks: {
        Row: { user_id: string; blocked_until: string; reason: string; created_at: string };
        Insert: { [k: string]: never };
        Update: { [k: string]: never };
        Relationships: [];
      };
      user_verifications: {
        Row: {
          user_id: string;
          cpf_hash: string;
          cpf_masked: string;
          phone: string;
          phone_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { [k: string]: never };
        Update: { [k: string]: never };
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
      store_payment_accounts: {
        Row: {
          account_id: string;
          charges_enabled: boolean;
          created_at: string;
          details_submitted: boolean;
          payouts_enabled: boolean;
          provider: string;
          requirements_due: string[];
          store_id: string;
          updated_at: string;
          verified: boolean;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "store_payment_accounts_store_id_fkey"; columns: ["store_id"]; isOneToOne: true; referencedRelation: "stores"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          buyer_id: string;
          checkout_session_id: string | null;
          created_at: string;
          currency: string;
          destination_account: string;
          expires_at: string | null;
          failure_reason: string | null;
          fee_cents: number;
          id: string;
          needs_refund: boolean;
          net_cents: number;
          order_id: string;
          paid_at: string | null;
          payment_intent_id: string | null;
          provider: string;
          refunded_at: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          store_id: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "payments_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      submit_verification: { Args: { _cpf: string; _phone: string }; Returns: undefined };
      create_auction: {
        Args: {
          _product_id: string;
          _starting_cents: number;
          _increment_cents: number;
          _reserve_cents: number | null;
          _starts_at: string | null;
          _duration_minutes: number;
        };
        Returns: string;
      };
      cancel_auction: { Args: { _auction_id: string }; Returns: undefined };
      place_bid: { Args: { _auction_id: string; _amount_cents: number; _idempotency_key: string }; Returns: Json };
      confirm_auction_win: { Args: { _auction_id: string; _address_id: string }; Returns: string };
      my_auction_status: { Args: { _auction_id: string }; Returns: Json };
      my_bids: {
        Args: Record<string, never>;
        Returns: {
          auction_id: string;
          title: string;
          status: Database["public"]["Enums"]["auction_status"];
          outcome: string | null;
          ends_at: string;
          current_price_cents: number | null;
          my_max_cents: number;
          is_leader: boolean;
          is_winner: boolean;
          payment_due_at: string | null;
          order_id: string | null;
        }[];
      };
      cancel_order: { Args: { _order_id: string; _reason?: string }; Returns: undefined };
      checkout: { Args: { _address_id: string }; Returns: string[] };
      create_store: { Args: { _description?: string; _name: string; _slug: string }; Returns: string };
      platform_fee_bps: { Args: Record<string, never>; Returns: number };
      start_order_payment: { Args: { _order_id: string }; Returns: Json };
      attach_checkout_session: { Args: { _payment_id: string; _session_id: string }; Returns: undefined };
      register_payout_account: { Args: { _account_id: string }; Returns: string };
      stripe_ingest_event: { Args: { _payload: string; _signature: string }; Returns: Json };
      store_accepts_payments: { Args: { _store_id: string }; Returns: boolean };
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
      auction_status: "active" | "ended" | "cancelled";
      order_status: "pending_payment" | "paid" | "shipped" | "delivered" | "cancelled";
      payment_status: "created" | "processing" | "succeeded" | "failed" | "expired" | "refunded";
      product_condition: "new" | "used" | "refurbished";
      product_status: "draft" | "active" | "paused";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

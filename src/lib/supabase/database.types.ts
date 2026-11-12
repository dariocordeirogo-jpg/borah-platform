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
          live_id: string | null;
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
          coupon_code: string | null;
          discount_cents: number;
          shipping_service: "pac" | "sedex" | null;
          shipping_days: number | null;
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
          coupon_code?: string | null;
          discount_cents?: number;
          shipping_service?: "pac" | "sedex" | null;
          shipping_days?: number | null;
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
          blocked_reason: string | null;
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
          weight_grams: number;
        };
        Insert: {
          weight_grams?: number;
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
          is_test: boolean;
          name: string;
          origin_cep: string | null;
          owner_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          origin_cep?: string | null;
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
      affiliates: {
        Row: { user_id: string; code: string; is_active: boolean; created_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          store_id: string;
          code: string;
          kind: Database["public"]["Enums"]["coupon_kind"];
          percent_off: number | null;
          amount_off_cents: number | null;
          min_subtotal_cents: number;
          max_uses: number | null;
          uses_count: number;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      shipping_rates: {
        Row: {
          service: "pac" | "sedex";
          zone: "local" | "estadual" | "regional" | "nacional";
          max_grams: number;
          price_cents: number;
          days: number;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      coupon_redemptions: {
        Row: { coupon_id: string; user_id: string; order_id: string; discount_cents: number; created_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      affiliate_clicks: {
        Row: { user_id: string; day: string; clicks: number };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      affiliate_commissions: {
        Row: {
          id: string;
          order_id: string;
          order_number: number;
          affiliate_id: string;
          base_cents: number;
          rate_bps: number;
          amount_cents: number;
          status: Database["public"]["Enums"]["commission_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      videos: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          path: string;
          caption: string | null;
          status: Database["public"]["Enums"]["video_status"];
          views_count: number;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "videos_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
          { foreignKeyName: "videos_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      video_likes: {
        Row: { user_id: string; video_id: string; created_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      lives: {
        Row: {
          id: string;
          store_id: string;
          title: string;
          description: string | null;
          status: Database["public"]["Enums"]["live_status"];
          scheduled_at: string;
          started_at: string | null;
          ended_at: string | null;
          playback_url: string | null;
          pinned_product_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "lives_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
          { foreignKeyName: "lives_pinned_product_id_fkey"; columns: ["pinned_product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      live_products: {
        Row: { live_id: string; product_id: string; position: number };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "live_products_live_id_fkey"; columns: ["live_id"]; isOneToOne: false; referencedRelation: "lives"; referencedColumns: ["id"] },
          { foreignKeyName: "live_products_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      live_messages: {
        Row: { id: number; live_id: string; user_id: string; alias: string; body: string; hidden: boolean; created_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          kind: Database["public"]["Enums"]["report_kind"];
          target_id: string;
          reason: string;
          details: string | null;
          status: Database["public"]["Enums"]["report_status"];
          resolved_by: string | null;
          resolved_at: string | null;
          note: string | null;
          ai_triage: Json | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
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
      live_stream_ref: {
        Args: { _live_id: string }
        Returns: {
          disabled_at: string
          playback_id: string
          stream_id: string
        }[]
      }
      mark_live_stream_disabled: {
        Args: { _live_id: string }
        Returns: undefined
      }
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
      affiliate_program: { Args: Record<string, never>; Returns: Json };
      attach_live_stream: {
        Args: { _live_id: string; _playback_id: string; _stream_id: string }
        Returns: undefined
      }
      become_affiliate: { Args: Record<string, never>; Returns: string };
      track_referral: { Args: { _code: string }; Returns: boolean };
      place_order: {
        Args: { _address_id: string; _ref_code?: string | null; _coupon_code?: string | null; _shipping_service?: "pac" | "sedex" };
        Returns: string[];
      };
      quote_cart_shipping: { Args: { _address_id: string }; Returns: Json };
      admin_set_shipping_rate: {
        Args: { _service: string; _zone: string; _max_grams: number; _price_cents: number; _days: number };
        Returns: undefined;
      };
      check_coupon: { Args: { _code: string }; Returns: Json };
      create_coupon: {
        Args: {
          _code: string;
          _kind: Database["public"]["Enums"]["coupon_kind"];
          _value: number;
          _min_subtotal_cents?: number;
          _max_uses?: number | null;
          _starts_at?: string | null;
          _ends_at?: string | null;
        };
        Returns: string;
      };
      set_coupon_active: { Args: { _coupon_id: string; _active: boolean }; Returns: undefined };
      checkout_with_ref: { Args: { _address_id: string; _ref_code?: string | null }; Returns: string[] };
      create_video: { Args: { _product_id: string; _path: string; _caption?: string | null }; Returns: string };
      remove_video: { Args: { _video_id: string }; Returns: string };
      toggle_video_like: { Args: { _video_id: string }; Returns: Json };
      register_video_view: { Args: { _video_id: string }; Returns: undefined };
      create_live: { Args: { _title: string; _description: string | null; _scheduled_at: string; _product_ids: string[] }; Returns: string };
      set_live_playback: { Args: { _live_id: string; _url: string | null }; Returns: undefined };
      start_live: { Args: { _live_id: string }; Returns: undefined };
      end_live: { Args: { _live_id: string }; Returns: undefined };
      pin_live_product: { Args: { _live_id: string; _product_id: string | null }; Returns: undefined };
      start_live_auction: {
        Args: { _live_id: string; _product_id: string; _starting_cents: number; _increment_cents: number; _minutes: number };
        Returns: string;
      };
      send_live_message: { Args: { _live_id: string; _body: string }; Returns: number };
      hide_live_message: { Args: { _message_id: number }; Returns: undefined };
      report_content: {
        Args: { _kind: Database["public"]["Enums"]["report_kind"]; _target_id: string; _reason: string; _details?: string | null };
        Returns: string;
      };
      admin_overview: { Args: Record<string, never>; Returns: Json };
      admin_block_product: { Args: { _product_id: string; _reason: string }; Returns: undefined };
      admin_unblock_product: { Args: { _product_id: string }; Returns: undefined };
      admin_set_store_active: { Args: { _store_id: string; _active: boolean; _reason: string | null }; Returns: undefined };
      admin_remove_video: { Args: { _video_id: string; _reason: string }; Returns: undefined };
      admin_end_live: { Args: { _live_id: string; _reason: string }; Returns: undefined };
      admin_hide_message: { Args: { _message_id: number }; Returns: undefined };
      ai_take_quota: { Args: { _feature: "description" | "search" | "triage" }; Returns: boolean };
      admin_set_report_triage: { Args: { _report_id: string; _triage: Json }; Returns: undefined };
      admin_resolve_report: {
        Args: { _report_id: string; _status: Database["public"]["Enums"]["report_status"]; _note?: string | null };
        Returns: undefined;
      };
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
      commission_status: "pending" | "confirmed" | "cancelled";
      coupon_kind: "percent" | "fixed";
      video_status: "published" | "removed";
      live_status: "scheduled" | "live" | "ended" | "cancelled";
      report_kind: "product" | "video" | "live" | "store" | "message";
      report_status: "open" | "actioned" | "dismissed";
      product_condition: "new" | "used" | "refurbished";
      product_status: "draft" | "active" | "paused";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bar_inventory: {
        Row: {
          bar_menu_item_id: string | null
          category: string
          cost_price: number
          created_at: string
          id: string
          name: string
          notes: string | null
          quantity: number
          received_by_staff_id: string | null
          selling_price: number
          supplier_name: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          bar_menu_item_id?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          received_by_staff_id?: string | null
          selling_price?: number
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          bar_menu_item_id?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          received_by_staff_id?: string | null
          selling_price?: number
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_inventory_bar_menu_item_id_fkey"
            columns: ["bar_menu_item_id"]
            isOneToOne: false
            referencedRelation: "bar_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_menu_items: {
        Row: {
          category: string
          created_at: string
          id: string
          is_available: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      bar_order_items: {
        Row: {
          bar_menu_item_id: string | null
          bar_order_id: string
          cost_price: number
          created_at: string
          id: string
          item_name: string
          price: number
          quantity: number
        }
        Insert: {
          bar_menu_item_id?: string | null
          bar_order_id: string
          cost_price?: number
          created_at?: string
          id?: string
          item_name: string
          price: number
          quantity?: number
        }
        Update: {
          bar_menu_item_id?: string | null
          bar_order_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          item_name?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_order_items_bar_menu_item_id_fkey"
            columns: ["bar_menu_item_id"]
            isOneToOne: false
            referencedRelation: "bar_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_order_items_bar_order_id_fkey"
            columns: ["bar_order_id"]
            isOneToOne: false
            referencedRelation: "bar_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_orders: {
        Row: {
          amount_paid: number
          created_at: string
          debtor_name: string | null
          id: string
          is_debt: boolean
          notes: string | null
          order_number: number
          payment_method: string | null
          staff_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          debtor_name?: string | null
          id?: string
          is_debt?: boolean
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          staff_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          debtor_name?: string | null
          id?: string
          is_debt?: boolean
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          staff_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      cash_transfers: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          from_account: string
          id: string
          staff_id: string | null
          to_account: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          from_account: string
          id?: string
          staff_id?: string | null
          to_account: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          from_account?: string
          id?: string
          staff_id?: string | null
          to_account?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transfers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_bookings: {
        Row: {
          booking_date: string
          company_name: string | null
          created_at: string
          end_time: string
          guest_name: string
          id: string
          notes: string | null
          room_id: string
          staff_id: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          booking_date: string
          company_name?: string | null
          created_at?: string
          end_time: string
          guest_name: string
          id?: string
          notes?: string | null
          room_id: string
          staff_id?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          booking_date?: string
          company_name?: string | null
          created_at?: string
          end_time?: string
          guest_name?: string
          id?: string
          notes?: string | null
          room_id?: string
          staff_id?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "conference_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_rooms: {
        Row: {
          capacity: number
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_compensations: {
        Row: {
          added_by_staff_id: string | null
          amount: number
          created_at: string
          description: string | null
          employee_id: string | null
          employee_name: string
          id: string
          payment_date: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          added_by_staff_id?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          employee_id?: string | null
          employee_name: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          added_by_staff_id?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          employee_id?: string | null
          employee_name?: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensations_added_by_staff_id_fkey"
            columns: ["added_by_staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_departments: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department_role"]
          employee_id: string
          id: string
        }
        Insert: {
          created_at?: string
          department: Database["public"]["Enums"]["department_role"]
          employee_id: string
          id?: string
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department_role"]
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_departments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admin_secret_code: string | null
          created_at: string
          hotel_id: string | null
          id: string
          login_number: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          admin_secret_code?: string | null
          created_at?: string
          hotel_id?: string | null
          id?: string
          login_number: string
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          admin_secret_code?: string | null
          created_at?: string
          hotel_id?: string | null
          id?: string
          login_number?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          department: string
          description: string
          id: string
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          department: string
          description: string
          id?: string
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          department?: string
          description?: string
          id?: string
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          created_at: string
          email: string | null
          hotel_code: string
          hotel_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          hotel_code: string
          hotel_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          hotel_code?: string
          hotel_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          category: string
          created_at: string
          id: string
          min_quantity: number
          name: string
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          min_quantity?: number
          name: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          min_quantity?: number
          name?: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      laundry_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          notes: string | null
          quantity: number
          room_id: string | null
          staff_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          notes?: string | null
          quantity?: number
          room_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          notes?: string | null
          quantity?: number
          room_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_combos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category: string
          created_at: string
          id: string
          is_available: boolean
          name: string
          price: number
          requires_kitchen: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          price: number
          requires_kitchen?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          requires_kitchen?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string | null
          item_type: string | null
          menu_item_id: string | null
          notes: string | null
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name?: string | null
          item_type?: string | null
          menu_item_id?: string | null
          notes?: string | null
          order_id: string
          price: number
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string | null
          item_type?: string | null
          menu_item_id?: string | null
          notes?: string | null
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid: number
          chef_id: string | null
          created_at: string
          debtor_name: string | null
          id: string
          is_debt: boolean
          linked_order_id: string | null
          notes: string | null
          order_number: number
          payment_method: string | null
          status: string
          table_number: string | null
          total_amount: number
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          amount_paid?: number
          chef_id?: string | null
          created_at?: string
          debtor_name?: string | null
          id?: string
          is_debt?: boolean
          linked_order_id?: string | null
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          status?: string
          table_number?: string | null
          total_amount?: number
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          amount_paid?: number
          chef_id?: string | null
          created_at?: string
          debtor_name?: string | null
          id?: string
          is_debt?: boolean
          linked_order_id?: string | null
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          status?: string
          table_number?: string | null
          total_amount?: number
          updated_at?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_chef_id_fkey"
            columns: ["chef_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_recoveries: {
        Row: {
          created_at: string
          employee_id: string
          expires_at: string
          id: string
          new_staff_code: string
          phone: string
          verification_code: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          expires_at?: string
          id?: string
          new_staff_code: string
          phone: string
          verification_code: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          expires_at?: string
          id?: string
          new_staff_code?: string
          phone?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_recoveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_registrations: {
        Row: {
          created_at: string
          departments: string[]
          expires_at: string
          id: string
          name: string
          phone: string
          staff_code: string
          verification_code: string
        }
        Insert: {
          created_at?: string
          departments: string[]
          expires_at?: string
          id?: string
          name: string
          phone: string
          staff_code: string
          verification_code: string
        }
        Update: {
          created_at?: string
          departments?: string[]
          expires_at?: string
          id?: string
          name?: string
          phone?: string
          staff_code?: string
          verification_code?: string
        }
        Relationships: []
      }
      room_bookings: {
        Row: {
          amount_paid: number
          check_in_date: string
          checkout_date: string
          created_at: string
          debtor_name: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          notes: string | null
          payment_method: string | null
          price: number
          room_id: string
          staff_id: string | null
          trip_number: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          check_in_date: string
          checkout_date: string
          created_at?: string
          debtor_name?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          price: number
          room_id: string
          staff_id?: string | null
          trip_number?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          check_in_date?: string
          checkout_date?: string
          created_at?: string
          debtor_name?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          price?: number
          room_id?: string
          staff_id?: string | null
          trip_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          room_number: string
          room_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_number: string
          room_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          room_number?: string
          room_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplies: {
        Row: {
          amount_paid: number
          amount_to_pay: number
          category: string
          cleared_by_staff_id: string | null
          created_at: string
          delivery_number: number
          department: string
          description: string
          id: string
          notes: string | null
          paid_by_staff_id: string | null
          payment_date: string | null
          payment_method: string | null
          period: string
          quantity: number
          received_by_staff_id: string | null
          supplier_name: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          amount_to_pay?: number
          category?: string
          cleared_by_staff_id?: string | null
          created_at?: string
          delivery_number?: number
          department?: string
          description: string
          id?: string
          notes?: string | null
          paid_by_staff_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          period?: string
          quantity?: number
          received_by_staff_id?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          amount_to_pay?: number
          category?: string
          cleared_by_staff_id?: string | null
          created_at?: string
          delivery_number?: number
          department?: string
          description?: string
          id?: string
          notes?: string | null
          paid_by_staff_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          period?: string
          quantity?: number
          received_by_staff_id?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplies_cleared_by_staff_id_fkey"
            columns: ["cleared_by_staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplies_paid_by_staff_id_fkey"
            columns: ["paid_by_staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplies_received_by_staff_id_fkey"
            columns: ["received_by_staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      department_role:
        | "restaurant"
        | "kitchen"
        | "rooms"
        | "conference"
        | "accountant"
        | "admin"
        | "bar"
        | "bar_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      department_role: [
        "restaurant",
        "kitchen",
        "rooms",
        "conference",
        "accountant",
        "admin",
        "bar",
        "bar_admin",
      ],
    },
  },
} as const

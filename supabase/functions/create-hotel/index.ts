import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DepartmentRole =
  | "restaurant"
  | "kitchen"
  | "rooms"
  | "conference"
  | "bar"
  | "bar_admin"
  | "accountant"
  | "admin";

interface CreateHotelRequest {
  hotelName: string;
  adminEmail: string;
  phone?: string;
  domain: string;
  enabledDepartments: DepartmentRole[];
}

const PREFIX_MAP: Record<DepartmentRole, string> = {
  restaurant: "R",
  kitchen: "K",
  rooms: "H",
  conference: "C",
  admin: "AD",
  accountant: "AC",
  bar: "B",
  bar_admin: "BA",
};

function normalizeHostname(input: string): string {
  let value = (input || "").trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("#")[0];
  // strip port
  value = value.split(":")[0];
  // strip trailing dot
  value = value.replace(/\.+$/, "");
  return value;
}

function isValidHostname(hostname: string): boolean {
  // Basic sanity check. You can tighten later.
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(hostname);
}

async function generateUniqueHotelCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = Math.floor(Math.random() * 100).toString().padStart(2, "0");
    const { data } = await supabase
      .from("hotels")
      .select("id")
      .eq("hotel_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to allocate hotel code");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: CreateHotelRequest = await req.json();

    const hotelName = body.hotelName?.trim();
    const adminEmail = body.adminEmail?.trim();
    const phone = body.phone?.trim() || null;
    const hostname = normalizeHostname(body.domain);
    const enabledDepartments = Array.isArray(body.enabledDepartments)
      ? body.enabledDepartments
      : [];

    if (!hotelName || !adminEmail || !hostname) {
      return new Response(
        JSON.stringify({ error: "hotelName, adminEmail, and domain are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isValidHostname(hostname)) {
      return new Response(
        JSON.stringify({ error: "Invalid domain hostname" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (enabledDepartments.length === 0) {
      return new Response(
        JSON.stringify({ error: "Select at least one department" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Domain must be unique
    const { data: existingDomain } = await supabase
      .from("hotel_domains")
      .select("id")
      .ilike("hostname", hostname)
      .maybeSingle();

    if (existingDomain) {
      return new Response(
        JSON.stringify({ error: "This domain is already registered" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hotelCode = await generateUniqueHotelCode(supabase);

    const { data: hotel, error: hotelError } = await supabase
      .from("hotels")
      .insert({
        hotel_code: hotelCode,
        hotel_name: hotelName,
        email: adminEmail,
        phone,
        user_id: null,
      })
      .select("id, hotel_code, hotel_name")
      .single();

    if (hotelError || !hotel) {
      console.error("Failed to create hotel:", hotelError);
      return new Response(
        JSON.stringify({ error: "Failed to create hotel" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: domainError } = await supabase
      .from("hotel_domains")
      .insert({ hostname, hotel_id: hotel.id });

    if (domainError) {
      console.error("Failed to create hotel domain:", domainError);
      return new Response(
        JSON.stringify({ error: "Failed to attach domain to hotel" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allDepartments: DepartmentRole[] = [
      "restaurant",
      "kitchen",
      "rooms",
      "conference",
      "bar",
      "bar_admin",
      "accountant",
      "admin",
    ];

    const settingsRows = allDepartments.map((department) => ({
      hotel_id: hotel.id,
      department,
      enabled: enabledDepartments.includes(department),
      code_prefix: PREFIX_MAP[department],
      next_code: 1,
    }));

    const { error: settingsError } = await supabase
      .from("hotel_department_settings")
      .insert(settingsRows);

    if (settingsError) {
      console.error("Failed to seed department settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Hotel created but failed to seed departments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        hotel,
        hostname,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("create-hotel error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  verificationCode: string;
}

// Generate a 3-digit numeric secret code for admins (e.g., 212, 847)
const generateAdminSecretCode = (): string => {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { verificationCode }: VerifyRequest = await req.json();

    console.log("Received verification request:", { verificationCode });

    if (!verificationCode || verificationCode.length !== 6) {
      return new Response(
        JSON.stringify({ error: "Valid 6-digit verification code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find pending registration with this verification code
    const { data: pending, error: fetchError } = await supabase
      .from("pending_registrations")
      .select("*")
      .eq("verification_code", verificationCode)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (fetchError || !pending) {
      console.log("Pending registration not found or expired:", fetchError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found pending registration:", pending);

    // Check if this is an admin registration
    const department = pending.department || (pending.departments?.[0] ?? null);
    if (!department) {
      return new Response(
        JSON.stringify({ error: "No department found for this registration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pending.hotel_id) {
      return new Response(
        JSON.stringify({ error: "No hotelId found for this registration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = department === 'admin';
    const adminSecretCode = isAdmin ? generateAdminSecretCode() : null;

    // Allocate staff code per hotel + department (e.g., K01, AD12)
    const { data: allocatedCode, error: allocError } = await supabase
      .rpc('allocate_staff_code', { p_hotel_id: pending.hotel_id, p_department: department });

    if (allocError || !allocatedCode) {
      console.error('Error allocating staff code:', allocError);
      return new Response(
        JSON.stringify({ error: "Failed to allocate staff code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create employee record with optional admin_secret_code
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .insert({
        name: pending.name,
        phone: pending.phone,
        hotel_id: pending.hotel_id,
        login_number: allocatedCode,
        admin_secret_code: adminSecretCode,
      })
      .select()
      .single();

    if (employeeError) {
      console.error("Error creating employee:", employeeError);
      return new Response(
        JSON.stringify({ error: "Failed to create employee record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Created employee:", employee);

    // Create single department assignment
    const { error: deptError } = await supabase
      .from("employee_departments")
      .insert({ employee_id: employee.id, department });

    if (deptError) {
      console.error("Error creating department assignments:", deptError);
      // Don't fail the whole operation, employee is created
    }

    // Delete pending registration
    await supabase
      .from("pending_registrations")
      .delete()
      .eq("id", pending.id);

    console.log("Registration completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        staffCode: allocatedCode,
        adminSecretCode: adminSecretCode, // Will be null for non-admins
        message: "Registration completed successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-registration:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRecoveryRequest {
  verificationCode: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { verificationCode }: VerifyRecoveryRequest = await req.json();

    console.log("Received recovery verification request:", { verificationCode });

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

    // Find pending recovery with this verification code
    const { data: pending, error: fetchError } = await supabase
      .from("pending_recoveries")
      .select("*")
      .eq("verification_code", verificationCode)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (fetchError || !pending) {
      console.log("Pending recovery not found or expired:", fetchError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found pending recovery:", pending);

    // Update employee with new staff code
    const { data: employee, error: updateError } = await supabase
      .from("employees")
      .update({ login_number: pending.new_staff_code })
      .eq("id", pending.employee_id)
      .select("name")
      .single();

    if (updateError) {
      console.error("Error updating employee:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update staff code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Updated employee with new code:", employee);

    // Delete pending recovery
    await supabase
      .from("pending_recoveries")
      .delete()
      .eq("id", pending.id);

    console.log("Recovery completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        staffCode: pending.new_staff_code,
        employeeName: employee?.name,
        message: "Staff code recovered successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-recovery:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

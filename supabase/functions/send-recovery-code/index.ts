import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const adminEmail = Deno.env.get("ADMIN_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecoveryRequest {
  phone: string;
}

// Generate a new staff code (letter + 2 digits)
function generateStaffCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letter = letters[Math.floor(Math.random() * letters.length)];
  const numbers = Math.floor(Math.random() * 90 + 10).toString();
  return letter + numbers;
}

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone }: RecoveryRequest = await req.json();

    console.log("Received recovery request for phone:", phone);

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find employee with this phone number
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, name, phone")
      .eq("phone", phone)
      .single();

    if (employeeError || !employee) {
      console.log("Employee not found for phone:", phone);
      return new Response(
        JSON.stringify({ error: "No staff account found with this phone number" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found employee:", employee.name);

    // Generate new staff code (ensure unique)
    let newStaffCode = generateStaffCode();
    let codeExists = true;
    let attempts = 0;

    while (codeExists && attempts < 50) {
      const { data: existingEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("login_number", newStaffCode)
        .single();

      const { data: existingRecovery } = await supabase
        .from("pending_recoveries")
        .select("id")
        .eq("new_staff_code", newStaffCode)
        .single();

      if (!existingEmployee && !existingRecovery) {
        codeExists = false;
      } else {
        newStaffCode = generateStaffCode();
        attempts++;
      }
    }

    const verificationCode = generateVerificationCode();

    // Clean up expired recovery requests
    await supabase
      .from("pending_recoveries")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Delete any existing recovery request for this employee
    await supabase
      .from("pending_recoveries")
      .delete()
      .eq("employee_id", employee.id);

    // Insert new recovery request
    const { error: insertError } = await supabase
      .from("pending_recoveries")
      .insert({
        employee_id: employee.id,
        phone: phone,
        verification_code: verificationCode,
        new_staff_code: newStaffCode,
      });

    if (insertError) {
      console.error("Error inserting recovery request:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create recovery request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email to admin
    const emailResponse = await resend.emails.send({
      from: "Enaitoti Hotel <onboarding@resend.dev>",
      to: [adminEmail!],
      subject: `Staff Code Recovery Request - ${employee.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            Staff Code Recovery Request
          </h1>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #555;">Staff Details</h2>
            <p><strong>Name:</strong> ${employee.name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>New Staff Code:</strong> <span style="font-size: 1.2em; color: #4CAF50; font-weight: bold;">${newStaffCode}</span></p>
          </div>
          
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #1976D2;">Verification Code</h2>
            <p style="font-size: 2em; font-weight: bold; color: #1976D2; letter-spacing: 5px; text-align: center;">
              ${verificationCode}
            </p>
            <p style="color: #666; text-align: center; margin-bottom: 0;">
              Share this code with the staff member to complete recovery
            </p>
          </div>
          
          <p style="color: #999; font-size: 0.9em;">
            This code expires in 15 minutes.
          </p>
        </div>
      `,
    });

    console.log("Recovery email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Recovery code sent to admin for verification",
        employeeName: employee.name
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-recovery-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

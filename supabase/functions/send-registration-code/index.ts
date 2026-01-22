import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const adminEmail = Deno.env.get("ADMIN_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationRequest {
  name: string;
  phone: string;
  department: string;
  hotelId: string;
}

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, phone, department, hotelId }: RegistrationRequest = await req.json();

    console.log("Received registration request:", { name, phone, department, hotelId });

    if (!name || !phone || !department || !hotelId) {
      return new Response(
        JSON.stringify({ error: "Name, phone, hotelId, and department are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const verificationCode = generateVerificationCode();

    console.log("Generated verification code:", { verificationCode });

    // Clean up expired pending registrations
    await supabase
      .from("pending_registrations")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Store pending registration
    const { error: insertError } = await supabase
      .from("pending_registrations")
      .insert({
        name,
        phone,
        departments: [department],
        department,
        hotel_id: hotelId,
        verification_code: verificationCode,
        staff_code: null,
      });

    if (insertError) {
      console.error("Error inserting pending registration:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create pending registration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve admin email from hotel record (fallback to function env ADMIN_EMAIL)
    const { data: hotel } = await supabase
      .from('hotels')
      .select('id, hotel_name, email')
      .eq('id', hotelId)
      .maybeSingle();

    const resolvedAdminEmail = (hotel?.email || adminEmail)?.trim();
    if (!resolvedAdminEmail) {
      return new Response(
        JSON.stringify({ error: "No admin email configured for this hotel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email to admin
    const emailResponse = await resend.emails.send({
      from: "Enaitoti Hotel <onboarding@resend.dev>",
      to: [resolvedAdminEmail],
      subject: `New Staff Registration - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
            New Staff Registration Request
          </h1>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #4F46E5; margin-top: 0;">Staff Details</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Department:</strong> ${department}</p>
          </div>
          
          <div style="background: #4F46E5; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;">Verification Code</p>
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 10px 0;">
              ${verificationCode}
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This verification code expires in <strong>15 minutes</strong>.
          </p>
          <p style="color: #666; font-size: 14px;">Once verified, a staff code will be assigned automatically.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            Enaitoti Hotel Staff Management System
          </p>
        </div>
      `,
    });

    console.log("Email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification code sent to admin" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-registration-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, message } = await req.json();

    const htmlContent = `
  <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 30px; color: #333;">
    <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="padding: 20px; background-color: #4f46e5; color: white; text-align: center;">
        <img src="https://drive.google.com/uc?export=view&id=1oJqm6Vdw9n-S2XueF9qrwEMWZ919pyiq" alt="MediBot Logo" style="height: 50px;" />
        <h2 style="margin-top: 10px;">Medication Reminder</h2>
      </div>
      <div style="padding: 20px;">
        <p>Dear Patient,</p>
        <p>${message}</p>
        <p style="margin-top: 20px;">Please ensure timely intake of your medication to maintain good health.</p>
        <p>— <strong>MediBot Team</strong></p>
      </div>
      <div style="padding: 15px; font-size: 12px; text-align: center; color: #888; background-color: #f1f1f1;">
        This is an automated reminder from MediBot. Please do not reply to this email.
      </div>
    </div>
  </div>
`;


    const { data, error } = await resend.emails.send({
      from: "MediBot <onboarding@resend.dev>",
      to,
      subject,
      html: htmlContent,
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Email sent successfully", data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

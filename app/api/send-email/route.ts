import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, message } = await req.json();

    const htmlContent = `...`; // HTML template

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
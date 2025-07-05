import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, message } = await req.json();

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${subject}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #f4f6f8;
            font-family: Arial, sans-serif;
            color: #333;
          }
          .email-wrapper {
            width: 100%;
            height: 100%;
          }
          .email-container {
            background-color: #ffffff;
            max-width: 600px;
            width: 100%;
            padding: 40px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          .header {
            background-color: #4f46e5;
            padding: 40px 0;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
          }
          .header img {
            width: 120px;
          }
          .icon {
            font-size: 60px;
            color: #4f46e5;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 22px;
            margin-bottom: 16px;
            color: #222;
          }
          p {
            font-size: 16px;
            margin: 8px 0;
          }
          .code {
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0;
            color: #4f46e5;
            letter-spacing: 1px;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #999;
            margin-top: 30px;
          }
          .footer a {
            color: #4f46e5;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <table class="email-wrapper" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" valign="middle">
              <div class="email-container">
                <div class="header">
                  <img src="/Asvix.jpg" alt="MediBot Logo" />
                </div>
                <div class="icon">🔒</div>
                <h1>Hi ${to?.split("@")[0] || "User"},</h1>
                <p>Here's the Remiander you requested:</p>
                <div class="code">${message}</div>
                <p>If you didn't request this, you can ignore this email or contact us.</p>
                <p>Thanks,<br />The MediBot Team</p>
                <div class="footer">
                  © ${new Date().getFullYear()} MediBot. All rights reserved.<br />
                  <a href="https://yourdomain.com/contact">Contact Us</a>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "MediBot <onboarding@resend.dev>",
      to,
      subject,
      html: htmlContent,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      data,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

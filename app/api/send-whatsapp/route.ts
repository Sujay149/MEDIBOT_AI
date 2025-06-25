import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { to, message } = await request.json()

    if (!to || !message) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: to, message" },
        { status: 400 }
      )
    }

    // WhatsApp Cloud API endpoint
    const url = `https://graph.facebook.com/v20.0/YOUR_PHONE_NUMBER_ID/messages`
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "YOUR_ACCESS_TOKEN"

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: {
          body: message,
        },
      }),
    })

    const result = await response.json()

    if (!response.ok || result.error) {
      throw new Error(result.error?.message || "Failed to send WhatsApp message")
    }

    return NextResponse.json({ success: true, message: "WhatsApp message sent successfully" })
  } catch (error) {
    console.error("Error in WhatsApp API:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
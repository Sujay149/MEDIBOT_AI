import { type NextRequest, NextResponse } from "next/server"

// Uncomment and configure for production with Twilio
// import twilio from 'twilio'
// const client = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// )

export async function POST(request: NextRequest) {
  try {
    const { to, body } = await request.json()

    if (!to || !body) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(to.replace(/[\s\-$$$$]/g, ""))) {
      return NextResponse.json({ success: false, error: "Invalid phone number format" }, { status: 400 })
    }

    // Production: Use Twilio
    if (process.env.NODE_ENV === "production" && process.env.TWILIO_ACCOUNT_SID) {
      // Uncomment for production use:
      /*
      const message = await client.messages.create({
        body: body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      })

      return NextResponse.json({
        success: true,
        messageId: message.sid,
      })
      */
    }

    // Development: Log and return success
    console.log("📱 SMS API Call (Demo Mode):")
    console.log(`To: ${to}`)
    console.log(`Body: ${body}`)
    console.log("---")

    return NextResponse.json({
      success: true,
      messageId: "demo_" + Date.now(),
    })
  } catch (error) {
    console.error("SMS API Error:", error)
    return NextResponse.json({ success: false, error: "Failed to send SMS" }, { status: 500 })
  }
}

interface SMSMessage {
  to: string
  body: string
}

interface SMSResponse {
  success: boolean
  messageId?: string
  error?: string
}

class SMSService {
  private isProduction = process.env.NODE_ENV === "production"

  // Validate phone number format
  validatePhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    return phoneRegex.test(phoneNumber.replace(/[\s\-$$$$]/g, ""))
  }

  // Format phone number to E.164 format
  formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[\s\-$$$$]/g, "")
    if (cleaned.startsWith("+")) {
      return cleaned
    }
    // Default to US format if no country code
    return `+1${cleaned}`
  }

  // Send SMS using Twilio (production) or console log (development)
  async sendSMS(message: SMSMessage): Promise<boolean> {
    try {
      if (!this.validatePhoneNumber(message.to)) {
        console.error("Invalid phone number:", message.to)
        return false
      }

      const formattedNumber = this.formatPhoneNumber(message.to)

      if (this.isProduction) {
        // Production: Use Twilio
        const response = await fetch("/api/send-sms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: formattedNumber,
            body: message.body,
          }),
        })

        const result = await response.json()
        return result.success
      } else {
        // Development: Log to console
        console.log("📱 SMS Reminder (Demo Mode):")
        console.log(`To: ${formattedNumber}`)
        console.log(`Message: ${message.body}`)
        console.log("---")
        return true
      }
    } catch (error) {
      console.error("Error sending SMS:", error)
      return false
    }
  }

  // Send medication reminder SMS
  async sendMedicationReminder(
    phoneNumber: string,
    medicationName: string,
    dosage: string,
    time: string,
  ): Promise<boolean> {
    const message = {
      to: phoneNumber,
      body: `💊 Medication Reminder: Time to take your ${medicationName} (${dosage}) at ${time}. Stay healthy! 🌟`,
    }

    return this.sendSMS(message)
  }

  // Send appointment reminder SMS
  async sendAppointmentReminder(
    phoneNumber: string,
    doctorName: string,
    hospitalName: string,
    date: string,
    time: string,
  ): Promise<boolean> {
    const message = {
      to: phoneNumber,
      body: `🏥 Appointment Reminder: You have an appointment with Dr. ${doctorName} at ${hospitalName} on ${date} at ${time}. Don't forget! 📅`,
    }

    return this.sendSMS(message)
  }
}

export const smsService = new SMSService()

"use client"

import { useEffect, useCallback } from "react"
import { smsService } from "@/lib/sms-service"
import { useAuth } from "@/hooks/useAuth"

interface ScheduledSMS {
  id: string
  userId: string
  medicationId: string
  medicationName: string
  dosage: string
  phoneNumber: string
  reminderTimes: string[]
  isActive: boolean
}

export function useSMSScheduler() {
  const { user } = useAuth()

  // Schedule SMS reminders for a medication
  const scheduleMedicationSMS = useCallback(
    async (
      userId: string,
      medicationId: string,
      medicationName: string,
      dosage: string,
      phoneNumber: string,
      reminderTimes: string[],
    ) => {
      try {
        // Store the SMS schedule in localStorage for demo purposes
        // In production, this would be stored in Firestore
        const scheduleKey = `sms_schedule_${medicationId}`
        const schedule: ScheduledSMS = {
          id: medicationId,
          userId,
          medicationId,
          medicationName,
          dosage,
          phoneNumber,
          reminderTimes,
          isActive: true,
        }

        localStorage.setItem(scheduleKey, JSON.stringify(schedule))

        // Schedule the actual SMS reminders
        reminderTimes.forEach((time) => {
          scheduleNextSMS(schedule, time)
        })

        console.log(`SMS reminders scheduled for ${medicationName} at times:`, reminderTimes)
      } catch (error) {
        console.error("Error scheduling SMS reminders:", error)
        throw error
      }
    },
    [],
  )

  // Schedule the next SMS for a specific time
  const scheduleNextSMS = useCallback((schedule: ScheduledSMS, time: string) => {
    const now = new Date()
    const [hours, minutes] = time.split(":").map(Number)

    // Calculate next occurrence of this time
    const nextReminder = new Date()
    nextReminder.setHours(hours, minutes, 0, 0)

    // If the time has passed today, schedule for tomorrow
    if (nextReminder <= now) {
      nextReminder.setDate(nextReminder.getDate() + 1)
    }

    const timeUntilReminder = nextReminder.getTime() - now.getTime()

    setTimeout(async () => {
      // Send the SMS
      const success = await smsService.sendMedicationReminder(
        schedule.phoneNumber,
        schedule.medicationName,
        schedule.dosage,
        time,
      )

      if (success) {
        console.log(`SMS reminder sent for ${schedule.medicationName} at ${time}`)
      }

      // Schedule the next occurrence (24 hours later)
      if (schedule.isActive) {
        scheduleNextSMS(schedule, time)
      }
    }, timeUntilReminder)

    console.log(`Next SMS for ${schedule.medicationName} scheduled for:`, nextReminder.toLocaleString())
  }, [])

  // Initialize SMS scheduler when user logs in
  useEffect(() => {
    if (!user) return

    // Load existing SMS schedules from localStorage
    // In production, this would load from Firestore
    const loadExistingSchedules = () => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith("sms_schedule_")) {
          try {
            const schedule = JSON.parse(localStorage.getItem(key) || "{}") as ScheduledSMS
            if (schedule.userId === user.uid && schedule.isActive) {
              // Reschedule SMS reminders
              schedule.reminderTimes.forEach((time) => {
                scheduleNextSMS(schedule, time)
              })
            }
          } catch (error) {
            console.error("Error loading SMS schedule:", error)
          }
        }
      }
    }

    loadExistingSchedules()
  }, [user, scheduleNextSMS])

  // Cancel SMS reminders for a medication
  const cancelMedicationSMS = useCallback((medicationId: string) => {
    const scheduleKey = `sms_schedule_${medicationId}`
    const existingSchedule = localStorage.getItem(scheduleKey)

    if (existingSchedule) {
      const schedule = JSON.parse(existingSchedule) as ScheduledSMS
      schedule.isActive = false
      localStorage.setItem(scheduleKey, JSON.stringify(schedule))
    }
  }, [])

  return {
    scheduleMedicationSMS,
    cancelMedicationSMS,
  }
}

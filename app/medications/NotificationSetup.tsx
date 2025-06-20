import { useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { getToken } from "firebase/messaging"
import { doc, setDoc } from "firebase/firestore"
import { messaging, db } from "@/lib/firebase"

export function NotificationSetup() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user || !messaging) return

    const setupNotifications = async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission === "granted") {
          const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY })
          await setDoc(doc(db, "users", user.uid), { fcmToken: token }, { merge: true })
        }
      } catch (error) {
        console.log("Error setting up notifications:", error)
      }
    }

    setupNotifications()
  }, [user])

  return null
}
import type { NextApiRequest, NextApiResponse } from "next"
import admin from "firebase-admin"

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { token, notification } = req.body

  try {
    await admin.messaging().send({
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
      },
    })
    res.status(200).json({ success: true })
  } catch (error) {
    console.log("Error sending notification:", error)
    res.status(500).json({ error: "Failed to send notification" })
  }
}
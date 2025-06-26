"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Menu, Activity, Pill, MessageSquare, TrendingUp, Plus } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import {
  getUserHealthRecords,
  subscribeToUserChatSessions,
  subscribeToUserMedications,
  createSampleHealthRecord,
  type ChatSession,
  type Medication,
  type HealthRecord,
} from "@/lib/firestore"
import Link from "next/link"
import { toast } from "sonner"
import Image from "next/image"

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const { user, userProfile } = useAuth()

  useEffect(() => {
    if (!user) return

    setLoading(true)

    const unsubscribeChats = subscribeToUserChatSessions(user.uid, (sessions) => {
      setChatSessions(sessions)
      setLoading(false)
    })

    const unsubscribeMedications = subscribeToUserMedications(user.uid, (meds) => {
      setMedications(meds)
    })

    const loadHealthRecords = async () => {
      try {
        const records = await getUserHealthRecords(user.uid)
        setHealthRecords(records)
      } catch (error) {
        console.error("Error loading health records:", error)
        try {
          await createSampleHealthRecord(user.uid)
          const records = await getUserHealthRecords(user.uid)
          setHealthRecords(records)
        } catch (sampleError) {
          console.error("Error creating sample record:", sampleError)
          setHealthRecords([])
        }
      }
    }

    loadHealthRecords()

    return () => {
      unsubscribeChats()
      unsubscribeMedications()
    }
  }, [user])

  const totalMessages = chatSessions.reduce((total, session) => {
    return total + (session.messages && Array.isArray(session.messages) ? session.messages.length : 0)
  }, 0)

  const activeMedications = medications.filter((med) => med.isActive).length

  const recentActivity = chatSessions
    .flatMap((session) =>
      session.messages && Array.isArray(session.messages)
        ? session.messages.map((msg) => ({
            ...msg,
            sessionTitle: session.title,
          }))
        : [],
    )
    .sort((a, b) => {
      const getSeconds = (t: Date | { seconds: number }) =>
        t instanceof Date ? t.getTime() / 1000 : t.seconds
      return getSeconds(b.timestamp) - getSeconds(a.timestamp)
    })
    .slice(0, 5)

  const calculateHealthScore = () => {
    let score = 50
    if (chatSessions.length > 0) score += 20
    if (medications.length > 0) score += 15
    if (healthRecords.length > 0) score += 15
    return Math.min(score, 100)
  }

  const handleCreateSampleData = async () => {
    if (!user) return

    try {
      await createSampleHealthRecord(user.uid)
      toast.success("Sample health record created!")
      const records = await getUserHealthRecords(user.uid)
      setHealthRecords(records)
    } catch (error) {
      console.error("Error creating sample data:", error)
      toast.error("Failed to create sample data")
    }
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-muted">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-muted-foreground"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="Medibot Icon"
                  width={29}
                  height={29}
                  className="object-cover rounded-full"
                />
              </div>
              <span className="font-semibold">{userProfile?.displayName || "User"}'s Dashboard</span>
            </div>
          </div>

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  Welcome back, {userProfile?.displayName || "User"}!
                </h1>
                <p className="text-muted-foreground">Here's your health overview for today</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Chat Sessions</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl sm:text-2xl font-bold">{chatSessions.length}</div>
                    <p className="text-xs text-muted-foreground">{totalMessages} total messages</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Medications</CardTitle>
                    <Pill className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl sm:text-2xl font-bold">{activeMedications}</div>
                    <p className="text-xs text-muted-foreground">
                      {activeMedications > 0 ? "Active medications" : "No medications"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Health Score</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl sm:text-2xl font-bold text-green-500">{calculateHealthScore()}</div>
                    <p className="text-xs text-muted-foreground">
                      {calculateHealthScore() >= 80 ? "Excellent" : calculateHealthScore() >= 60 ? "Good" : "Needs attention"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Health Records</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl sm:text-2xl font-bold">{healthRecords.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {healthRecords.length > 0 ? "Records tracked" : "No records yet"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/chat">
                      <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white h-12">
                        Start New Chat
                      </Button>
                    </Link>
                    <Link href="/medications">
                      <Button variant="outline" className="w-full h-12">
                        Add Medication
                      </Button>
                    </Link>
                    <Link href="/summarizer">
                      <Button variant="outline" className="w-full h-12">
                        Search Medical Info
                      </Button>
                    </Link>
                    <Link href="/appointments">
                      <Button onClick={handleCreateSampleData} variant="outline" className="w-full h-12">
                        <Plus className="mr-2 h-4 w-4" />Appointments Record
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-muted-foreground">Loading activity...</p>
                    </div>
                  ) : recentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm block truncate">{activity.message}</span>
                            <span className="text-xs text-muted-foreground">
                              in {activity.sessionTitle} • {activity.timestamp instanceof Date
                                ? activity.timestamp.toLocaleDateString()
                                : activity.timestamp?.toDate()?.toLocaleDateString() || "Recently"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">No recent activity</p>
                      <p className="text-sm text-muted-foreground">Start a conversation to see your activity here</p>
                      <Link href="/chat">
                        <Button className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                          Start Your First Chat
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
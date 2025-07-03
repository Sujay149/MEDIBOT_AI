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
  const [isMobile, setIsMobile] = useState(false)
  const { user, userProfile } = useAuth()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  const formatDate = (timestamp: Date | { seconds: number }) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp.seconds * 1000)
    return isMobile 
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Responsive Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-card sticky top-0 z-10">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden text-muted-foreground h-9 w-9 sm:h-10 sm:w-10"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="Medibot Icon"
                  width={28}
                  height={28}
                  className="object-cover rounded-full"
                />
              </div>
              <span className="font-semibold text-sm sm:text-base text-foreground truncate max-w-[120px] sm:max-w-none">
                {userProfile?.displayName || "User"}'s Dashboard
              </span>
            </div>
          </div>

          <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
              {/* Responsive Title */}
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 text-foreground">
                  Welcome back, {userProfile?.displayName || "User"}!
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Here's your health overview</p>
              </div>

              {/* Responsive Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-foreground">Chats</CardTitle>
                    <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">{chatSessions.length}</div>
                    <p className="text-xs text-muted-foreground">{totalMessages} messages</p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-foreground">Meds</CardTitle>
                    <Pill className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">{activeMedications}</div>
                    <p className="text-xs text-muted-foreground">
                      {activeMedications > 0 ? "Active" : "None"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-foreground">Health</CardTitle>
                    <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-500">{calculateHealthScore()}</div>
                    <p className="text-xs text-muted-foreground">
                      {calculateHealthScore() >= 80 ? "Great" : "Needs attention"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-foreground">Records</CardTitle>
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">{healthRecords.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {healthRecords.length > 0 ? "Tracked" : "None"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Responsive Quick Actions */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-sm sm:text-base md:text-lg font-semibold text-foreground">
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    <Link href="/chat">
                      <Button className="w-full h-9 sm:h-10 md:h-12 text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                        {isMobile ? "Chat" : "New Chat"}
                      </Button>
                    </Link>
                    <Link href="/medications">
                      <Button variant="outline" className="w-full h-9 sm:h-10 md:h-12 text-xs sm:text-sm">
                        {isMobile ? "Meds" : "Add Meds"}
                      </Button>
                    </Link>
                    <Link href="/summarizer">
                      <Button variant="outline" className="w-full h-9 sm:h-10 md:h-12 text-xs sm:text-sm">
                        {isMobile ? "Search" : "Medical Info"}
                      </Button>
                    </Link>
                    <Button 
                      onClick={handleCreateSampleData} 
                      variant="outline" 
                      className="w-full h-9 sm:h-10 md:h-12 text-xs sm:text-sm"
                    >
                      {isMobile ? "Records" : "Appointments"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Responsive Recent Activity */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-sm sm:text-base md:text-lg font-semibold text-foreground">
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                  {loading ? (
                    <div className="text-center py-4 sm:py-6">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Loading activity...</p>
                    </div>
                  ) : recentActivity.length > 0 ? (
                    <div className="space-y-2 sm:space-y-3">
                      {recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-start space-x-2 sm:space-x-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                          <div className="w-2 h-2 mt-2 sm:mt-3 bg-purple-600 rounded-full flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-foreground line-clamp-1 sm:line-clamp-2">
                              {activity.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              in {activity.sessionTitle} • {formatDate(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 sm:py-6">
                      <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm sm:text-base text-muted-foreground mb-1">No recent activity</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3">Start a conversation to see activity</p>
                      <Link href="/chat">
                        <Button className="h-9 sm:h-10 text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                          Start Chat
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
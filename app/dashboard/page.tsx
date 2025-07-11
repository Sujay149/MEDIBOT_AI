"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Menu, Activity, Pill, MessageSquare, TrendingUp, Plus, ArrowRight, ChevronRight, Calendar } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import {
  getUserHealthRecords,
  subscribeToUserChatSessions,
  type ChatSession,
  type Medication,
  type HealthRecord,
} from "@/lib/firestore"
import Link from "next/link"
import { toast } from "sonner"
import Image from "next/image"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

function formatDate(timestamp: Date | { seconds: number }) {
  let date: Date
  if (timestamp instanceof Date) {
    date = timestamp
  } else if (timestamp && typeof timestamp.seconds === "number") {
    date = new Date(timestamp.seconds * 1000)
  } else {
    return ""
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

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

    setMedications([])
    const unsubscribeMedications = () => {};

    const loadHealthRecords = async () => {
      try {
        const records = await getUserHealthRecords(user.uid)
        setHealthRecords(records)
      } catch (error) {
        console.error("Error loading health records:", error)
        setHealthRecords([])
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
    toast.error("Sample health record creation is not available.")
  }

  const healthScore = calculateHealthScore()
  const healthStatus = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : "Needs Improvement"

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Enhanced Header with Gradient Background */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gradient-to-r from-primary/10 via-background to-background sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden text-muted-foreground hover:bg-primary/10"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="Medibot Icon"
                    width={36}
                    height={36}
                    className="object-cover rounded-full"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background"></div>
              </div>
              <div>
                <h1 className="font-semibold text-sm sm:text-base text-foreground">
                  {userProfile?.displayName || "User"}'s Dashboard
                </h1>
                <p className="text-xs text-muted-foreground">Last active: Today</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="hidden sm:flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Active</span>
              </Badge>
            </div>
          </div>

          <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-gradient-to-b from-background to-muted/10">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Welcome Section with Improved Typography */}
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                  Welcome back, <span className="text-primary">{userProfile?.displayName || "User"}</span>!
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Here's your personalized health overview for today
                </p>
              </div>

              {/* Stats Grid with Improved Cards */}
             {/* Stats Grid with Improved Cards and Hover Effects */}
<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
  <Card className="hover:shadow-md transition-all duration-300 hover:border-primary/30 hover:scale-[1.02] group">
    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Chat Sessions
      </CardTitle>
      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
        <MessageSquare className="h-4 w-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
        {chatSessions.length}
      </div>
      <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80 transition-colors">
        {totalMessages} total messages
      </p>
    </CardContent>
  </Card>

  <Card className="hover:shadow-md transition-all duration-300 hover:border-primary/30 hover:scale-[1.02] group">
    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Active Medications
      </CardTitle>
      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
        <Pill className="h-4 w-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
        {activeMedications}
      </div>
      <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80 transition-colors">
        {activeMedications > 0 ? "Currently taking" : "No medications"}
      </p>
    </CardContent>
  </Card>

  <Card className="hover:shadow-md transition-all duration-300 hover:border-primary/30 hover:scale-[1.02] group">
    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Health Score
      </CardTitle>
      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
        <Activity className="h-4 w-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <div className="flex items-end gap-2">
        <div className="text-2xl font-bold group-hover:text-primary transition-colors" style={{
          color: healthScore >= 80 ? '#10B981' : healthScore >= 60 ? '#F59E0B' : '#EF4444'
        }}>
          {healthScore}
        </div>
        <span className="text-xs text-muted-foreground mb-1 group-hover:text-foreground/80 transition-colors">{healthStatus}</span>
      </div>
      <Progress value={healthScore} className="h-2 mt-2 bg-muted group-hover:bg-muted/80 transition-colors" />
    </CardContent>
  </Card>

  <Card className="hover:shadow-md transition-all duration-300 hover:border-primary/30 hover:scale-[1.02] group">
    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Health Records
      </CardTitle>
      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
        <TrendingUp className="h-4 w-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
        {healthRecords.length}
      </div>
      <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80 transition-colors">
        {healthRecords.length > 0 ? "Documents available" : "No records yet"}
      </p>
    </CardContent>
  </Card>
</div>

{/* Quick Actions Card with Hover Effects */}
<Card className="border-primary/20 hover:shadow-lg hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5">
  {/* ... card content remains the same ... */}
</Card>

{/* Recent Activity Card with Hover Effects */}
<Card className="border-primary/20 hover:shadow-lg hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5">
  {/* ... card content remains the same ... */}
</Card>

              {/* Quick Actions with Improved Visual Hierarchy */}
              {/* Quick Actions with Improved Visual Hierarchy */}
<Card className="border-primary/20 hover:shadow-md transition-all">
  <CardHeader className="p-4 pb-2">
    <CardTitle className="text-lg font-semibold text-foreground">
      Quick Actions
    </CardTitle>
    <CardDescription className="text-sm text-muted-foreground">
      Manage your health in one click
    </CardDescription>
  </CardHeader>
  <CardContent className="p-4 pt-0">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Link href="/chat">
        <Button
          variant="outline"
          className="w-full h-12 group flex flex-col items-center justify-center gap-1 border-primary/30 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <MessageSquare className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-xs sm:text-sm text-foreground">New Chat</span>
        </Button>
      </Link>
      <Link href="/medications">
        <Button
          variant="outline"
          className="w-full h-12 group flex flex-col items-center justify-center gap-1 border-primary/30 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Pill className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-xs sm:text-sm text-foreground">Add Meds</span>
        </Button>
      </Link>
      <Link href="/summarizer">
        <Button
          variant="outline"
          className="w-full h-12 group flex flex-col items-center justify-center gap-1 border-primary/30 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Activity className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-xs sm:text-sm text-foreground">Medical Info</span>
        </Button>
      </Link>
      <Link href="/appointments">
  <Button
    variant="outline"
    className="w-full h-12 group flex flex-col items-center justify-center gap-1 border-primary/30 hover:border-primary hover:bg-primary/5 transition-colors"
  >
    <Calendar className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
    <span className="text-xs sm:text-sm text-foreground">Appointments</span>
  </Button>
</Link>
    </div>
  </CardContent>
</Card>

              {/* Recent Activity with Enhanced Design */}
              <Card className="border-primary/20 hover:shadow-md transition-all">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold text-foreground">
                        Recent Activity
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        Your latest interactions with MediBot
                      </CardDescription>
                    </div>
                    <Link href="/history">
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                        View All <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <p className="text-sm text-muted-foreground">Loading your activity...</p>
                    </div>
                  ) : recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((activity, index) => (
                        <div 
                          key={index} 
                          className="flex items-start p-3 hover:bg-muted/30 rounded-lg transition-colors group"
                        >
                          <div className="relative mt-1 flex-shrink-0">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-0 group-hover:opacity-40"></div>
                          </div>
                          <div className="ml-3 flex-1 min-w-0">
                            <p className="text-sm text-foreground line-clamp-2">
                              {activity.message}
                            </p>
                            <div className="flex items-center mt-1 text-xs text-muted-foreground">
                              <span className="truncate">in {activity.sessionTitle}</span>
                              <span className="mx-2">•</span>
                              <span>{formatDate(activity.timestamp)}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary ml-2 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-sm font-medium text-foreground">No recent activity</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Start a conversation to see your activity here
                        </p>
                      </div>
                      <Link href="/chat">
                        <Button className="h-9 px-6 bg-primary hover:bg-primary/90 text-primary-foreground">
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
"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  MessageCircle,
  FileText,
  Pill,
  History,
  User,
  Moon,
  Sun,
  LogOut,
  Calendar
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true }: SidebarProps) {
  const pathname = usePathname()
  const { user, userProfile, logout } = useAuth()

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const menuItems = [
    { icon: MessageCircle, label: "AI Chatbot", href: "/chat" },
    { icon: FileText, label: "Info Summarizer", href: "/summarizer" },
    { icon: Calendar, label: "Appointments", href: "/appointments" },
    { icon: Pill, label: "Medications", href: "/medications" },
    { icon: History, label: "Chat History", href: "/history" },
    { icon: User, label: "My Profile", href: "/profile" },
    { icon: User, label: "Feedback", href: "/feedback" },
  ]

  const handleSignOut = async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" />}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 bg-sidebar transition-transform duration-300 ease-in-out border-r border-sidebar-border",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:inset-0",
        )}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 relative">
                <Image src="/logo.png" alt="MedBot Logo" width={32} height={32} className="rounded-full" />
              </div>
              <span className="text-foreground font-semibold text-lg">Medibot</span>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 mb-6 border border-border">
            <div className="flex items-center space-x-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={userProfile?.photoURL || user?.photoURL || ""} />
                <AvatarFallback className="bg-purple-600 text-white font-semibold">
                  {userProfile?.displayName?.charAt(0).toUpperCase() ||
                    user?.displayName?.charAt(0).toUpperCase() ||
                    user?.email?.charAt(0).toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium truncate">
                  {userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User"}
                </p>
                <p className="text-muted-foreground text-sm truncate">{user?.email || "user@example.com"}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left h-12 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3">
            {mounted && (
              <Button
                variant="ghost"
                onClick={toggleTheme}
                className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-12 transition-all duration-200"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="mr-3 h-5 w-5" />
                    Theme: Light
                  </>
                ) : (
                  <>
                    <Moon className="mr-3 h-5 w-5" />
                    Theme: Dark
                  </>
                )}
              </Button>
            )}

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full justify-start bg-transparent border-border text-muted-foreground hover:text-red-400 hover:bg-muted rounded-xl h-12 transition-all duration-200"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        router.push("/auth/signin")
      } else if (!requireAuth && user) {
        // Don't redirect if user is on profile-setup page
        if (pathname !== "/profile-setup") {
          router.push("/dashboard")
        }
      }
    }
  }, [user, loading, requireAuth, router, pathname])

if (loading) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="space-y-4 p-6 w-full max-w-md animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3 mx-auto" />
        <div className="h-4 bg-slate-800 rounded w-full" />
        <div className="h-4 bg-slate-800 rounded w-5/6" />
        <div className="h-4 bg-slate-800 rounded w-2/3" />
      </div>
    </div>
  )
}


  if (requireAuth && !user) {
    return null
  }

  if (!requireAuth && user && pathname !== "/profile-setup") {
    return null
  }

  return <>{children}</>
}

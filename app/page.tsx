"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pill, MessageCircle, Clock } from "lucide-react"

export default function HomePage() {
  const blueButton =
"w-full h-10 bg-gradient-to-r from-blue-600/20 to-blue-400/20 border border-blue-500 text-white hover:from-blue-600/40 hover:to-blue-400/40 rounded-lg text-sm font-medium transform hover:scale-105 transition-transform duration-200"

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Wrapper with full white border */}
      <div className="w-full max-w-md bg-slate-900/80 border border-white/80 backdrop-blur-md rounded-xl p-6 space-y-6 shadow-lg shadow-purple-500/20">
        
        {/* Logo & Heading */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 relative ring-2 ring-purple-400 rounded-full p-1">
            <Image src="/logo.png" alt="MediBot Logo" width={64} height={64} className="rounded-full" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Welcome to MediBot</h1>
            <p className="text-slate-300 text-sm mt-1">
              Your AI-powered health assistant for seamless medication management and personalized care.
            </p>
          </div>
        </div>

        {/* About Section */}
        <Card className="bg-slate-800/60 border border-slate-700 rounded-lg backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg font-semibold">About MediBot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start space-x-2">
              <Pill className="h-4 w-4 text-purple-400 mt-1" />
              <p className="text-slate-200 text-sm">
                Effortlessly track medications, set reminders, and stay in control of your health.
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <MessageCircle className="h-4 w-4 text-purple-400 mt-1" />
              <p className="text-slate-200 text-sm">
                Engage with MediBot’s Ai powered chat for health insights and prescription guidance.
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <Clock className="h-4 w-4 text-purple-400 mt-1" />
              <p className="text-slate-200 text-sm">
                Get timely reminders via email, WhatsApp, or push notifications to never miss a dose.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <div className="space-y-2">
          <Link href="/auth/signup" className="block">
            <Button className={blueButton}>Sign Up</Button>
          </Link>
          <Link href="/auth/signin" className="block">
            <Button className={blueButton}>Sign In</Button>
          </Link>
         
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-400 text-xs pt-4 border-t border-white/10">
          <p>
            Powered by{" "}
            <a
              href="https://medibot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              MediBot
            </a>
          </p>
          <div className="mt-1 space-x-3">
            <a href="/privacy" className="hover:text-blue-400 transition-colors">
              
            </a>
            <a href="/terms" className="hover:text-blue-400 transition-colors">
              
            </a>
            <a href="mailto:sujayss149@gmail.com" className="hover:text-blue-400 transition-colors">
              Contact
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}

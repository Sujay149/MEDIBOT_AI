"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Send } from "lucide-react"
import { MessageCircle } from "lucide-react" 


export default function FeedbackPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [rating, setRating] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/send-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, message, rating }),
      })

      if (res.ok) {
        toast.success("Feedback sent successfully!")
        setEmail("")
        setMessage("")
        setRating(0)
      } else {
        toast.error("Failed to send feedback.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error sending feedback.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-slate-950 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-slate-400 hover:text-white lg:hidden h-10 w-10"
              >
                <Send className="h-5 w-5" />
              </Button>
              <h1 className="text-white font-semibold text-lg">Feedback</h1>
            </div>
          </div>

          {/* Feedback Form */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 p-6 rounded-xl shadow">
              <h2 className="text-white text-xl font-bold mb-4">Send Us Your Feedback</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                    Your Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1">
                    Feedback
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    placeholder="Your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Your Rating</label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`text-2xl transition-transform hover:scale-110 ${
                          rating >= star ? "text-yellow-400" : "text-slate-500"
                        }`}
                        aria-label={`${star} star`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  {loading ? "Sending..." : "Submit Feedback"}
                </Button>
                    <div className="mt-6 text-center">
  <p className="text-slate-400 text-sm mb-2">Need help or want to share something directly?</p>
  <a
    href="https://wa.me/919999999999" // Replace with your WhatsApp number
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 px-4 py-2 text-white font-medium bg-green-600 rounded-md hover:scale-105 transition-transform"
  >
    <MessageCircle className="w-4 h-4" />
    Contact on WhatsApp
  </a>
</div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}

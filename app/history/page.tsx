"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Menu, MessageSquare, Plus, Trash2, RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserChatSessions,
  deleteChatSession,
  subscribeToUserChatSessions,
  type ChatSession,
} from "@/lib/firestore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface ProcessedChatSession extends Omit<ChatSession, "createdAt" | "updatedAt" | "messages"> {
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id?: string;
    userId: string;
    image?: string;
    message: string;
    response: string;
    timestamp: Date;
    type: "chat" | "summarizer";
  }>;
}

export default function HistoryPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ProcessedChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ProcessedChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Normalize Firestore Timestamp to Date
  const normalizeSession = (session: ChatSession): ProcessedChatSession => {
    return {
      ...session,
      messages: (session.messages || []).map((msg) => ({
        ...msg,
        image: msg.image ?? undefined,
        timestamp: msg.timestamp instanceof Date
          ? msg.timestamp
          : (msg.timestamp as any)?.toDate?.() || new Date(),
      })),
      createdAt: session.createdAt instanceof Date
        ? session.createdAt
        : (session.createdAt as any)?.toDate?.() || new Date(),
      updatedAt: session.updatedAt instanceof Date
        ? session.updatedAt
        : (session.updatedAt as any)?.toDate?.() || new Date(),
    };
  };

  // Handle mobile responsiveness
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch and subscribe to chat sessions
  useEffect(() => {
    if (!user) {
      console.log("No user logged in, setting loading to false");
      setLoading(false);
      return;
    }

    let unsubscribe: () => void;

    const fetchAndSubscribe = async () => {
      try {
        console.log("Fetching initial chat sessions for user:", user.uid);
        const initialSessions = await getUserChatSessions(user.uid);
        console.log("Initial sessions fetched:", initialSessions);

        const normalizedSessions = initialSessions
          .map(normalizeSession)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setChatSessions(normalizedSessions);
        setFilteredSessions(normalizedSessions);
        setLoading(false);

        unsubscribe = subscribeToUserChatSessions(user.uid, (sessions) => {
          console.log("Real-time sessions received:", sessions);
          const sortedSessions = sessions
            .map(normalizeSession)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          setChatSessions(sortedSessions);
          setFilteredSessions(sortedSessions);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error fetching or subscribing to chat sessions:", error);
        toast.error("Failed to load chat history. Please try again.");
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      console.log("Unsubscribing from chat sessions");
      unsubscribe?.();
    };
  }, [user]);

  // Handle search filtering
  useEffect(() => {
    console.log("Search query changed:", searchQuery);
    if (searchQuery.trim() === "") {
      setFilteredSessions(chatSessions);
    } else {
      const filtered = chatSessions.filter((session) => {
        const sessionTitle = session.title?.toLowerCase() || "";
        return (
          sessionTitle.includes(searchQuery.toLowerCase()) ||
          session.messages.some(
            (msg) =>
              (msg.message?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
              (msg.response?.toLowerCase() || "").includes(searchQuery.toLowerCase())
          )
        );
      });
      console.log("Filtered sessions:", filtered);
      setFilteredSessions(filtered);
    }
  }, [searchQuery, chatSessions]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) {
      toast.error("Please log in to delete chat sessions");
      return;
    }

    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      console.log("Deleting session:", sessionToDelete);
      await deleteChatSession(sessionToDelete);
      toast.success("Chat session deleted successfully");
      setChatSessions((prev) => prev.filter((session) => session.id !== sessionToDelete));
      setFilteredSessions((prev) => prev.filter((session) => session.id !== sessionToDelete));
    } catch (error) {
      console.error("Error deleting chat session:", error);
      toast.error("Failed to delete chat session");
    } finally {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleViewSession = (sessionId: string) => {
    console.log("Navigating to session:", sessionId);
    router.push(`/chat?sessionId=${sessionId}`);
  };

  const handleClearSearch = () => {
    console.log("Clearing search query");
    setSearchQuery("");
    setFilteredSessions(chatSessions);
  };

  const handleRefresh = async () => {
    if (!user) {
      toast.error("Please log in to refresh chat history");
      return;
    }

    setLoading(true);
    try {
      console.log("Refreshing sessions for user:", user.uid);
      const sessions = await getUserChatSessions(user.uid);
      const sortedSessions = sessions
        .map(normalizeSession)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      setChatSessions(sortedSessions);
      setFilteredSessions(sortedSessions);
      toast.success("Chat history refreshed");
    } catch (error) {
      console.error("Error refreshing sessions:", error);
      toast.error("Failed to refresh chat history");
    } finally {
      setLoading(false);
    }
  };

  const formatISTDateTime = (date: Date) => {
    const d = new Date(date);
    return isMobile
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-white dark:bg-[#0e1a2b] text-black dark:text-white">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto px-4 pt-10 max-w-5xl mx-auto">
          {/* Header without Theme Toggle */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#a855f7]">Your Chat History</h1>
            <p className="text-muted-foreground mt-1 mb-6">View and manage your past conversations</p>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto mb-8">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or message content..."
              className="w-full pl-10 pr-10 py-3 rounded-full bg-card text-foreground placeholder-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="absolute top-1/2 left-3 transform -translate-y-1/2 text-muted-foreground">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.62-5.88a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Chat Sessions Header */}
          <div className="flex justify-between items-center mt-10 mb-4">
            <h2 className="text-xl font-semibold text-foreground">Your Conversations</h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                aria-label="Refresh chat history"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Link href="/chat">
                <Button className="bg-[#a855f7] hover:bg-teal-600 dark:bg-[#a855f7] dark:hover:bg-teal-600 text-white rounded-lg text-sm px-4 py-2">
                  <Plus className="mr-1 h-4 w-4" /> New
                </Button>
              </Link>
            </div>
          </div>

          {/* Chat Sessions Content */}
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">
              <Skeleton className="h-20 w-full rounded-lg mb-4" />
              <Skeleton className="h-20 w-full rounded-lg mb-4" />
              <Skeleton className="h-20 w-full rounded-lg mb-4" />
            </div>
          ) : !user ? (
            <div className="text-center text-muted-foreground py-20">
              <MessageSquare className="mx-auto mb-2 text-muted-foreground w-10 h-10" />
              <h2 className="text-xl font-semibold text-foreground">No User Logged In</h2>
              <p className="text-muted-foreground mb-4">
                Please log in to view your chat history.
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/auth/signin">
                  <Button className="bg-[#a855f7] hover:bg-teal-600 dark:bg-[#a855f7] dark:hover:bg-teal-600 text-white">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button className="bg-[#a855f7] hover:bg-teal-600 dark:bg-[#a855f7] dark:hover:bg-teal-600 text-white">
                    Signup
                  </Button>
                </Link>
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-20">
              <MessageSquare className="mx-auto mb-2 text-muted-foreground w-10 h-10" />
              <h2 className="text-xl font-semibold text-foreground">No Chats Found</h2>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "No chats match your search query."
                  : "You haven't started any conversations yet."}
              </p>
              <Link href="/chat">
                <Button className="bg-[#a855f7] hover:bg-teal-600 dark:bg-[#a855f7] dark:hover:bg-teal-600 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Start New Chat
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-2 text-[#a855f7] dark:text-[#a855f7]">Recent Conversations</h3>
                {filteredSessions.map((session) => (
                  <Card
                    key={session.id}
                    className="bg-card border-border rounded-lg mt-4 shadow-md hover:shadow-lg transition-shadow"
                    onClick={() => handleViewSession(session.id!)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-foreground font-semibold text-base">
                            {session.title || "Untitled Chat"}
                          </h4>
                          <p className="text-muted-foreground text-sm mt-1 truncate">
                            {session.messages.length > 0
                              ? session.messages[0].message || "No message content"
                              : "No messages yet"}
                          </p>
                          <p className="text-muted-foreground text-sm mt-1">
                            {session.messages.length} message{session.messages.length !== 1 ? "s" : ""} •{" "}
                            {formatISTDateTime(session.updatedAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id!);
                            }}
                            className="text-red-500 dark:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 dark:text-red-600 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id!);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>
            </div>
          )}

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="bg-card text-foreground border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Delete Chat Session</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this chat session? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button
                  variant="ghost"
                  onClick={() => setDeleteDialogOpen(false)}
                  className="text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteSession}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AuthGuard>
  );
}
"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Menu,
  Search,
  Trash2,
  MessageSquare,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
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

        const normalizedSessions = initialSessions.map(normalizeSession).sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );
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
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalChats = chatSessions.length;
  const totalMessages = chatSessions.reduce((sum, session) => sum + session.messages.length, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysChats = chatSessions.filter((session) => session.updatedAt >= today).length;
  const searchResults = filteredSessions.length;

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">Your Chat History</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="pl-10 pr-8 bg-muted border-border text-foreground placeholder-muted-foreground h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  aria-label="Search chat history"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground h-5 w-5"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Link href="/chat">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 px-4"
                  aria-label="Start new chat"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span>New Chat</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Refresh chat history"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-background">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Chats</p>
                    <p className="text-2xl font-bold text-foreground">{totalChats}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Messages</p>
                    <p className="text-2xl font-bold text-foreground">{totalMessages}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Today's Chats</p>
                    <p className="text-2xl font-bold text-foreground">{todaysChats}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Search Results</p>
                    <p className="text-2xl font-bold text-foreground">{searchResults}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="border-t border-border my-4"></div>

              <h2 className="text-lg font-semibold text-foreground">Your Conversations</h2>

              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : !user ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4 p-8 bg-card rounded-lg border border-border shadow-sm">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h1 className="text-2xl font-bold text-foreground">Welcome to Your Chat History</h1>
                    <p className="text-muted-foreground">
                      Please log in to view your chat history.
                    </p>
                    <div className="flex space-x-4 justify-center">
                      <Link href="/auth/signin">
                        <Button
                          variant="outline"
                          className="bg-card border-border text-foreground hover:bg-purple-600 hover:text-white"
                        >
                          Login
                        </Button>
                      </Link>
                      <Link href="/auth/signup">
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                          Signup
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4 p-8 bg-card rounded-lg border border-border shadow-sm">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h2 className="text-xl font-semibold text-foreground">No Chats Found</h2>
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No chats match your search query."
                        : "You haven't started any conversations yet."}
                    </p>
                    <Link href="/chat">
                      <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Start New Chat
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="bg-card border-border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleViewSession(session.id!)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-medium text-foreground truncate">
                              {session.title || "Untitled Chat"}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {session.messages.length > 0
                                ? session.messages[0].message || "No message content"
                                : "No messages yet"}
                            </p>
                            <div className="flex items-center mt-2 text-xs text-muted-foreground">
                              <span>
                                {session.messages.length} message{session.messages.length !== 1 ? "s" : ""}
                              </span>
                              <span className="mx-2">•</span>
                              <span>{formatISTDateTime(session.updatedAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id!);
                              }}
                              className="text-muted-foreground hover:text-red-500"
                              aria-label={`Delete session ${session.title || "Untitled"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="bg-card border-border max-w-md rounded-lg shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Delete Chat Session
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-2">
                  Are you sure you want to delete this chat session? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  className="border-border text-foreground hover:bg-purple-600 hover:text-white"
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
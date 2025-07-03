"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Menu,
  Search,
  Trash2,
  MessageSquare,
  Eye,
  X,
  ChevronLeft,
  Plus,
  RefreshCw,
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
import { getUserChatSessions, deleteChatSession, type ChatSession, subscribeToUserChatSessions } from "@/lib/firestore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function HistoryPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let unsubscribe: () => void;

    const fetchAndSubscribe = async () => {
      try {
        // Initial fetch to ensure data is loaded
        const initialSessions = await getUserChatSessions(user.uid);
        console.log("Initial sessions fetched:", initialSessions);

        unsubscribe = subscribeToUserChatSessions(user.uid, (sessions) => {
          console.log("Real-time sessions received:", sessions); // Debug log
          if (!Array.isArray(sessions)) {
            console.error("Sessions is not an array:", sessions);
            setLoading(false);
            return;
          }

          const sortedSessions = sessions
            .map((session) => {
              let updatedAtDate: Date;
              if (session.updatedAt instanceof Date) {
                updatedAtDate = session.updatedAt;
              } else if (session.updatedAt && typeof (session.updatedAt as any).toDate === "function") {
                updatedAtDate = (session.updatedAt as any).toDate();
              } else if (typeof session.updatedAt === "number") {
                updatedAtDate = new Date(session.updatedAt);
              } else if (typeof session.updatedAt === "string") {
                updatedAtDate = new Date(session.updatedAt);
              } else {
                console.warn(`Invalid updatedAt for session ${session.id}:`, session.updatedAt);
                updatedAtDate = new Date(); // Fallback to current time
              }
              return {
                ...session,
                updatedAt: updatedAtDate,
              };
            })
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

          setChatSessions(sortedSessions);
          setFilteredSessions(sortedSessions);
          setLoading(false);
          setLastUpdated(new Date());
        });
      } catch (error) {
        console.error("Error fetching or subscribing to chat sessions:", error);
        toast.error("Failed to load chat history");
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => unsubscribe && unsubscribe();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSessions(chatSessions);
    } else {
      const filtered = chatSessions.filter((session) => {
        const sessionTitle = session.title || "";
        const messages = session.messages || [];

        return (
          sessionTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          messages.some(
            (msg) =>
              (msg.message && msg.message.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (msg.response && msg.response?.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        );
      });
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
      await deleteChatSession(sessionToDelete);
      toast.success("Chat session deleted successfully");
      // Force refresh after deletion
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
    router.push(`/chat?sessionId=${sessionId}`);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setFilteredSessions(chatSessions);
  };

  const handleRefresh = () => {
    setLoading(true);
    setChatSessions([]); // Clear state to force reload
    setFilteredSessions([]);
    // Re-run the effect to refetch data
    if (user) {
      getUserChatSessions(user.uid).then((sessions) => {
        console.log("Refreshed sessions:", sessions);
        const sortedSessions = sessions
          .map((session) => {
            let updatedAtDate: Date;
            if (session.updatedAt instanceof Date) {
              updatedAtDate = session.updatedAt;
            } else if (session.updatedAt && typeof (session.updatedAt as any).toDate === "function") {
              updatedAtDate = (session.updatedAt as any).toDate();
            } else if (typeof session.updatedAt === "number") {
              updatedAtDate = new Date(session.updatedAt);
            } else if (typeof session.updatedAt === "string") {
              updatedAtDate = new Date(session.updatedAt);
            } else {
              updatedAtDate = new Date();
            }
            return { ...session, updatedAt: updatedAtDate };
          })
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setChatSessions(sortedSessions);
        setFilteredSessions(sortedSessions);
        setLoading(false);
      }).catch((error) => {
        console.error("Error refreshing sessions:", error);
        toast.error("Failed to refresh chat history");
        setLoading(false);
      });
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
      weekday: "long",
    });
  };

  // Calculate totals
  const totalChats = chatSessions.length; // Total number of chat sessions
  const totalMessages = chatSessions.reduce((sum, session) => sum + (session.messages?.length || 0), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysChats = chatSessions.filter((session) => session.updatedAt >= today).length;
  const searchResults = filteredSessions.length;

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
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
              <h1 className="text-xl font-bold text-foreground">Rentemorize Your Chats...</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="pl-10 pr-8 bg-muted border-border text-foreground placeholder-muted-foreground h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-background">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Stats Cards */}
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

              {/* Divider */}
              <div className="border-t border-border my-4"></div>

              {/* Section Title */}
              <h2 className="text-lg font-semibold text-foreground">View and manage your conversations</h2>

              {/* Chat Sessions */}
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
                    <h1 className="text-2xl font-bold text-foreground">Welcome to Rentemorize</h1>
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
                        : "Start a new conversation to see your history here."}
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
                            <h3 className="text-base font-medium text-foreground truncate">{session.title || "Untitled"}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {(session.messages || []).length > 0
                                ? session.messages[0].message || "No message content"
                                : "No messages yet"}
                            </p>
                            <div className="flex items-center mt-2 text-xs text-muted-foreground">
                              <span>
                                {(session.messages || []).length} message
                                {(session.messages || []).length !== 1 ? "s" : ""}
                              </span>
                              <span className="mx-2">•</span>
                              <span>
                                {session.updatedAt.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
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

          {/* Delete Confirmation Dialog */}
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
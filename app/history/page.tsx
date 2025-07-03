"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Menu,
  Search,
  Download,
  Trash2,
  Calendar,
  MessageSquare,
  BarChart3,
  Eye,
  X,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserChatSessions, deleteChatSession, type ChatSession } from "@/lib/firestore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
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
              (msg.response && msg.response.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        );
      });
      setFilteredSessions(filtered);
    }
  }, [searchQuery, chatSessions]);

  const loadChatSessions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const sessions = await getUserChatSessions(user.uid);
      const sortedSessions = sessions.sort((a, b) => {
        const dateA = a.updatedAt instanceof Date ? a.updatedAt : a.updatedAt?.toDate?.() || new Date(0);
        const dateB = b.updatedAt instanceof Date ? b.updatedAt : b.updatedAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setChatSessions(sortedSessions);
      setFilteredSessions(sortedSessions);
    } catch (error) {
      console.error("Error loading chat sessions:", error);
      toast.error("Failed to load chat history");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      toast.success("Chat session deleted successfully!");
      loadChatSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error("Failed to delete chat session");
    }
  };

  const handleViewSession = (session: ChatSession) => {
    router.push(`/chat?sessionId=${session.id}`);
  };

  const handleExportSession = (session: ChatSession) => {
    const getDate = (date: Date | { toDate?: () => Date } | undefined | null) => {
      if (!date) return new Date().toISOString();
      if (date instanceof Date) return date.toISOString();
      if (typeof (date as { toDate?: () => Date }).toDate === "function") return (date as { toDate: () => Date }).toDate().toISOString();
      return new Date().toISOString();
    };

    const exportData = {
      title: session.title || "Untitled",
      createdAt: getDate(session.createdAt),
      messages: session.messages.map((msg) => ({
        user: msg.message || "",
        bot: msg.response || "",
        timestamp: getDate(msg.timestamp),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${(session.title || "Untitled").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Chat exported successfully!");
  };

  const getDateString = (
    date: Date | { toDate?: () => Date } | undefined | null
  ) => {
    if (!date) return "Recently";
    if (date instanceof Date) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (typeof (date as { toDate?: () => Date }).toDate === "function") return (date as { toDate: () => Date }).toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return "Recently";
  };

  const getTimeString = (
    date: Date | { toDate?: () => Date } | undefined | null
  ) => {
    if (!date) return "";
    const actualDate = date instanceof Date ? date : (date as { toDate?: () => Date }).toDate?.();
    if (!actualDate) return "";
    return actualDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const totalMessages = chatSessions.reduce(
    (total, session) => total + session.messages.length,
    0
  );

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border bg-card shadow-sm">
            <div className="flex items-center space-x-3 md:space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden h-9 w-9 md:h-10 md:w-10 rounded-lg"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
              <div className="w-8 h-8 md:w-9 md:h-9 bg-purple-600 rounded-full flex items-center justify-center">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <span className="font-semibold text-base md:text-lg">
                Chat History
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 px-4 py-4 md:px-6 md:py-6 overflow-y-auto w-full">
            <div className="max-w-full lg:max-w-6xl mx-auto space-y-6">
              {/* Title and Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-xl md:text-2xl font-semibold">
                    Your Chat History
                  </h1>
                  <Button
                    variant="outline"
                    className="hidden sm:flex items-center gap-2"
                    onClick={() => router.push('/chat')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Chat
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm md:text-base">
                  Review and manage your past conversations
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder-muted-foreground pl-12 h-12 rounded-lg text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-purple-600 w-full"
                />
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 text-center">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-2xl font-semibold text-purple-600 mb-1">
                      {chatSessions.length}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm">
                      Total Chats
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 text-center">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-2xl font-semibold text-blue-600 mb-1">
                      {totalMessages}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm">
                      Total Messages
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 text-center">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-2xl font-semibold text-green-600 mb-1">
                      {chatSessions.filter((s) => {
                        let sessionDate;
                        if (s.createdAt instanceof Date) {
                          sessionDate = s.createdAt;
                        } else if (typeof s.createdAt?.toDate === "function") {
                          sessionDate = s.createdAt.toDate();
                        }
                        const today = new Date();
                        return sessionDate && sessionDate.toDateString() === today.toDateString();
                      }).length}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm">
                      Today's Chats
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 text-center">
                    <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-2xl font-semibold text-orange-600 mb-1">
                      {filteredSessions.length}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm">
                      Search Results
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Chat Sessions List */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="border-border">
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <div className="flex justify-end space-x-2">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredSessions.length > 0 ? (
                <div className="space-y-4">
                  {filteredSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="bg-card border-border rounded-lg shadow hover:shadow-md transition-all w-full"
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0">
                              <h3
                                className="font-semibold text-base truncate max-w-[180px] sm:max-w-xs hover:text-purple-600 cursor-pointer transition-colors"
                                onClick={() => handleViewSession(session)}
                              >
                                {session.title || "Untitled"}
                              </h3>
                              <Badge className="bg-purple-600 text-white font-medium px-2 py-0.5 text-xs shrink-0">
                                {session.messages.length} msg
                              </Badge>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-muted-foreground text-xs whitespace-nowrap">
                                {getDateString(session.updatedAt)}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {getTimeString(session.updatedAt)}
                              </span>
                            </div>
                          </div>
                          {session.messages.length > 0 && (
                            <p className="text-muted-foreground line-clamp-2 leading-relaxed text-sm break-words">
                              {session.messages[session.messages.length - 1]?.message}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewSession(session)}
                              className="text-muted-foreground hover:text-purple-600 hover:bg-muted h-8 w-8 rounded-lg"
                              title="View Chat"
                              aria-label="View chat session"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportSession(session)}
                              className="text-muted-foreground hover:text-purple-600 hover:bg-muted h-8 w-8 rounded-lg"
                              title="Export Chat"
                              aria-label="Export chat session"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => session.id && handleDeleteSession(session.id)}
                              className="text-muted-foreground hover:text-red-500 hover:bg-muted h-8 w-8 rounded-lg"
                              title="Delete Chat"
                              aria-label="Delete chat session"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-card rounded-lg shadow border border-border">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? "No matching conversations" : "No chat history yet"}
                  </h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "Start a conversation to see your history here"}
                  </p>
                  {!searchQuery && (
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 px-4"
                      onClick={() => router.push('/chat')}
                      aria-label="Start new chat"
                    >
                      Start New Chat
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
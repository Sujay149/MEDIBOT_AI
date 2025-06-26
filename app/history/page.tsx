
"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserChatSessions, deleteChatSession, type ChatSession } from "@/lib/firestore";
import { toast } from "sonner";

export default function HistoryPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { user } = useAuth();

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
      setChatSessions(sessions);
      setFilteredSessions(sessions);
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
    setSelectedSession(session);
    setViewDialogOpen(true);
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

  const totalMessages = chatSessions.reduce(
    (total, session) => total + session.messages.length,
    0
  );

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col w-full">
          <div className="flex items-center justify-between px-4 py-3 xs:px-5 xs:py-4 border-b border-border bg-card shadow-sm">
            <div className="flex items-center space-x-3 xs:space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden h-10 w-10 xs:h-11 xs:w-11 rounded-lg transition-transform hover:scale-105"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5 xs:h-6 xs:w-6" />
              </Button>
              <div className="w-8 h-8 xs:w-9 xs:h-9 bg-purple-600 rounded-full flex items-center justify-center">
                <BarChart3 className="h-4 w-4 xs:h-5 xs:w-5 text-white" />
              </div>
              <span className="font-semibold text-base xs:text-lg">
                Chat History
              </span>
            </div>
          </div>

          <div className="flex-1 px-4 py-5 xs:px-5 xs:py-6 overflow-y-auto w-full">
            <div className="max-w-full xs:max-w-2xl sm:max-w-3xl md:max-w-4xl mx-auto space-y-5 xs:space-y-6">
              <div>
                <h1 className="text-xl xs:text-2xl font-semibold mb-2 xs:mb-3">
                  Rememorize Your Chats...
                </h1>
                <p className="text-muted-foreground text-sm xs:text-base">
                  View and manage your conversations
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 xs:h-6 xs:w-6 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder-muted-foreground pl-12 h-12 xs:h-14 rounded-lg text-sm xs:text-base focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all w-full"
                />
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-4 xs:gap-5">
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 xs:p-5 text-center">
                    <div className="w-10 h-10 xs:w-12 xs:h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 xs:mb-4">
                      <MessageSquare className="h-5 w-5 xs:h-6 xs:w-6 text-white" />
                    </div>
                    <div className="text-2xl xs:text-3xl font-semibold text-purple-600 mb-1">
                      {chatSessions.length}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm xs:text-base">
                      Total Chats
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 xs:p-5 text-center">
                    <div className="w-10 h-10 xs:w-12 xs:h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 xs:mb-4">
                      <BarChart3 className="h-5 w-5 xs:h-6 xs:w-6 text-white" />
                    </div>
                    <div className="text-2xl xs:text-3xl font-semibold text-blue-600 mb-1">
                      {totalMessages}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm xs:text-base">
                      Total Messages
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 xs:p-5 text-center">
                    <div className="w-10 h-10 xs:w-12 xs:h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3 xs:mb-4">
                      <Calendar className="h-5 w-5 xs:h-6 xs:w-6 text-white" />
                    </div>
                    <div className="text-2xl xs:text-3xl font-semibold text-green-600 mb-1">
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
                    <div className="text-muted-foreground font-medium text-sm xs:text-base">
                      Today's Chats
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow">
                  <CardContent className="p-4 xs:p-5 text-center">
                    <div className="w-10 h-10 xs:w-12 xs:h-12 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-3 xs:mb-4">
                      <Search className="h-5 w-5 xs:h-6 xs:w-6 text-white" />
                    </div>
                    <div className="text-2xl xs:text-3xl font-semibold text-orange-600 mb-1">
                      {filteredSessions.length}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm xs:text-base">
                      Search Results
                    </div>
                  </CardContent>
                </Card>
              </div>

              {loading ? (
                <div className="text-center py-8 xs:py-10">
                  <div className="w-6 h-6 xs:w-8 xs:h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3 xs:mb-4">
                    <span className="sr-only">Loading...</span>
                  </div>
                  <p className="text-muted-foreground text-sm xs:text-base">
                    Loading chat history...
                  </p>
                </div>
              ) : filteredSessions.length > 0 ? (
                <div className="space-y-4 xs:space-y-5">
                  {filteredSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="bg-card border-border rounded-lg shadow hover:shadow-lg transition-all hover:scale-[1.01] w-full"
                    >
                      <CardContent className="p-4 xs:p-5">
                        <div className="flex flex-col space-y-3 xs:space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 xs:space-x-4 min-w-0">
                              <h3 className="font-semibold text-base xs:text-lg truncate max-w-[55%] xs:max-w-[65%]">
                                {session.title || "Untitled"}
                              </h3>
                              <Badge className="bg-purple-600 text-white font-medium px-2 xs:px-2.5 py-0.5 text-xs xs:text-sm shrink-0">
                                {session.messages.length} msg
                              </Badge>
                            </div>
                            <span className="text-muted-foreground text-xs xs:text-sm whitespace-nowrap">
                              {getDateString(session.updatedAt)}
                            </span>
                          </div>
                          {session.messages.length > 0 && (
                            <p className="text-muted-foreground line-clamp-2 leading-relaxed text-sm xs:text-base break-words">
                              {session.messages[session.messages.length - 1]?.message}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 xs:space-x-3 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewSession(session)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted h-9 w-9 xs:h-10 xs:w-10 rounded-lg transition-transform hover:scale-105"
                              title="View Chat"
                              aria-label="View chat session"
                            >
                              <Eye className="h-4 w-4 xs:h-5 xs:w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExportSession(session)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted h-9 w-9 xs:h-10 xs:w-10 rounded-lg transition-transform hover:scale-105"
                              title="Export Chat"
                              aria-label="Export chat session"
                            >
                              <Download className="h-4 w-4 xs:h-5 xs:w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => session.id && handleDeleteSession(session.id)}
                              className="text-muted-foreground hover:text-red-500 hover:bg-muted h-9 w-9 xs:h-10 xs:w-10 rounded-lg transition-transform hover:scale-105"
                              title="Delete Chat"
                              aria-label="Delete chat session"
                            >
                              <Trash2 className="h-4 w-4 xs:h-5 xs:w-5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 xs:py-10 bg-card rounded-lg shadow border border-border">
                  <MessageSquare className="h-12 w-12 xs:h-14 xs:w-14 text-muted-foreground mx-auto mb-3 xs:mb-4 animate-pulse" />
                  <h3 className="text-lg xs:text-xl font-semibold mb-2 xs:mb-3">
                    {searchQuery ? "No matching conversations" : "No chat history yet"}
                  </h3>
                  <p className="text-muted-foreground mb-4 xs:mb-5 max-w-[85%] xs:max-w-sm mx-auto text-sm xs:text-base">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "Start a conversation to see your history here"}
                  </p>
                  {!searchQuery && (
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 xs:h-12 px-4 xs:px-5 text-sm xs:text-base transition-transform hover:scale-105"
                      aria-label="Start new chat"
                    >
                      Start Chat
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-[95vw] xs:max-w-[90vw] sm:max-w-2xl w-full mx-auto max-h-[90vh] overflow-hidden p-4 xs:p-5 rounded-lg shadow">
              <DialogHeader className="flex items-center justify-between border-b border-border pb-3 xs:pb-4">
                <DialogTitle className="text-base xs:text-lg truncate max-w-[70%] xs:max-w-[80%]">
                  {selectedSession?.title || "Untitled"}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted h-9 w-9 xs:h-10 xs:w-10 rounded-lg transition-transform hover:scale-105"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4 xs:h-5 xs:w-5" />
                </Button>
              </DialogHeader>
              <div className="space-y-4 xs:space-y-5 overflow-y-auto max-h-[75vh] xs:max-h-[80vh] pr-3">
                {selectedSession?.messages.map((message, index) => (
                  <div key={index} className="space-y-3 xs:space-y-4">
                    <div className="flex justify-end">
                      <div className="bg-purple-600 rounded-lg rounded-tr-sm p-3 xs:p-4 max-w-[80%] xs:max-w-[75%] text-white text-sm xs:text-base break-words shadow-sm">
                        {message.message}
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-muted border-border rounded-lg rounded-tl-sm p-3 xs:p-4 max-w-[80%] xs:max-w-[75%] text-foreground text-sm xs:text-base break-words shadow-sm">
                        {message.response}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AuthGuard>
  );
}

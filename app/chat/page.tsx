"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ThumbsDown,
  ThumbsUp,
  Copy,
  Edit,
  Menu,
  Plus,
  Camera,
  RotateCcw,
  Upload,
  Send,
  X,
  FileText,
  Pill,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  createChatSession,
  addMessageToSession,
  getChatSessionById,
  updateChatSessionTitle,
  subscribeToUserChatSessions,
  type ChatSession,
  type ChatMessage,
} from "@/lib/firestore";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import firebase from "firebase/firestore";

declare global {
  interface Window {
    puter: any;
  }
}

interface PrescriptionAnalysis {
  medications: string[];
  dosages: string[];
  instructions: string;
  warnings: string[];
  userId?: string;
  fileName?: string;
  createdAt?: Date;
}

interface ProcessedChatSession extends Omit<ChatSession, "createdAt" | "updatedAt" | "messages"> {
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    userId: string;
    image?: string;
    message: string;
    response: string;
    timestamp: Date;
    type: "chat" | "summarizer";
  }>;
}

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [currentSession, setCurrentSession] = useState<ProcessedChatSession | null>(null);
  const [chatSessions, setChatSessions] = useState<ProcessedChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PrescriptionAnalysis | null>(null);
  const [analyzingPrescription, setAnalyzingPrescription] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash-latest");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Normalize Firestore Timestamp to Date
  const normalizeSession = (session: ChatSession): ProcessedChatSession => {
    return {
      ...session,
      messages: (session.messages || []).map((msg) => ({
        ...msg,
        id: msg.id || uuidv4(),
        timestamp: msg.timestamp instanceof Date
          ? msg.timestamp
          : (msg.timestamp as firebase.Timestamp)?.toDate?.() || new Date(),
      })),
      createdAt: session.createdAt instanceof Date
        ? session.createdAt
        : (session.createdAt as firebase.Timestamp)?.toDate?.() || new Date(),
      updatedAt: session.updatedAt instanceof Date
        ? session.updatedAt
        : (session.updatedAt as firebase.Timestamp)?.toDate?.() || new Date(),
    };
  };

  // Fetch sessions and load specific session if sessionId is provided
  useEffect(() => {
    if (!user) {
      console.log("No user logged in");
      setLoading(false);
      return;
    }

    let unsubscribe: () => void;

    const fetchSessions = async () => {
      try {
        console.log("Subscribing to chat sessions for user:", user.uid);
        unsubscribe = subscribeToUserChatSessions(user.uid, (sessions) => {
          const normalizedSessions = sessions.map(normalizeSession).sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          );
          setChatSessions(normalizedSessions);
          console.log("Subscribed sessions:", normalizedSessions);

          const sessionId = searchParams?.get("sessionId");
          if (sessionId) {
            console.log("Fetching session by ID:", sessionId);
            getChatSessionById(sessionId).then((session) => {
              if (session && session.userId === user.uid) {
                setCurrentSession(normalizeSession(session));
              } else {
                console.warn("Session not found or access denied:", sessionId);
                toast.error("Chat session not found or access denied");
                router.push("/chat");
              }
            }).catch((error) => {
              console.error("Error fetching session by ID:", error);
              toast.error("Failed to load chat session");
              router.push("/chat");
            });
          } else if (!currentSession && normalizedSessions.length > 0) {
            setCurrentSession(normalizedSessions[0]);
          }
        });
      } catch (error) {
        console.error("Error fetching sessions:", error);
        toast.error("Failed to load chat sessions");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    return () => {
      console.log("Unsubscribing from chat sessions");
      unsubscribe?.();
    };
  }, [user, searchParams]);

  // Auto-scroll to the latest message
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [currentSession?.messages]);

  const startNewChat = async () => {
    if (!user) {
      toast.error("Please log in to start a new chat");
      return;
    }

    try {
      const sessionId = await createChatSession(user.uid, "New Chat");
      const newSession: ProcessedChatSession = {
        id: sessionId,
        userId: user.uid,
        title: "New Chat",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCurrentSession(newSession);
      setMessage("");
      router.push("/chat");
      console.log("Started new chat:", sessionId);
      toast.success("New chat started!");
    } catch (error) {
      console.error("Error starting new chat:", error);
      toast.error("Failed to start new chat");
    }
  };

  const handleSendMessage = async () => {
    if (!user) {
      toast.error("Please log in to send messages");
      return;
    }

    if (!message.trim() && !selectedFile) {
      toast.error("Please enter a message or upload a file");
      return;
    }

    const userMessage = message.trim() || "Image uploaded";
    const messageId = uuidv4();
    setLoading(true);

    try {
      let sessionId = currentSession?.id;
      if (!sessionId) {
        const smartTitle = message.trim() ? generateChatTitle(message) : "Image Analysis";
        sessionId = await createChatSession(user.uid, smartTitle);
        const newSession: ProcessedChatSession = {
          id: sessionId,
          userId: user.uid,
          title: smartTitle,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setCurrentSession(newSession);
        console.log("Created new session:", sessionId);
      } else if (currentSession?.title === "New Chat" && message.trim()) {
        const smartTitle = generateChatTitle(message);
        await updateChatSessionTitle(sessionId, smartTitle);
        setCurrentSession((prev) => (prev ? { ...prev, title: smartTitle } : prev));
        console.log("Updated session title:", sessionId, smartTitle);
      }

      const tempMessage: ProcessedChatSession["messages"][0] = {
        id: messageId,
        userId: user.uid,
        message: userMessage,
        response: "",
        timestamp: new Date(),
        type: selectedFile ? "summarizer" : "chat",
      };

      setCurrentSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, tempMessage],
          updatedAt: new Date(),
        };
      });

      setMessage("");
      setSelectedFile(null);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      let botResponse = "";
      if (message.trim()) {
        botResponse = await generateAIResponse(message, selectedModel);
      }
      if (selectedFile) {
        const analysis = await analyzePrescription(selectedFile, selectedModel);
        const analysisText = `**Prescription Analysis**:\n- **Medications**: ${analysis.medications.join(", ")}\n- **Dosages**: ${analysis.dosages.join(", ")}\n- **Instructions**: ${analysis.instructions}${analysis.warnings.length ? "\n- **Warnings**: " + analysis.warnings.join(", ") : ""}`;
        botResponse = botResponse ? `${botResponse}\n\n${analysisText}` : analysisText;
      }

      const newMessage = await addMessageToSession(sessionId!, user.uid, userMessage, botResponse, selectedFile ? "summarizer" : "chat");
      console.log("Message added to session:", sessionId, newMessage);

      setCurrentSession((prev) => {
        if (!prev) return prev;
        const updatedMessages = prev.messages.map((msg) =>
          msg.id === messageId
            ? {
                ...newMessage,
                timestamp: newMessage.timestamp instanceof Date
                  ? newMessage.timestamp
                  : (newMessage.timestamp as firebase.Timestamp).toDate(),
              }
            : msg
        );
        return {
          ...prev,
          messages: updatedMessages,
          updatedAt: new Date(),
        };
      });

      router.push(`/chat?sessionId=${sessionId}`);
      sendMessageNotification(userMessage, botResponse);
      toast.success("Message sent successfully");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(`Failed to send message: ${error.message || "Unknown error"}`);
      setMessage(userMessage);
      if (selectedFile) {
        setSelectedFile(selectedFile);
        setFileName(selectedFile.name);
      }
      setCurrentSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((msg) => msg.id !== messageId),
        };
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMessage = async (messageId: string, originalMessage: string) => {
    if (!user) {
      toast.error("Please log in to edit messages");
      return;
    }

    if (editingMessageId === messageId) {
      if (!editedMessage.trim()) {
        toast.error("Message cannot be empty");
        return;
      }

      try {
        setLoading(true);
        const botResponse = await generateAIResponse(editedMessage, selectedModel);
        const sessionId = currentSession?.id;
        if (sessionId) {
          const updatedMessages = (currentSession?.messages ?? []).map((msg) =>
            msg.id === messageId ? { ...msg, message: editedMessage, response: botResponse } : msg
          );
          await addMessageToSession(sessionId, user.uid, editedMessage, botResponse, "chat");
          setCurrentSession((prev) => (prev ? { ...prev, messages: updatedMessages } : prev));
          if (currentSession?.messages[0]?.id === messageId) {
            const smartTitle = generateChatTitle(editedMessage);
            await updateChatSessionTitle(sessionId, smartTitle);
            setCurrentSession((prev) => (prev ? { ...prev, title: smartTitle } : prev));
            console.log("Updated session title after edit:", sessionId, smartTitle);
          }
          toast.success("Message updated!");
        }
      } catch (error) {
        console.error("Error editing message:", error);
        toast.error("Failed to edit message");
      } finally {
        setEditingMessageId(null);
        setEditedMessage("");
        setLoading(false);
      }
    } else {
      setEditingMessageId(messageId);
      setEditedMessage(originalMessage);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleFeedback = (messageId: string, isPositive: boolean) => {
    toast.success(isPositive ? "Thanks for the positive feedback!" : "Thanks for the feedback!");
  };

  const generateChatTitle = (firstMessage: string): string => {
    const lowerMessage = firstMessage.toLowerCase().trim();
    if (lowerMessage.length === 0) return "General Discussion";

    const words = lowerMessage.split(/\s+/).filter((word) => word.length > 3);
    if (words.length === 0) return "General Discussion";

    const healthKeywords = [
      { keywords: ["headache", "migraine"], title: "Headache Inquiry" },
      { keywords: ["fever", "temperature"], title: "Fever Inquiry" },
      { keywords: ["medication", "medicine", "prescription"], title: "Medication Inquiry" },
      { keywords: ["diet", "nutrition", "food"], title: "Nutrition Inquiry" },
      { keywords: ["exercise", "workout", "fitness"], title: "Exercise Inquiry" },
      { keywords: ["sleep", "insomnia"], title: "Sleep Inquiry" },
      { keywords: ["stress", "anxiety", "mental"], title: "Mental Health Inquiry" },
      { keywords: ["pain"], title: "Pain Inquiry" },
      { keywords: ["symptom", "symptoms"], title: "Symptom Inquiry" },
      { keywords: ["allergy", "allergies"], title: "Allergy Inquiry" },
      { keywords: ["injury", "injuries"], title: "Injury Inquiry" },
      { keywords: ["disease", "condition"], title: "Condition Inquiry" },
    ];

    for (const { keywords, title } of healthKeywords) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        return title;
      }
    }

    const keyPhrase = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return `${keyPhrase} Discussion`;
  };

  const sendMessageNotification = (userMessage: string, botResponse: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Medibot Response", {
        body: "Your health question has been answered",
        icon: "/logo.png",
        badge: "/logo.png",
      });
    }
  };

  const generateAIResponse = async (userMessage: string, selectedModel: string): Promise<string> => {
    try {
      const modelMap: Record<string, string> = {
        "gemini-1.5-flash-latest": "gemini-1.5-flash",
        "gemini-1.5-pro-latest": "gpt-4o",
        "grok": "x-ai/grok-3-beta",
      };

      const resolvedModel = modelMap[selectedModel];

      if (!resolvedModel) {
        console.error("Unrecognized model:", selectedModel);
        return "Model not recognized. Please select a valid model.";
      }

      const prompt = `You are Medibot, a health-focused AI assistant. Provide a concise, informative, and professional response to the following health-related user query. Ensure the response is educational, not a substitute for professional medical advice, and includes a reminder to consult a healthcare professional for personalized advice. Query: ${userMessage}`;

      if (resolvedModel === "gemini-1.5-flash") {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent`;
        const response = await fetch(`${endpoint}?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response generated.";
      }

      if (typeof window !== "undefined" && !window.puter) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.puter.com/v2/";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Puter.js"));
          document.head.appendChild(script);
        });
      }

      const response = await window.puter.ai.chat(prompt, { model: resolvedModel });
      return response?.message?.content?.trim() || "No response generated.";
    } catch (error) {
      console.error("Error generating AI response:", error);
      return "I'm sorry, I couldn't process your request right now. Please try again.";
    }
  };

  const analyzePrescription = async (file: File, selectedModel: string): Promise<PrescriptionAnalysis> => {
    try {
      const base64Data = await fileToBase64(file);
      const prompt = `Analyze this prescription image and extract medications, dosages, instructions, and any warnings. Return the response in JSON format with fields: medications (array), dosages (array), instructions (string), warnings (array).`;
      const fullPrompt = `${prompt}\n\nHere is the image in base64:\ndata:${file.type};base64,${base64Data}`;

      const isGeminiModel = selectedModel.startsWith("gemini");

      if (isGeminiModel) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType: file.type, data: base64Data } },
                  ],
                },
              ],
              generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        let responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        responseText = responseText.replace(/```json|```|`/g, "").trim();

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error("Gemini JSON parse error:", parseError, responseText);
          throw new Error("Invalid JSON from Gemini");
        }

        return {
          medications: result.medications || ["Unknown"],
          dosages: result.dosages || ["Unknown"],
          instructions: result.instructions || "No instructions provided.",
          warnings: result.warnings || [],
        };
      }

      if (typeof window !== "undefined" && !window.puter) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.puter.com/v2/";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Puter.js"));
          document.head.appendChild(script);
        });
      }

      const response = await window.puter.ai.chat(fullPrompt, { model: selectedModel });
      let responseText = response?.message?.content || "{}";
      responseText = responseText.replace(/```json|```|`/g, "").trim();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Puter.js JSON parse error:", parseError, responseText);
        throw new Error("Invalid JSON from Grok/OpenAI");
      }

      return {
        medications: result.medications || ["Unknown"],
        dosages: result.dosages || ["Unknown"],
        instructions: result.instructions || "No instructions provided.",
        warnings: result.warnings || [],
      };
    } catch (error) {
      console.error("Error analyzing prescription:", error);
      return {
        medications: ["Error"],
        dosages: ["N/A"],
        instructions: "Failed to analyze prescription.",
        warnings: ["Please try again or consult a healthcare professional."],
      };
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (!user) {
      toast.error("Please log in to send messages");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessageId) {
        handleEditMessage(editingMessageId, editedMessage);
      } else {
        handleSendMessage();
      }
    }
  };

  const handlePrescriptionAnalysis = () => {
    if (!user) {
      toast.error("Please log in to analyze prescriptions");
      return;
    }
    setPrescriptionDialogOpen(true);
    setAnalysisResult(null);
  };

  const handleFileUpload = () => {
    if (!user) {
      toast.error("Please log in to upload files");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      toast.error("Please log in to upload files");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFileName(file.name);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleHistoryDialog = () => {
    if (!user) {
      toast.error("Please log in to view chat history");
      return;
    }
    setHistoryDialogOpen(true);
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

  const renderMessages = () => {
    if (!user || !currentSession?.messages || currentSession.messages.length === 0) {
      return null;
    }

    return currentSession.messages.map((msg) => (
      <div
        key={msg.id}
        className="space-y-2 animate-fade-in"
        style={{ animation: "fadeIn 0.3s ease-in" }}
      >
        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
        <div className="flex justify-end items-start space-x-2 max-w-[70%] ml-auto">
          <div className="bg-purple-600 rounded-2xl p-4 text-white text-sm leading-relaxed shadow-md">
            {editingMessageId === msg.id ? (
              <Input
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-white/10 border-none text-white focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-lg"
                aria-label="Edit message"
              />
            ) : (
              <p>{msg.message}</p>
            )}
            <div className="flex space-x-2 mt-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopyText(msg.message)}
                className="text-white hover:text-gray-200 h-6 w-6"
                title="Copy Message"
                aria-label="Copy Message"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEditMessage(msg.id, msg.message)}
                className="text-white hover:text-gray-200 h-6 w-6"
                title={editingMessageId === msg.id ? "Save Edit" : "Edit Message"}
                aria-label={editingMessageId === msg.id ? "Save Edit" : "Edit Message"}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-200 mt-2 opacity-70">{formatISTDateTime(msg.timestamp)}</p>
          </div>
          <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
            <AvatarImage src={userProfile?.photoURL || user?.photoURL || ""} />
            <AvatarFallback className="bg-purple-600 text-white text-sm">
              {userProfile?.displayName?.charAt(0).toUpperCase() ||
                user?.displayName?.charAt(0).toUpperCase() ||
                user?.email?.charAt(0).toUpperCase() ||
                "U"}
            </AvatarFallback>
          </Avatar>
        </div>
        {msg.response ? (
          <div className="flex items-start space-x-2 max-w-[80%]">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 text-foreground text-sm leading-relaxed border border-border shadow-md whitespace-pre-wrap">
              {msg.response.split("\n").map((line, i) => (
                <p key={i} className={line.startsWith("**") ? "font-semibold" : ""}>
                  {line}
                </p>
              ))}
              <div className="flex space-x-2 mt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyText(msg.response)}
                  className="text-muted-foreground hover:text-foreground h-6 w-6"
                  title="Copy Response"
                  aria-label="Copy Response"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleFeedback(msg.id, true)}
                  className="text-muted-foreground hover:text-green-500 h-6 w-6"
                  title="Thumbs Up"
                  aria-label="Thumbs Up"
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleFeedback(msg.id, false)}
                  className="text-muted-foreground hover:text-red-500 h-6 w-6"
                  title="Thumbs Down"
                  aria-label="Thumbs Down"
                >
                  <ThumbsDown className="h-4 w-4" />
              </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 opacity-70">{formatISTDateTime(msg.timestamp)}</p>
            </div>
          </div>
        ) : (
          loading && (
            <div className="flex items-start space-x-2 max-w-[80%]">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 border border-border shadow-md">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    ));
  };

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
              <h1 className="text-xl font-bold text-foreground">
                {currentSession ? currentSession.title : "Your Personalized Medibot"}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {user ? (
                <>
                  <Button
                    onClick={startNewChat}
                    variant="ghost"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 w-10"
                    aria-label="Start new chat"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={handlePrescriptionAnalysis}
                    variant="ghost"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 w-10"
                    aria-label="Analyze Prescription"
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                  <Link href="/history">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 w-10"
                      aria-label="View chat history"
                    >
                      <RotateCcw className="h-5 w-5" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button
                      variant="outline"
                      className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white h-10 px-4"
                    >
                      Login
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button
                      variant="outline"
                      className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white h-10 px-4"
                    >
                      Signup
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
            <div className="max-w-3xl mx-auto space-y-4">
              {!user ? (
                <div className="min-h-full flex items-center justify-center">
                  <div className="w-full max-w-md text-center space-y-8">
                    <div className="flex flex-col items-center space-y-6">
                      <div className="w-20 h-20 relative">
                        <Image src="/logo.png" alt="Medibot Logo" width={80} height={80} className="rounded-full" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-foreground">Welcome to Medibot</h1>
                        <p className="text-muted-foreground text-sm">Please log in or sign up to start chatting.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Link href="/auth/signin" className="block">
                        <Button
                          variant="outline"
                          className="w-full h-12 bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white rounded-xl"
                        >
                          Login
                        </Button>
                      </Link>
                      <Link href="/auth/signup" className="block">
                        <Button
                          variant="outline"
                          className="w-full h-12 bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white rounded-xl"
                        >
                          Signup
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (!currentSession || currentSession.messages.length === 0) ? (
                <div className="min-h-full flex items-center justify-center">
                  <div className="w-full max-w-md text-center space-y-8">
                    <div className="flex flex-col items-center space-y-6">
                      <div className="w-20 h-20 relative">
                        <Image src="/logo.png" alt="Medibot Logo" width={80} height={80} className="rounded-full" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-foreground">Welcome to Medibot</h1>
                        <p className="text-muted-foreground text-sm">Start a conversation below.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                renderMessages()
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input Area */}
          {user && (
            <div className="p-6 border-t border-border bg-card sticky bottom-0">
              <div className="max-w-3xl mx-auto">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-1">
                      <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask a health question or upload an image..."
                        className="bg-white dark:bg-gray-800 border border-border text-foreground placeholder-muted-foreground h-12 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 shadow-sm transition-all"
                        disabled={loading}
                        maxLength={1000}
                        aria-label="Chat message input"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                        <Button
                          onClick={handleFileUpload}
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground hover:bg-gray-200 dark:hover:bg-gray-700 h-8 w-8 rounded-full"
                          title="Upload Image"
                          aria-label="Upload Image"
                        >
                          <Upload className="h-5 w-5" />
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger className="w-[130px] bg-white dark:bg-gray-800 border-border text-foreground text-sm h-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 shadow-sm">
                            <SelectValue placeholder="Model" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-sm shadow-lg rounded-lg">
                            <SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem>
                            <SelectItem value="gemini-1.5-pro-latest">gpt-4o</SelectItem>
                            <SelectItem value="grok">x-ai/grok-3-beta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={loading || (!message.trim() && !selectedFile)}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-full h-12 w-12 shadow-md disabled:opacity-50 transition-all"
                      aria-label="Send Message"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                  {fileName && (
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="secondary"
                        className="bg-gray-200 dark:bg-gray-700 text-muted-foreground text-sm truncate max-w-[300px] rounded-lg"
                      >
                        {fileName}
                      </Badge>
                      <Button
                        onClick={removeFile}
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-red-500 h-8 w-8 rounded-full"
                        title="Remove File"
                        aria-label="Remove File"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prescription Analysis Dialog */}
        {user && (
          <Dialog open={prescriptionDialogOpen} onOpenChange={setPrescriptionDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-2xl mx-auto max-h-[80vh] overflow-y-auto rounded-2xl p-6 shadow-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-lg">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span>Prescription Analysis</span>
                </DialogTitle>
              </DialogHeader>
              {!analysisResult ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Upload a photo of your prescription for AI-powered analysis and information.
                  </p>
                  <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center">
                    {analyzingPrescription ? (
                      <div className="space-y-4">
                        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-muted-foreground text-sm">Analyzing prescription...</p>
                      </div>
                    ) : (
                      <>
                        <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground text-sm mb-4">Upload prescription image</p>
                        <Button
                          onClick={handleFileUpload}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Choose File
                        </Button>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAnalyzingPrescription(true);
                        analyzePrescription(file, selectedModel)
                          .then((analysis) => {
                            setAnalysisResult(analysis);
                            toast.success("Prescription analyzed successfully!");
                          })
                          .catch((error) => {
                            console.error("Error analyzing prescription:", error);
                            toast.error("Failed to analyze prescription");
                          })
                          .finally(() => {
                            setAnalyzingPrescription(false);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          });
                      }
                    }}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported formats: JPG, PNG, HEIC. This feature analyzes prescription information for educational purposes only.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Card className="bg-card border-border rounded-2xl shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span>Analysis Results</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Detected Medications</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.medications.map((med, index) => (
                              <Badge key={index} className="bg-purple-600 text-white text-sm rounded-lg">
                                <Pill className="mr-2 h-3 w-3" />
                                {med}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Dosage Information</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.dosages.map((dosage, index) => (
                              <Badge key={index} variant="secondary" className="bg-muted text-muted-foreground text-sm rounded-lg">
                                {dosage}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Instructions</h4>
                        <p className="text-muted-foreground text-sm bg-muted p-3 rounded-lg">
                          {analysisResult.instructions}
                        </p>
                      </div>
                      {analysisResult.warnings?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center">
                            <AlertCircle className="mr-2 h-5 w-5 text-yellow-500" />
                            <span>Warnings & Precautions</span>
                          </h4>
                          <div className="space-y-2">
                            {analysisResult.warnings.map((warning, index) => (
                              <div key={index} className="bg-yellow-900/20 border border-yellow-700 p-3 rounded-lg">
                                <p className="text-yellow-300 text-sm">{warning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-blue-900/20 border border-blue-700 p-3 rounded-lg">
                        <p className="text-blue-300 text-sm">
                          <strong>Important:</strong> This analysis is for informational purposes only. Always follow your doctor's instructions and consult your pharmacist.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <Button
                      onClick={() => {
                        setAnalysisResult(null);
                        setPrescriptionDialogOpen(false);
                      }}
                      variant="outline"
                      className="flex-1 bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white text-sm rounded-lg"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => setAnalysisResult(null)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg"
                    >
                      Analyze Another
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}

        {/* History Dialog */}
        {user && (
          <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-md mx-auto p-6 rounded-2xl shadow-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-lg">
                  <RotateCcw className="h-5 w-5 text-muted-foreground" />
                  <span>Recent Chats</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto max-h-96">
                {chatSessions.length > 0 ? (
                  chatSessions.slice(0, 10).map((session) => (
                    <div
                      key={session.id}
                      className={`p-4 rounded-xl border border-border cursor-pointer transition-colors ${
                        currentSession?.id === session.id
                          ? "bg-purple-600/20 border-purple-600"
                          : "bg-muted hover:bg-purple-600/10"
                      }`}
                      onClick={() => {
                        setCurrentSession(session);
                        setHistoryDialogOpen(false);
                        router.push(`/chat?sessionId=${session.id}`);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm truncate">{session.title}</h3>
                          <p className="text-muted-foreground text-sm">
                            {session.messages.length} messages • {formatISTDateTime(session.updatedAt)}
                          </p>
                          {session.messages.length > 0 && (
                            <p className="text-muted-foreground text-sm mt-1 truncate">
                              {session.messages[session.messages.length - 1]?.message || "No messages"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <RotateCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">No chat history yet</p>
                    <p className="text-muted-foreground text-sm">Start a conversation to see your history here</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-4 border-t border-border">
                <Link href="/history">
                  <Button
                    variant="outline"
                    className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white text-sm rounded-lg"
                    onClick={() => setHistoryDialogOpen(false)}
                  >
                    View Full History
                  </Button>
                </Link>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AuthGuard>
  );
}
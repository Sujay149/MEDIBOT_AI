"use client";
import { Star, Circle, Check } from "lucide-react";
import type React from "react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // Changed from Input to Textarea
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Menu, Camera, RotateCcw, Plus, Send, Upload, X, FileText, Pill, AlertCircle, Copy, ThumbsUp, ThumbsDown, Edit, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  createChatSession,
  addMessageToSession,
  subscribeToUserChatSessions,
  type ChatSession,
} from "@/lib/firestore";
import { toast } from "sonner";
import Link from "next/link";

interface PrescriptionAnalysis {
  medications: string[];
  dosages: string[];
  instructions: string;
  warnings: string[];
  patientName?: string;
  doctorName?: string;
  hospital?: string;
  userId?: string;
  fileName?: string;
  createdAt?: Date;
}

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PrescriptionAnalysis | null>(null);
  const [analyzingPrescription, setAnalyzingPrescription] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash-latest");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [imageType, setImageType] = useState<"Prescription Receipt" | "Tablet Strip">("Prescription Receipt");
  const [historySearch, setHistorySearch] = useState("");
  const { user, userProfile } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserChatSessions(user.uid, (userSessions) => {
      const normalizedSessions = userSessions.map((session) => ({
        ...session,
        messages: session.messages ?? [],
      }));
      setSessions(normalizedSessions);
      if (!currentSession && normalizedSessions.length > 0) {
        setCurrentSession(normalizedSessions[0]);
      }
    });

    return () => unsubscribe();
  }, [user, currentSession]);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startNewChat = async () => {
    if (!user) {
      toast.error("Please log in to start a new chat");
      return;
    }

    try {
      const sessionId = await createChatSession(user.uid, "New Chat");
      const newSession: ChatSession = {
        id: sessionId,
        userId: user.uid,
        title: "New Chat",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setCurrentSession(newSession);
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

    if (!message.trim() && !selectedFile) return;

    const userMessage = message.trim() || "Image uploaded";
    let imageBase64: string | undefined;
    if (selectedFile) {
      imageBase64 = await fileToBase64(selectedFile);
    }

    setMessage("");
    setSelectedFile(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    try {
      let sessionToUse = currentSession;

      if (!sessionToUse) {
        const smartTitle = message.trim() ? generateChatTitle(message) : `Prescription Analysis - ${imageType}`;
        const sessionId = await createChatSession(user.uid, smartTitle);
        sessionToUse = {
          id: sessionId,
          userId: user.uid,
          title: smartTitle,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setCurrentSession(sessionToUse);
      }

      let botResponse = "";
      if (message.trim()) {
        botResponse = await generateAIResponse(message);
      }
      if (selectedFile) {
        const analysis = await analyzePrescription(selectedFile, imageType);
        const analysisText = formatPrescriptionAnalysis(analysis);
        botResponse = botResponse ? `${botResponse}\n\n${analysisText}` : analysisText;
      }

      if (sessionToUse.id) {
        const newMessage = await addMessageToSession(
          sessionToUse.id,
          user.uid,
          userMessage,
          botResponse,
          "chat"
        );

        setCurrentSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...(prev.messages ?? []), newMessage],
            updatedAt: new Date(),
          };
        });

        sendMessageNotification(userMessage, botResponse);
        toast.success("Message sent!");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
      setMessage(message);
      if (selectedFile) {
        setSelectedFile(selectedFile);
        setFileName(selectedFile.name);
      }
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
        const botResponse = await generateAIResponse(editedMessage);
        const sessionId = currentSession?.id;
        if (sessionId) {
          const updatedMessages = (currentSession?.messages ?? []).map((msg, index) =>
            `user-${index}` === messageId ? { ...msg, message: editedMessage, response: botResponse } : msg
          );
          await addMessageToSession(sessionId, user.uid, editedMessage, botResponse, "chat");
          setCurrentSession((prev) => (prev ? { ...prev, messages: updatedMessages } : prev));
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
    toast.success(isPositive ? "Thanks for the thumbs up!" : "Thanks for the feedback!");
    // Future: Log feedback to Firestore or analytics
  };

  const generateChatTitle = (firstMessage: string): string => {
    const lowerMessage = firstMessage.toLowerCase();
    if (lowerMessage.includes("headache") || lowerMessage.includes("migraine")) return "Headache Consultation";
    if (lowerMessage.includes("fever") || lowerMessage.includes("temperature")) return "Fever Assessment";
    if (lowerMessage.includes("medication") || lowerMessage.includes("medicine")) return "Medication Inquiry";
    if (lowerMessage.includes("diet") || lowerMessage.includes("nutrition")) return "Nutrition Guidance";
    if (lowerMessage.includes("exercise") || lowerMessage.includes("workout")) return "Exercise Consultation";
    if (lowerMessage.includes("sleep") || lowerMessage.includes("insomnia")) return "Sleep Health";
    if (lowerMessage.includes("stress") || lowerMessage.includes("anxiety")) return "Mental Health Support";
    if (lowerMessage.includes("pain")) return "Pain Management";

    const words = firstMessage.split(" ").filter((word) => word.length > 3);
    if (words.length > 0) return `${words[0].charAt(0).toUpperCase() + words[0].slice(1)} Discussion`;

    return "Health Consultation";
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

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    try {
      const endpoint = selectedModel === "grok"
        ? "https://api.x.ai/v1/models/grok:generateContent"
        : `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

      const response = await fetch(
        `${endpoint}?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are Medibot, a health-focused AI assistant. Provide a concise, informative, and professional response to the following health-related user query. Ensure the response is educational, not a substitute for professional medical advice, and includes a reminder to consult a healthcare professional for personalized advice. Query: ${userMessage}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 200,
            },
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response generated.";

      return botResponse;
    } catch (error) {
      console.error("Error calling AI API:", error);
      return "I'm sorry, I couldn't process your request at this time. Please try again later or consult a healthcare professional for personalized advice";
    }
  };

  const analyzePrescription = async (file: File, type: "Prescription Receipt" | "Tablet Strip"): Promise<PrescriptionAnalysis> => {
    try {
      const endpoint = selectedModel === "grok"
        ? "https://api.x.ai/v1/models/grok:analyzePrescription"
        : `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

      const prompt = type === "Prescription Receipt"
        ? `The image shows a medical prescription or receipt. Extract the list of medicines, their usage or purpose, and the patient name if visible. Format the response in JSON with fields: medications (array), dosages (array), instructions (string), warnings (array), patientName (string, optional), doctorName (string, optional), hospital (string, optional).`
        : `The image shows a tablet strip or medicine packaging. Extract any visible text or information. If there’s useful information like medicine name, usage, brand, or expiry, summarize it in JSON with fields: medications (array), dosages (array), instructions (string), warnings (array).`;

      const response = await fetch(
        `${endpoint}?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: file.type,
                      data: await fileToBase64(file),
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 500,
            },
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      responseText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/`/g, "")
        .trim();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        throw new Error("Invalid JSON response");
      }

      return {
        medications: result.medications || ["Unknown"],
        dosages: result.dosages || ["Unknown"],
        instructions: result.instructions || "No instructions provided.",
        warnings: result.warnings || [],
        patientName: result.patientName || undefined,
        doctorName: result.doctorName || undefined,
        hospital: result.hospital || undefined,
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

  const formatPrescriptionAnalysis = (analysis: PrescriptionAnalysis): string => {
    let text = `**Prescription Analysis**:\n`;
    text += `- **Medications**: ${analysis.medications.join(", ")}\n`;
    text += `- **Dosages**: ${analysis.dosages.join(", ")}\n`;
    text += `- **Instructions**: ${analysis.instructions}\n`;
    if (analysis.warnings.length) {
      text += `- **Warnings**: ${analysis.warnings.join(", ")}\n`;
    }
    if (analysis.patientName) {
      text += `- **Patient Name**: ${analysis.patientName}\n`;
    }
    if (analysis.doctorName) {
      text += `- **Doctor Name**: ${analysis.doctorName}\n`;
    }
    if (analysis.hospital) {
      text += `- **Hospital**: ${analysis.hospital}\n`;
    }
    return text;
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
    if (imagePreviewRef.current) {
      imagePreviewRef.current.src = URL.createObjectURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imagePreviewRef.current) imagePreviewRef.current.src = "";
  };

  const handleHistoryDialog = () => {
    if (!user) {
      toast.error("Please log in to view chat history");
      return;
    }
    setHistoryDialogOpen(true);
    setHistorySearch("");
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    toast.info(`Switched to ${model} model`);
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n").map((line, index) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={index} className="font-semibold">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith("* ")) {
        return <li key={index} className="ml-4">{line.slice(2)}</li>;
      }
      return <p key={index}>{line}</p>;
    });
    return <div>{lines}</div>;
  };

  const renderMessages = () => {
    if (!user) return null;
    if (!currentSession?.messages || currentSession.messages.length === 0) {
      return null;
    }

    const allMessages: Array<{
      type: "user" | "bot";
      content: string;
      timestamp?: any;
      id: string;
      image?: string;
    }> = [];

    currentSession.messages.forEach((msg, index) => {
      allMessages.push({
        type: "user",
        content: msg.message,
        timestamp: msg.timestamp,
        id: `user-${index}`,
        image: msg.image,
      });

      if (msg.response) {
        allMessages.push({
          type: "bot",
          content: msg.response,
          timestamp: msg.timestamp,
          id: `bot-${index}`,
        });
      }
    });

    return allMessages.map((msg) => (
      <div
        key={msg.id}
        className={`flex ${msg.type === "user" ? "justify-end" : "items-start space-x-2 sm:space-x-3"} mb-3 sm:mb-4`}
      >
        {msg.type === "bot" && (
          <div className="flex-1 max-w-[80%] sm:max-w-3xl">
            <div className="bg-muted rounded-xl rounded-tl-md p-3 sm:p-4 text-foreground text-xs sm:text-sm leading-relaxed border border-border whitespace-pre-wrap">
              {renderMarkdown(msg.content)}
              <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                <span>{msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString() : "Recent"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyText(msg.content)}
                  className="text-muted-foreground hover:text-foreground h-6 w-6"
                  title="Copy Response"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleFeedback(msg.id, true)}
                  className="text-muted-foreground hover:text-green-500 h-6 w-6"
                  title="Thumbs Up"
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleFeedback(msg.id, false)}
                  className="text-muted-foreground hover:text-red-500 h-6 w-6"
                  title="Thumbs Down"
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {msg.type === "user" && (
          <div className="flex items-start space-x-2 sm:space-x-3 max-w-[70%] sm:max-w-md">
            <div className="bg-purple-600 rounded-xl rounded-tr-md p-3 sm:p-4 text-white text-xs sm:text-sm leading-relaxed">
              {editingMessageId === msg.id ? (
                <>
                  <Textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600 w-full resize-none"
                  />
                  <div className="mt-2 text-xs bg-muted p-2 rounded">
                    <p>Preview:</p>
                    {renderMarkdown(editedMessage)}
                  </div>
                </>
              ) : (
                <>
                  {msg.image && (
                    <img
                      src={`data:image/jpeg;base64,${msg.image}`}
                      alt="Uploaded Image"
                      className="max-w-full h-auto rounded-md mb-2"
                    />
                  )}
                  {renderMarkdown(msg.content)}
                </>
              )}
              <div className="flex items-center space-x-2 mt-2 text-xs">
                <span>{msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString() : "Recent"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyText(msg.content)}
                  className="text-white hover:text-gray-200 h-6 w-6"
                  title="Copy Message"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditMessage(msg.id, msg.content)}
                  className="text-white hover:text-gray-200 h-6 w-6"
                  title={editingMessageId === msg.id ? "Save Edit" : "Edit Message"}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Avatar className="w-6 h-6 sm:w-8 sm:h-8 mt-1 flex-shrink-0">
              <AvatarImage src={userProfile?.photoURL || user?.photoURL || ""} />
              <AvatarFallback className="bg-purple-600 text-white text-xs sm:text-sm">
                {userProfile?.displayName?.charAt(0).toUpperCase() ||
                  user?.displayName?.charAt(0).toUpperCase() ||
                  user?.email?.charAt(0).toUpperCase() ||
                  "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    ));
  };

  // Function to split text into lines with a maximum number of words
  const splitTextIntoLines = (text: string, wordsPerLine: number = 10): string[] => {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine).join(" "));
    }
    return lines;
  };

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-card">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground lg:hidden h-10 w-10"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Your Personalized Medibot</h1>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2">
              {!user ? (
                <>
                  <Link href="/auth/signin">
                    <Button
                      variant="outline"
                      className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
                    >
                      Login
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button
                      variant="outline"
                      className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
                    >
                      Signup
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button
                    onClick={startNewChat}
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
                    title="Start New Chat"
                    aria-label="Start New Chat"
                  >
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                  <Button
                    onClick={handlePrescriptionAnalysis}
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
                    title="Prescription Analysis"
                    aria-label="Prescription Analysis"
                  >
                    <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                  <Button
                    onClick={handleHistoryDialog}
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
                    title="Chat History"
                    aria-label="Chat History"
                  >
                    <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
            <div className="max-w-full sm:max-w-3xl md:max-w-4xl mx-auto space-y-4 sm:space-y-6">
              {!user ? (
                <div className="min-h-full flex items-center justify-center">
                  <div className="w-full max-w-md text-center space-y-8">
                    <div className="flex flex-col items-center space-y-6">
                      <div className="w-20 h-20 relative">
                        <Image src="/logo.png" alt="Medibot Logo" width={80} height={80} className="rounded-full" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold">Welcome to Medibot</h1>
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
              ) : (!currentSession || (currentSession.messages ?? []).length === 0) ? (
                <div className="min-h-full flex items-center justify-center">
                  <div className="w-full max-w-md text-center space-y-8">
                    <div className="flex flex-col items-center space-y-6">
                      <div className="w-20 h-20 relative">
                        <Image src="/logo.png" alt="Medibot Logo" width={80} height={80} className="rounded-full" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold">Welcome to Medibot</h1>
                        <p className="text-muted-foreground text-sm">Start a conversation below.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {renderMessages()}
                </>
              )}

              {loading && user && (
                <div className="flex justify-end mb-3 sm:mb-4">
  <div className="flex items-start space-x-2 sm:space-x-3 max-w-[70%] sm:max-w-md">
    <div className="bg-transparent rounded-xl rounded-tr-md p-3 sm:p-4 text-white text-xs sm:text-sm leading-relaxed border border-white/20">
      <div className="flex items-center space-x-2">
        <span className="whitespace-nowrap">Medibot is thinking</span>
        <div className="flex items-end space-x-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0s]"></span>
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.15s]"></span>
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.3s]"></span>
        </div>
      </div>
    </div>

    <Avatar className="w-6 h-6 sm:w-8 sm:h-8 mt-1 flex-shrink-0">
      <AvatarImage src={userProfile?.photoURL || user?.photoURL || ""} />
      <AvatarFallback className="bg-purple-600 text-white text-xs sm:text-sm">
        {userProfile?.displayName?.charAt(0).toUpperCase() ||
          user?.displayName?.charAt(0).toUpperCase() ||
          user?.email?.charAt(0).toUpperCase() ||
          "U"}
      </AvatarFallback>
    </Avatar>
  </div>
</div>

              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
        {user && (
  <div className="p-3 sm:p-4 md:p-6 border-t border-border bg-card sticky bottom-0 z-10">
    <div className="max-w-4xl mx-auto w-full">
      <div className="relative">
        {/* Textarea */}
        <Textarea
          value={message}
          onChange={(e) => setMessage(splitTextIntoLines(e.target.value).join("\n"))}
          onKeyPress={handleKeyPress}
          placeholder="Ask a health question or upload an image..."
          className="w-full bg-muted text-foreground placeholder-muted-foreground rounded-xl border border-border px-4 py-3 pr-[140px] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none min-h-[60px] sm:min-h-[80px] max-h-[200px] overflow-y-auto shadow-sm"
          disabled={loading}
          maxLength={1000}
        />

        {/* Action buttons: Upload, Model, Send */}
        <div className="absolute bottom-3 right-4 flex items-center space-x-2">
          {/* Upload Button */}
          <Button
            onClick={handleFileUpload}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8"
            title="Upload Image"
            aria-label="Upload Image"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Model Selector */}
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="w-[100px] sm:w-[120px] text-xs h-8 bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-purple-600">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground text-xs shadow-lg">
              <SelectItem value="gemini-1.5-flash-latest">Gemini Flash</SelectItem>
              <SelectItem value="gemini-1.5-pro-latest">Gemini Pro</SelectItem>
              <SelectItem value="grok">Grok (Beta)</SelectItem>
            </SelectContent>
          </Select>

          {/* Send Button */}
          <Button
            onClick={handleSendMessage}
            disabled={loading || (!message.trim() && !selectedFile)}
            size="icon"
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full h-8 w-8 sm:h-9 sm:w-9 shadow-lg disabled:opacity-50"
            aria-label="Send Message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* File Preview */}
      {fileName && (
        <div className="flex items-center space-x-2 mt-3">
          <Badge className="bg-muted text-muted-foreground text-xs truncate max-w-[60%] sm:max-w-[300px]">
            {fileName}
          </Badge>
          <img
            ref={imagePreviewRef}
            alt="Image Preview"
            className="h-10 w-10 object-cover rounded-md"
            hidden={!selectedFile}
          />
          <Button
            onClick={removeFile}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-red-500 h-6 w-6"
            title="Remove File"
            aria-label="Remove File"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  </div>
)}

        </div>

        {user && (
          <>
            <Dialog open={prescriptionDialogOpen} onOpenChange={setPrescriptionDialogOpen}>
              <DialogContent className="bg-card border-border text-foreground max-w-[90vw] sm:max-w-2xl mx-auto max-h-[90vh] sm:max-h-[80vh] overflow-y-auto sm:rounded-xl p-4 sm:p-6 shadow">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2 text-lg">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <span>Prescription Analysis</span>
                  </DialogTitle>
                </DialogHeader>

                {!analysisResult ? (
                  <div className="space-y-3 sm:space-y-4">
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      Upload a photo of your prescription or tablet strip for AI-powered analysis.
                    </p>
                    <Select value={imageType} onValueChange={(value) => setImageType(value as "Prescription Receipt" | "Tablet Strip")}>
                      <SelectTrigger className="w-full bg-muted border-border text-foreground text-sm h-10">
                        <SelectValue placeholder="Image Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-sm shadow-lg">
                        <SelectItem value="Prescription Receipt">Prescription Receipt</SelectItem>
                        <SelectItem value="Tablet Strip">Tablet Strip</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="border-2 border-dashed border-border rounded-xl p-6 sm:p-8 text-center">
                      {analyzingPrescription ? (
                        <div className="space-y-3 sm:space-y-4">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <p className="text-muted-foreground text-xs sm:text-sm">Analyzing {imageType.toLowerCase()}...</p>
                        </div>
                      ) : (
                        <>
                          <Camera className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                          <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4">Upload {imageType.toLowerCase()} image</p>
                          <Button
                            onClick={handleFileUpload}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm"
                          >
                            <Upload className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
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
                          analyzePrescription(file, imageType)
                            .then((analysis) => {
                              setAnalysisResult(analysis);
                              toast.success(`${imageType} analyzed successfully!`);
                            })
                            .catch((error) => {
                              console.error("Error analyzing prescription:", error);
                              toast.error(`Failed to analyze ${imageType.toLowerCase()}`);
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
                      Supported formats: JPG, PNG, HEIC. This feature analyzes {imageType.toLowerCase()} information for educational purposes only.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    <Card className="bg-card border-border rounded-xl shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-lg">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span>{imageType} Analysis Results</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 sm:space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:gap-4">
                          <div>
                            <h4 className="font-semibold text-sm mb-1 sm:mb-2">Detected Medications</h4>
                            <div className="space-y-1 sm:space-y-2 flex flex-wrap gap-1">
                              {analysisResult.medications.map((med, index) => (
                                <Badge key={index} className="bg-purple-600 text-white text-xs sm:text-sm mr-1 mb-1">
                                  <Pill className="mr-1 h-3 w-3 sm:h-3 sm:w-3" />
                                  {med}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-sm mb-1 sm:mb-2">Dosage Information</h4>
                            <div className="space-y-1 sm:space-y-2 flex flex-wrap gap-1">
                              {analysisResult.dosages.map((dosage, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="bg-muted text-muted-foreground text-xs sm:text-sm mr-1 mb-1"
                                >
                                  {dosage}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-1 sm:mb-2">Instructions</h4>
                          <p className="text-muted-foreground text-xs sm:text-sm bg-muted p-2 sm:p-3 rounded-lg">
                            {analysisResult.instructions}
                          </p>
                        </div>

                        {analysisResult.patientName && (
                          <div>
                            <h4 className="font-semibold text-sm mb-1 sm:mb-2">Patient Name</h4>
                            <p className="text-muted-foreground text-xs sm:text-sm bg-muted p-2 sm:p-3 rounded-lg">
                              {analysisResult.patientName}
                            </p>
                          </div>
                        )}

                        {analysisResult.doctorName && (
                          <div>
                            <h4 className="font-semibold text-sm mb-1 sm:mb-2">Doctor Name</h4>
                            <p className="text-muted-foreground text-xs sm:text-sm bg-muted p-2 sm:p-3 rounded-lg">
                              {analysisResult.doctorName}
                            </p>
                          </div>
                        )}

                        {analysisResult.hospital && (
                          <div>
                            <h4 className="font-semibold text-sm mb-1 sm:mb-2">Hospital</h4>
                            <p className="text-muted-foreground text-xs sm:text-sm bg-muted p-2 sm:p-3 rounded-lg">
                              {analysisResult.hospital}
                            </p>
                          </div>
                        )}

                        {analysisResult.warnings?.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-1 sm:mb-2 flex items-center">
                              <AlertCircle className="mr-1 h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                              <span>Warnings & Precautions</span>
                            </h4>
                            <div className="space-y-1 sm:space-y-2">
                              {analysisResult.warnings.map((warning, index) => (
                                <div key={index} className="bg-yellow-900/20 border border-yellow-700 p-2 sm:p-3 rounded-lg">
                                  <p className="text-yellow-300 text-xs sm:text-sm">{warning}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="bg-blue-900/20 border border-blue-700 p-3 sm:p-4 rounded-lg">
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
                        className="flex-1 bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white text-sm"
                      >
                        Close
                      </Button>
                      <Button
                        onClick={() => setAnalysisResult(null)}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm"
                      >
                        Analyze Another
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
              <DialogContent className="bg-card border-border text-foreground max-w-md mx-auto p-6 sm:p-6 rounded-xl shadow">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center space-x-2">
                      <RotateCcw className="h-5 w-5 text-muted-foreground" />
                      <span>Recent Chats</span>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <div className="flex items-center space-x-2 mb-4">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search chat history..."
                    className="bg-muted border-border text-foreground text-sm h-8"
                  />
                </div>

                <div className="space-y-4 overflow-y-auto max-h-96">
                  {sessions
                    .filter((session) =>
                      session.title.toLowerCase().includes(historySearch.toLowerCase()) ||
                      (session.messages || []).some((msg) => msg.message.toLowerCase().includes(historySearch.toLowerCase()))
                    )
                    .slice(0, 10)
                    .map((session) => (
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
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm truncate">{session.title}</h3>
                            <p className="text-muted-foreground text-sm">
                              {(session.messages || []).length} messages •{" "}
                              {session.updatedAt instanceof Date
                                ? session.updatedAt.toLocaleDateString()
                                : (session.updatedAt as any)?.toDate?.()?.toLocaleDateString() || "Recently"}
                            </p>
                            {(session.messages || []).length > 0 && (
                              <p className="text-muted-foreground text-sm mt-1 truncate">
                                {session.messages[session.messages.length - 1]?.message || "No messages"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  {sessions.length === 0 && (
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
                      className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white text-sm"
                      onClick={() => setHistoryDialogOpen(false)}
                    >
                      View Full History
                    </Button>
                  </Link>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
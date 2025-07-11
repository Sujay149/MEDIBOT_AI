
"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Search } from "lucide-react";
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
  Mic,
  Volume2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  createChatSession,
  addMessageToSession,
  subscribeToUserChatSessions,
  type ChatSession,
} from "@/lib/firestore";
import { toast } from "sonner";
import Link from "next/link";
import { debounce } from "lodash";
import firebase from "firebase/firestore";

declare global {
  interface Window {
    puter: any;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
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
    image?: string | null;
    message: string;
    response: string;
    timestamp: Date;
    type: "chat" | "summarizer";
  }>;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

function ChatContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [currentSession, setCurrentSession] = useState<ProcessedChatSession | null>(null);
  const [sessions, setSessions] = useState<ProcessedChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PrescriptionAnalysis | null>(null);
  const [analyzingPrescription, setAnalyzingPrescription] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { user, userProfile } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = "en-US";
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsRecording(false);
        };
        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          toast.error(
            event.error === "no-speech"
              ? "No speech detected. Please try again."
              : event.error === "not-allowed"
              ? "Microphone access denied. Please allow microphone permissions in browser settings."
              : "Speech recognition failed. Try again or check browser support."
          );
          setIsRecording(false);
        };
        recognitionRef.current.onend = () => setIsRecording(false);
      } else {
        toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      }
    }
  }, []);

  // Request microphone permissions
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.permissions) {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then((permissionStatus) => {
        if (permissionStatus.state === "denied") {
          toast.error("Microphone access denied. Please enable it in browser settings.");
        }
        permissionStatus.onchange = () => {
          if (permissionStatus.state === "denied") {
            toast.error("Microphone access revoked. Please enable it in browser settings.");
          }
        };
      });
    }
  }, []);

  // Load Puter.js
  useEffect(() => {
    if (typeof window !== "undefined" && !window.puter) {
      const script = document.createElement("script");
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      script.onload = () => console.log("Puter.js loaded");
      script.onerror = () => {
        console.error("Failed to load Puter.js");
        toast.error("Failed to load AI service. Falling back to MediBot model.");
      };
      document.head.appendChild(script);
    }
  }, []);

  // Normalize Firestore Timestamp
  const normalizeSession = (session: ChatSession): ProcessedChatSession => ({
    ...session,
    messages: (session.messages || []).map((msg) => ({
      ...msg,
      id: msg.id || uuidv4(),
      timestamp: msg.timestamp instanceof Date
        ? msg.timestamp
        : (msg.timestamp as firebase.Timestamp)?.toDate?.() || new Date(),
      image: msg.image && typeof msg.image === "string" && msg.image.startsWith("https://") ? msg.image : null,
    })),
    createdAt: session.createdAt instanceof Date
      ? session.createdAt
      : (session.createdAt as firebase.Timestamp)?.toDate?.() || new Date(),
    updatedAt: session.updatedAt instanceof Date
      ? session.updatedAt
      : (session.updatedAt as firebase.Timestamp)?.toDate?.() || new Date(),
  });

  // Fetch sessions and start new chat on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setCurrentSession(null);
      return;
    }

    let unsubscribe: () => void;

    const fetchSessions = async () => {
      try {
        unsubscribe = subscribeToUserChatSessions(user.uid, (userSessions) => {
          const normalizedSessions = userSessions.map(normalizeSession).sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          );
          setSessions(normalizedSessions);
        });

        // Start a new chat session on mount
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
      } catch (error) {
        console.error("Error fetching sessions:", error);
        toast.error("Failed to load chat sessions");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    return () => unsubscribe?.();
  }, [user]);

  // Auto-scroll to latest message
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
      toast.success("New chat started!");
    } catch (error) {
      console.error("Error starting new chat:", error);
      toast.error("Failed to start new chat");
    }
  };

  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    try {
      const validTypes = ["image/jpeg", "image/png", "image/heic", "application/pdf"];
      if (!validTypes.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Please upload a JPG, PNG, HEIC, or PDF.`);
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "medibot_Uploads");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${
          file.type === "application/pdf" ? "raw" : "image"
        }/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudinary upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const url = data.secure_url;
      if (!url || typeof url !== "string" || !url.startsWith("https://")) {
        console.warn("Invalid Cloudinary URL:", url);
        return null;
      }
      return url;
    } catch (error: any) {
      console.error("Error uploading to Cloudinary:", error);
      toast.error(`Failed to upload file: ${error.message || "Unknown error"}`);
      return null;
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

    const userMessage = message.trim() || "File uploaded";
    const messageId = uuidv4();
    setLoading(true);

    try {
      let sessionId = currentSession?.id;
      if (!sessionId) {
        const smartTitle = message.trim() ? generateChatTitle(message) : "File Chat";
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
      } else if (currentSession?.title === "New Chat" && message.trim()) {
        const smartTitle = generateChatTitle(message);
        setCurrentSession((prev) => (prev ? { ...prev, title: smartTitle } : prev));
      }

      let fileUrl: string | null = null;
      if (selectedFile) {
        fileUrl = await uploadImageToCloudinary(selectedFile);
      }

      const tempMessage: ProcessedChatSession["messages"][0] = {
        id: messageId,
        userId: user.uid,
        message: userMessage,
        response: "",
        timestamp: new Date(),
        type: "chat",
        image: fileUrl ?? null,
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
        botResponse = await generateAIResponse(userMessage, selectedModel);
      }
      if (fileUrl) {
        const analysis = await analyzePrescription(selectedFile!);
        const analysisText = `**Prescription Analysis**:\n- **Medications**: ${analysis.medications.join(", ")}\n- **Dosages**: ${analysis.dosages.join(", ")}\n- **Instructions**: ${analysis.instructions}${analysis.warnings.length ? "\n- **Warnings**: " + analysis.warnings.join(", ") : ""}`;
        botResponse = botResponse ? `${botResponse}\n\n${analysisText}` : analysisText;
      }

      const newMessage = await addMessageToSession(sessionId!, user.uid, userMessage, botResponse, "chat", fileUrl);
      setCurrentSession((prev) => {
        if (!prev) return prev;
        const updatedMessages = prev.messages.map((msg) =>
          msg.id === messageId
            ? {
                ...newMessage,
                id: newMessage.id || uuidv4(),
                timestamp: newMessage.timestamp instanceof Date
                  ? newMessage.timestamp
                  : (newMessage.timestamp as firebase.Timestamp).toDate(),
                image: newMessage.image ?? null,
              }
            : msg
        );
        return {
          ...prev,
          messages: updatedMessages,
          updatedAt: new Date(),
        };
      });

      sendMessageNotification(userMessage, botResponse);
      toast.success("Message sent successfully");
    } catch (error: any) {
      console.error("Error sending message:", error);
      if (error.message.includes("rate limit")) {
        toast.error(
          <>
            Rate limit reached. Try again later or{" "}
            <Link href="https://console.groq.com/docs/pricing" className="underline">
              upgrade your Groq plan
            </Link>{" "}
            for higher usage quotas.
          </>
        );
      } else {
        toast.error(`Failed to send message: ${error.message || "Unknown error"}`);
      }
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

  const handleRetryResponse = async (messageId: string, userMessage: string) => {
    if (!user) {
      toast.error("Please log in to retry responses");
      return;
    }

    setLoading(true);
    try {
      const botResponse = await generateAIResponse(userMessage, selectedModel);
      const sessionId = currentSession?.id;
      if (sessionId) {
        const existingMessage = currentSession!.messages.find((msg) => msg.id === messageId);
        const updatedMessages = currentSession!.messages.map((msg) =>
          msg.id === messageId ? { ...msg, response: botResponse } : msg
        );

        await addMessageToSession(sessionId, user.uid, userMessage, botResponse, "chat", existingMessage?.image ?? null);
        setCurrentSession((prev) => (prev ? { ...prev, messages: updatedMessages } : prev));
        toast.success("Response regenerated!");
      }
    } catch (error) {
      console.error("Error retrying response:", error);
      toast.error("Failed to regenerate response");
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
          const existingMessage = currentSession!.messages.find((msg) => msg.id === messageId);
          const updatedMessages = currentSession!.messages.map((msg) =>
            msg.id === messageId ? { ...msg, message: editedMessage, response: botResponse } : msg
          );

          await addMessageToSession(sessionId, user.uid, editedMessage, botResponse, "chat", existingMessage?.image ?? null);
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

  const handleFeedback = async (messageId: string, isPositive: boolean) => {
    if (!user) {
      toast.error("Please log in to provide feedback");
      return;
    }

    try {
      toast.success(`Thank you for your ${isPositive ? "positive" : "negative"} feedback!`);
    } catch (error) {
      console.error("Error handling feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleSpeakResponse = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Text-to-speech not supported in this browser");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      utteranceRef.current = null;
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      toast.error("Speech stopped");
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleToggleRecording = () => {
    if (!user) {
      toast.error("Please log in to use speech input");
      return;
    }
    if (!recognitionRef.current) {
      toast.error("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        toast.error("Failed to start speech recognition. Check microphone permissions.");
        setIsRecording(false);
      }
    }
  };

  const exportChat = () => {
    if (!currentSession) return;
    const content = currentSession.messages
      .map((msg) => `User: ${msg.message}\nAI: ${msg.response}\n`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentSession.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exported successfully!");
  };

  const generateChatTitle = (firstMessage: string): string => {
    const lowerMessage = firstMessage.toLowerCase().trim();
    if (lowerMessage.length === 0) return "General Discussion";

    const healthKeywords = [
      { keywords: ["headache", "migraine"], title: "Headache Inquiry" },
      { keywords: ["fever", "temperature"], title: "Fever Inquiry" },
      { keywords: ["medication", "medicine", "prescription"], title: "Medication Inquiry" },
      { keywords: ["diet", "nutrition", "food"], title: "Nutrition Inquiry" },
      { keywords: ["exercise", "workout", "fitness"], title: "Exercise Inquiry" },
      { keywords: ["sleep", "insomnia"], title: "Sleep Inquiry" },
      { keywords: ["stress", "anxiety", "mental"], title: "Mental Health Inquiry" },
      { keywords: ["pain"], title: "Pain Inquiry" },
    ];

    for (const { keywords, title } of healthKeywords) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        return title;
      }
    }

    const words = lowerMessage.split(/\s+/).filter((word) => word.length > 3);
    if (words.length === 0) return "General Discussion";

    const keyPhrase = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return `${keyPhrase} Discussion`;
  };

  const sendMessageNotification = (userMessage: string, botResponse: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("MediBot Response", {
        body: "Your message has been answered",
        icon: "/logo.png",
        badge: "/logo.png",
      });
    }
  };

  const generateAIResponse = async (userMessage: string, selectedModel: string): Promise<string> => {
    try {
      const modelMap: Record<string, string> = {
        "gemini-2.0-flash": "gemini-2.0-flash",
        "grok": "x-ai/grok-3-beta",
        "gpt-4o": "gpt-4o",
        "medibot": "llama-3.3-70b-versatile",
      };

      const resolvedModel = modelMap[selectedModel];
      if (!resolvedModel) throw new Error(`Invalid model: ${selectedModel}`);

      const recentMessages = currentSession?.messages
        .slice(-5)
        .map((msg) => `User: ${msg.message}\nAI: ${msg.response}`)
        .join("\n\n") || "";

      const prompt = `You are MediBot, a health-focused AI assistant. Use the following conversation context to provide a concise, informative, and professional response. Ensure the response is educational, not a substitute for medical advice, and includes a reminder to consult a healthcare professional. Context: ${recentMessages}\n\nQuery: ${userMessage}`;

      let response;
      if (resolvedModel === "llama-3.3-70b-versatile") {
        // Use Groq API for MediBot
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
         headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
},

          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
          throw new Error("No valid response from Groq API");
        }
        return data.choices[0].message.content.trim();
      } else {
        // Load Puter.js if not already loaded
        if (typeof window !== "undefined" && !window.puter) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://js.puter.com/v2/";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Puter.js"));
            document.head.appendChild(script);
          });
        }

        response = await window.puter.ai.chat(prompt, { model: resolvedModel });
        if (!response?.message?.content) {
          throw new Error("No valid response from AI service");
        }
        return response.message.content.trim();
      }
    } catch (error: any) {
      console.error("Error generating AI response:", error);
      if (selectedModel !== "medibot") {
        toast.warning("Primary model failed, falling back to MediBot model...");
        return generateAIResponse(userMessage, "medibot");
      }
      return "I'm sorry, I couldn't process your request. Please try again or consult a healthcare professional.";
    }
  };

  const analyzePrescription = async (file: File): Promise<PrescriptionAnalysis> => {
    try {
      setAnalyzingPrescription(true);
      const fileBase64 = await fileToBase64(file);

      const endpoint = selectedModel === "medibot"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : selectedModel === "grok"
        ? "https://api.x.ai/v1/models/grok:analyzePrescription"
        : `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (selectedModel === "medibot") {
        headers.Authorization = `Bearer ${process.env.NEXT_PUBLIC_XAI_API_KEY}`;
      } else if (selectedModel === "grok") {
        headers.Authorization = `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`;
      }

      const body = selectedModel === "medibot"
        ? {
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "user",
                content:
                  "Analyze this prescription image or PDF and extract medications, dosages, instructions, and warnings. Return JSON with fields: medications (array), dosages (array), instructions (string), warnings (array).",
                inlineData: {
                  mimeType: file.type,
                  data: fileBase64,
                },
              },
            ],
          }
        : {
            contents: [
              {
                parts: [
                  {
                    text:
                      "Analyze this prescription image or PDF and extract medications, dosages, instructions, and warnings. Return JSON with fields: medications (array), dosages (array), instructions (string), warnings (array).",
                  },
                  {
                    inlineData: {
                      mimeType: file.type,
                      data: fileBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 500,
            },
          };

      const response = await fetch(
        `${endpoint}${selectedModel === "medibot" || selectedModel === "grok" ? "" : `?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data: GroqResponse | GeminiResponse = await response.json();
      let responseText: string;

      if (selectedModel === "medibot") {
        responseText = (data as GroqResponse).choices?.[0]?.message?.content || "{}";
      } else {
        responseText = (data as GeminiResponse).candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      }

      // Clean and parse the response
      const cleanedResponseText = responseText.replace(/```json/g, "").replace(/```/g, "").replace(/`/g, "").trim();

      let result: PrescriptionAnalysis;
      try {
        result = JSON.parse(cleanedResponseText) as PrescriptionAnalysis;
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        throw new Error("Invalid JSON response from API");
      }

      // Validate the parsed result
      if (!result.medications || !result.dosages || !result.instructions) {
        throw new Error("Incomplete analysis data returned");
      }

      return {
        medications: Array.isArray(result.medications) ? result.medications : ["Unknown"],
        dosages: Array.isArray(result.dosages) ? result.dosages : ["Unknown"],
        instructions: typeof result.instructions === "string" ? result.instructions : "No instructions provided.",
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
      };
    } catch (error: any) {
      console.error("Error analyzing prescription:", error);
      if (selectedModel !== "medibot") {
        toast.warning("Primary model failed for prescription analysis, falling back to MediBot model...");
        setSelectedModel("medibot");
        return analyzePrescription(file);
      }
      toast.error(`Failed to analyze prescription: ${error.message || "Unknown error"}`);
      return {
        medications: ["Error"],
        dosages: ["N/A"],
        instructions: "Failed to analyze prescription.",
        warnings: ["Please try again or consult a healthcare professional."],
      };
    } finally {
      setAnalyzingPrescription(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        if (!base64String) reject(new Error("Failed to convert file to base64"));
        else resolve(base64String);
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
    if (!["image/jpeg", "image/png", "image/heic", "application/pdf"].includes(file.type)) {
      toast.error("Please upload a JPG, PNG, HEIC, or PDF file.");
      return;
    }
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

  const isValidImageUrl = (url: string | null | undefined): boolean => {
    return !!url && typeof url === "string" && url.startsWith("https://");
  };

  const renderMessages = useMemo(() => {
    if (!user || !currentSession?.messages || currentSession.messages.length === 0) {
      return null;
    }

    let lastDate: string | null = null;
    return currentSession.messages.map((msg) => {
      const messageDate = msg.timestamp.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
      const showDateDivider = messageDate !== lastDate;
      lastDate = messageDate;

      return (
        <div key={msg.id}>
          {showDateDivider && (
            <div className="text-center text-xs text-gray-500 my-4">
              {messageDate === new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
                ? "Today"
                : messageDate}
            </div>
          )}
          <div className="space-y-2 animate-fade-in hover:scale-[1.02] transition-transform duration-200">
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
              <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl p-4 text-gray-800 dark:text-white text-sm leading-relaxed shadow-md">
                {isValidImageUrl(msg.image) ? (
                  <div className="mb-2">
                    <Image
                      src={msg.image || ""}
                      alt="Uploaded file"
                      width={200}
                      height={200}
                      className="rounded-lg object-contain"
                      onError={(e) => console.error(`File failed to load: ${msg.image}`)}
                    />
                  </div>
                ) : msg.image !== null ? (
                  <p className="text-xs text-red-500 mb-2">Invalid or missing file</p>
                ) : null}
                {editingMessageId === msg.id ? (
                  <div className="flex items-center space-x-2">
                    <Input
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="bg-white/10 dark:bg-gray-800 border-none text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-lg"
                      aria-label="Edit message"
                    />
                    <Button
                      onClick={() => handleEditMessage(msg.id, editedMessage)}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-full h-8 w-8"
                      aria-label="Send edited message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p>{msg.message}</p>
                )}
                <div className="flex space-x-2 mt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyText(msg.message)}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white h-6 w-6"
                    title="Copy Message"
                    aria-label="Copy Message"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditMessage(msg.id, msg.message)}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white h-6 w-6"
                    title="Edit Message"
                    aria-label="Edit Message"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 opacity-70">{formatISTDateTime(msg.timestamp)}</p>
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
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 text-gray-800 dark:text-white text-sm leading-relaxed border border-gray-200 dark:border-gray-700 shadow-md whitespace-pre-wrap">
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
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white h-6 w-6"
                      title="Copy Response"
                      aria-label="Copy Response"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSpeakResponse(msg.response)}
                      className={`text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white h-6 w-6 ${isSpeaking ? "animate-pulse bg-blue-500/20" : ""}`}
                      title={isSpeaking ? "Stop Speaking" : "Speak Response"}
                      aria-label={isSpeaking ? "Stop Speaking" : "Speak Response"}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFeedback(msg.id, true)}
                      className="text-gray-500 dark:text-gray-400 hover:text-green-500 h-6 w-6"
                      title="Thumbs Up"
                      aria-label="Thumbs Up"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFeedback(msg.id, false)}
                      className="text-gray-500 dark:text-gray-400 hover:text-red-500 h-6 w-6"
                      title="Thumbs Down"
                      aria-label="Thumbs Down"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRetryResponse(msg.id, msg.message)}
                      className="text-gray-500 dark:text-gray-400 hover:text-blue-500 h-6 w-6"
                      title="Retry Response"
                      aria-label="Retry Response"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(msg.message)}`, "_blank")}
                      className="text-gray-500 dark:text-gray-400 hover:text-blue-500 h-6 w-6"
                      title="Search PubMed"
                      aria-label="Search PubMed"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 opacity-70">{formatISTDateTime(msg.timestamp)}</p>
                </div>
              </div>
            ) : (
              loading && (
                <div className="flex items-start space-x-2 max-w-[80%]">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-md">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      );
    });
  }, [user, currentSession, editingMessageId, editedMessage, isSpeaking, loading]);

  const handleMessageChange = debounce((value: string) => {
    setMessage(value);
  }, 300);

  return (
    <AuthGuard>
      <div className="min-h-screen flex h-screen overflow-hidden bg-white dark:bg-gray-900">
        <style jsx global>{`
          .message-bubble:hover {
            transform: scale(1.02);
            transition: transform 0.2s ease-in-out;
          }
          @media (prefers-contrast: high) {
            .bg-purple-600 {
              background-color: #800080;
              color: #fff;
            }
            .text-gray-500 {
              color: #000;
            }
          }
        `}</style>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-20 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">MediBot - Your Health Assistant</h1>
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
                  <Button
                    onClick={handleHistoryDialog}
                    variant="ghost"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 w-10"
                    aria-label="View chat history"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={exportChat}
                    variant="ghost"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 w-10"
                    aria-label="Export Chat"
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button
                      variant="outline"
                      className="bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white hover:bg-purple-600 hover:text-white h-10 px-4"
                    >
                      Login
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button
                      variant="outline"
                      className="bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white hover:bg-purple-600 hover:text-white h-10 px-4"
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
                        <Image src="/logo.png" alt="MediBot Logo" width={80} height={80} className="rounded-full" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Welcome to MediBot</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Please log in or sign up to start chatting.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Link href="/auth/signin">
                        <Button
                          variant="outline"
                          className="w-full h-12 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white hover:bg-purple-600 hover:text-white rounded-xl"
                        >
                          Login
                        </Button>
                      </Link>
                      <Link href="/auth/signup">
                        <Button
                          variant="outline"
                          className="w-full h-12 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white hover:bg-purple-600 hover:text-white rounded-xl"
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
                        <Image src="/logo.png" alt="MediBot Logo" width={80} height={80} className="rounded-full" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Welcome to MediBot</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Start a conversation below.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                renderMessages
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input Area */}
         {user && (
  <div className="sticky bottom-0 z-10 w-full bg-white dark:bg-gray-900 px-4 pb-6 pt-4">
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-3 shadow-lg">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)} // Direct state update
          onKeyDown={handleKeyPress}
          placeholder="Ask a health question or upload a file..."
          className="w-full resize-none bg-transparent text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-800 dark:text-white outline-none"
          rows={2}
          maxLength={1000}
          disabled={loading || isRecording}
          aria-label="Message input"
        />
        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-7 bg-gray-200 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-300 border-none rounded-md focus:ring-1 focus:ring-purple-500">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white text-sm border-none">
                <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                <SelectItem value="grok">Grok (Beta)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="medibot">MediBot</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleFileUpload}
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
              title="Upload File"
              aria-label="Upload File"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleToggleRecording}
              size="icon"
              variant="ghost"
              className={`h-8 w-8 ${isRecording ? "bg-red-600 animate-pulse" : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"}`}
              title={isRecording ? "Stop Recording" : "Record Voice"}
              aria-label={isRecording ? "Stop Recording" : "Record Voice"}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={loading || (!message.trim() && !selectedFile)}
            className="h-8 w-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full disabled:opacity-40"
            aria-label="Send Message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {fileName && (
          <div className="flex items-center gap-2 pt-1">
            <Badge className="bg-gray-200 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-300 truncate max-w-[300px]">
              {fileName}
            </Badge>
            <Button
              onClick={removeFile}
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-400 hover:text-red-600"
              title="Remove File"
              aria-label="Remove File"
            >
              <X className="h-4 w-4" />
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
            <DialogContent
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white max-w-2xl mx-auto max-h-[80vh] overflow-y-auto rounded-2xl p-6 shadow-lg"
              aria-describedby="prescription-dialog-description"
            >
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-lg">
                  <Camera className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>Prescription Analysis</span>
                </DialogTitle>
                <DialogDescription id="prescription-dialog-description">
                  Upload a photo or PDF of your prescription to analyze its contents.
                </DialogDescription>
              </DialogHeader>
              {!analysisResult ? (
                <div className="space-y-4">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Upload a file for AI-powered analysis and information.
                  </p>
                  <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
                    {analyzingPrescription ? (
                      <div className="space-y-4">
                        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Analyzing file...</p>
                      </div>
                    ) : (
                      <>
                        <Camera className="h-12 w-12 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Upload prescription file</p>
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
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAnalyzingPrescription(true);
                        analyzePrescription(file)
                          .then((analysis) => {
                            setAnalysisResult({
                              ...analysis,
                              userId: user.uid,
                              fileName: file.name,
                              createdAt: new Date(),
                            });
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Supported formats: JPG, PNG, HEIC, PDF. For informational purposes only.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        <span>Analysis Results</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gray-800 dark:text-white">Detected Medications</h4>
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
                          <h4 className="font-semibold text-sm mb-2 text-gray-800 dark:text-white">Dosage Information</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.dosages.map((dosage, index) => (
                              <Badge key={index} variant="secondary" className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-sm rounded-lg">
                                {dosage}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gray-800 dark:text-white">Instructions</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-sm bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                          {analysisResult.instructions}
                        </p>
                      </div>
                      {analysisResult.warnings?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gray-800 dark:text-white flex items-center">
                            <AlertCircle className="mr-2 h-5 w-5 text-yellow-500" />
                            <span>Warnings & Precautions</span>
                          </h4>
                          <div className="space-y-2">
                            {analysisResult.warnings.map((warning, index) => (
                              <div key={index} className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3 rounded-lg">
                                <p className="text-yellow-700 dark:text-yellow-300 text-sm">{warning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-3 rounded-lg">
                        <p className="text-blue-700 dark:text-blue-300 text-sm">
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
                      className="flex-1 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white hover:bg-purple-600 hover:text-white text-sm rounded-lg"
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
            <DialogContent
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white max-w-md mx-auto p-6 rounded-2xl shadow-lg"
              aria-describedby="history-dialog-description"
            >
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-lg">
                  <RotateCcw className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>Recent Chats</span>
                </DialogTitle>
                <DialogDescription id="history-dialog-description">
                  View your recent chat sessions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto max-h-96">
                {sessions.length > 0 ? (
                  sessions.slice(0, 10).map((session) => (
                    <div
                      key={session.id}
                      className={`p-4 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                        currentSession?.id === session.id
                          ? "bg-purple-600/20 border-purple-600"
                          : "bg-gray-100 dark:bg-gray-700 hover:bg-purple-600/10"
                      }`}
                      onClick={() => {
                        setCurrentSession(normalizeSession(session));
                        setHistoryDialogOpen(false);
                        setTimeout(() => {
                          if (scrollAreaRef.current) {
                            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
                          }
                        }, 0);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm text-gray-800 dark:text-white truncate">{session.title}</h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {session.messages.length} messages • {formatISTDateTime(session.updatedAt)}
                          </p>
                          {session.messages.length > 0 && (
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 truncate">
                              {session.messages[session.messages.length - 1]?.message || "No messages"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <RotateCcw className="h-12 w-12 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No chat history yet</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Start a conversation to see your history here</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link href="/history">
                  <Button
                    variant="outline"
                    className="bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white hover:bg-purple-600 hover:text-white text-sm rounded-lg"
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

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
}

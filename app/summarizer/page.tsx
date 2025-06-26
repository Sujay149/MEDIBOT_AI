
"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Menu, FileText, Sparkles, Copy, Download, History, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { addSummaryRequest, getUserSummaries, type SummaryRequest } from "@/lib/firestore";
import { toast } from "sonner";

export default function SummarizerPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<"symptoms" | "medication" | "diagnosis" | "treatment" | "general">("general");
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<SummaryRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSummaries();
    }
  }, [user]);

  const loadSummaries = async () => {
    if (!user) return;

    try {
      setLoadingHistory(true);
      const userSummaries = await getUserSummaries(user.uid);
      setSummaries(userSummaries);
    } catch (error) {
      console.error("Error loading summaries:", error);
      toast.error("Failed to load summary history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const generateSummary = async () => {
    if (!inputText.trim() || !user) {
      toast.error("Please enter some text to summarize");
      return;
    }

    setLoading(true);
    setSummary("");
    const originalInput = inputText;

    try {
      const generatedSummary = await generateMedicalSummary(inputText, category);
      setSummary(generatedSummary);

      // Save to Firestore
      await addSummaryRequest(user.uid, inputText, generatedSummary, category);

      toast.success("Summary generated successfully!");

      // Reload summaries
      await loadSummaries();
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
      setInputText(originalInput); // Restore input on error
    } finally {
      setLoading(false);
    }
  };

  const generateMedicalSummary = async (text: string, category: string): Promise<string> => {
    try {
      const model = "gemini-1.5-flash-latest";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const prompt = `You are a health-focused AI assistant. Summarize the following medical text in a concise, structured format (use markdown with bold headers and bullet points) based on the specified category (${category}). Focus on key insights, recommendations, and provide educational content. Include a note reminding users to consult a healthcare professional. The summary should be professional, clear, and no longer than 200 words. Text: "${text}"`;

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
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 300,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No summary generated.";

      // Clean response by removing markdown code fences and backticks
      summaryText = summaryText
        .replace(/```markdown/g, "")
        .replace(/```/g, "")
        .replace(/`/g, "")
        .trim();

      return summaryText;
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return `**ERROR SUMMARY**

- Failed to generate summary due to an issue with the AI service.
- Please try again later or consult a healthcare professional for assistance.

**Note:** This is an automated message. For accurate medical advice, always consult qualified healthcare professionals.`;
    }
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
    toast.success("Summary copied to clipboard!");
  };

  const downloadSummary = () => {
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medical-summary-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Summary downloaded!");
  };

  const clearAll = () => {
    setInputText("");
    setSummary("");
    setCategory("general");
  };

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-card">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground lg:hidden h-10 w-10"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <h1 className="font-semibold text-lg">Summarize Medications</h1>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Medical Information Summarizer</h1>
                <p className="text-muted-foreground text-sm">
                  Paste your medical information, reports, or health-related text to get an AI-powered summary with key
                  insights and recommendations.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <Card className="bg-card border-border rounded-xl shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-lg">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span>Input Medical Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-muted-foreground text-sm font-medium mb-2">Category</label>
                      <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                        <SelectTrigger className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground shadow-lg">
                          <SelectItem value="general">🏥 General Medical</SelectItem>
                          <SelectItem value="symptoms">🤒 Symptoms & Signs</SelectItem>
                          <SelectItem value="medication">💊 Medications</SelectItem>
                          <SelectItem value="diagnosis">🔬 Diagnosis & Tests</SelectItem>
                          <SelectItem value="treatment">⚕️ Treatment Plans</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-muted-foreground text-sm font-medium mb-2">
                        Medical Text ({inputText.length}/5000 characters)
                      </label>
                      <Textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Paste your medical information here... (e.g., doctor's notes, lab results, symptom descriptions, medication lists, treatment plans)"
                        className="bg-muted border-border text-foreground placeholder-muted-foreground min-h-[300px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-600"
                        maxLength={5000}
                      />
                    </div>

                    <div className="flex space-x-3">
                      <Button
                        onClick={generateSummary}
                        disabled={loading || !inputText.trim()}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Summary
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={clearAll}
                        variant="outline"
                        className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white rounded-xl"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Output Section */}
                <Card className="bg-card border-border rounded-xl shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                        <span>AI Summary</span>
                      </div>
                      {summary && (
                        <div className="flex space-x-2">
                          <Button
                            onClick={copySummary}
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground h-8 w-8"
                            aria-label="Copy Summary"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={downloadSummary}
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground h-8 w-8"
                            aria-label="Download Summary"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary ? (
                      <div className="bg-muted rounded-lg p-4 text-foreground whitespace-pre-wrap leading-relaxed min-h-[300px] max-h-[400px] overflow-y-auto">
                        {summary}
                      </div>
                    ) : (
                      <div className="bg-muted rounded-lg p-8 text-center min-h-[300px] flex items-center justify-center">
                        <div>
                          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-2">Ready to summarize</p>
                          <p className="text-muted-foreground text-sm">
                            Enter your medical information and click "Generate Summary" to get started
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Summary History */}
              <Card className="bg-card border-border rounded-xl shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <span>Recent Summaries</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingHistory ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-muted-foreground">Loading summary history...</p>
                    </div>
                  ) : summaries.length > 0 ? (
                    <div className="space-y-4">
                      {summaries.slice(0, 5).map((summary, index) => (
                        <Dialog key={summary.id || index} open={dialogOpen && selectedSummaryId === (summary.id || index.toString())} onOpenChange={(open) => {
                          if (open) {
                            setSelectedSummaryId(summary.id || index.toString());
                            setDialogOpen(true);
                          } else {
                            setSelectedSummaryId(null);
                            setDialogOpen(false);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <div
                              className="bg-muted rounded-lg p-4 border border-border cursor-pointer hover:bg-purple-600/10 transition-colors"
                              onClick={() => {
                                setSelectedSummaryId(summary.id || index.toString());
                                setDialogOpen(true);
                              }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <Badge className="bg-purple-600 text-white">
                                  {summary.category.charAt(0).toUpperCase() + summary.category.slice(1)}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                  {(
                                    summary.createdAt
                                      ? (typeof summary.createdAt === "object" && "toDate" in summary.createdAt
                                          ? (summary.createdAt as any).toDate().toLocaleDateString()
                                          : (summary.createdAt as Date).toLocaleDateString())
                                      : "Recently"
                                  )}
                                </span>
                              </div>
                              <p className="text-foreground text-sm line-clamp-2 mb-2">
                                {summary.originalText.slice(0, 150)}...
                              </p>
                              <p className="text-muted-foreground text-xs">Summary: {summary.summary.slice(0, 100)}...</p>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="bg-card border-border text-foreground max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl p-4 sm:p-6 shadow">
                            <DialogHeader>
                              <DialogTitle className="flex items-center justify-between text-lg">
                                <div className="flex items-center space-x-2">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <span>Summary Details</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedSummaryId(null);
                                    setDialogOpen(false);
                                  }}
                                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                                  aria-label="Close"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 sm:space-y-6">
                              <div className="flex items-center justify-between">
                                <Badge className="bg-purple-600 text-white">
                                  {summary.category.charAt(0).toUpperCase() + summary.category.slice(1)}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                  {(
                                    summary.createdAt
                                      ? (typeof summary.createdAt === "object" && "toDate" in summary.createdAt
                                          ? (summary.createdAt as any).toDate().toLocaleDateString()
                                          : (summary.createdAt as Date).toLocaleDateString())
                                      : "Recently"
                                  )}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Original Text</h4>
                                <div className="bg-muted rounded-lg p-4 text-foreground text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                                  {summary.originalText}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm mb-2">AI-Generated Summary</h4>
                                <div className="bg-muted rounded-lg p-4 text-foreground text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                                  {summary.summary}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">No summaries yet</p>
                      <p className="text-muted-foreground text-sm">Generate your first medical summary to see it here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

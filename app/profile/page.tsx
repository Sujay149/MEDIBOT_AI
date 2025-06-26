"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, User, Palette, Bell, Shield, Database, Camera } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { updateUserProfile, uploadProfilePicture, type UserProfile as FirestoreUserProfile } from "@/lib/firestore";
import { toast } from "sonner";

// Extend the UserProfile type locally to include all preference fields used in this file
type ExtendedPreferences = {
  theme: "dark" | "light";
  notifications: boolean;
  emailNotifications: boolean;
  medicationReminders: boolean;
  appointmentReminders: boolean;
  healthTips: boolean;
  pushNotifications: boolean;
  shareDataForResearch: boolean;
  analytics: boolean;
  saveConversations: boolean;
};

type ExtendedUserProfile = Omit<FirestoreUserProfile, "preferences"> & {
  preferences: ExtendedPreferences;
};

// Validation regex patterns
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const NAME_REGEX = /^[a-zA-Z\s-]{2,50}$/;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export default function ProfilePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user, userProfile } = useAuth() as { user: any, userProfile: ExtendedUserProfile | null };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    phoneNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    allergies: "",
    conditions: "",
    bloodType: "",
    preferences: {
      theme: "dark" as "dark" | "light",
      notifications: true,
      emailNotifications: true,
      medicationReminders: true,
      appointmentReminders: true,
      healthTips: false,
      pushNotifications: true,
      shareDataForResearch: false,
      analytics: true,
      saveConversations: true,
    },
  });

  // Initialize form with user profile data
  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || "",
        email: userProfile.email || "",
        dateOfBirth: userProfile.dateOfBirth || "",
        gender: userProfile.gender || "",
        phoneNumber: userProfile.phoneNumber || "",
        emergencyContactName: userProfile.emergencyContact?.name || "",
        emergencyContactPhone: userProfile.emergencyContact?.phone || "",
        emergencyContactRelationship: userProfile.emergencyContact?.relationship || "",
        allergies: userProfile.medicalInfo?.allergies?.join(", ") || "",
        conditions: userProfile.medicalInfo?.conditions?.join(", ") || "",
        bloodType: userProfile.medicalInfo?.bloodType || "",
        preferences: {
          theme: userProfile.preferences?.theme || "dark",
          notifications: userProfile.preferences?.notifications ?? true,
          emailNotifications: userProfile.preferences?.emailNotifications ?? true,
          medicationReminders: userProfile.preferences?.medicationReminders ?? true,
          appointmentReminders: userProfile.preferences?.appointmentReminders ?? true,
          healthTips: userProfile.preferences?.healthTips ?? false,
          pushNotifications: userProfile.preferences?.pushNotifications ?? true,
          shareDataForResearch: userProfile.preferences?.shareDataForResearch ?? false,
          analytics: userProfile.preferences?.analytics ?? true,
          saveConversations: userProfile.preferences?.saveConversations ?? true,
        },
      });
    }
  }, [userProfile]);

  // Warn about unsaved changes when leaving the page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.match(NAME_REGEX)) {
      newErrors.displayName = "Display name must be 2-50 characters, letters only";
    }

    if (formData.phoneNumber && !formData.phoneNumber.match(PHONE_REGEX)) {
      newErrors.phoneNumber = "Invalid phone number format (e.g., +1234567890)";
    }

    if (formData.emergencyContactPhone && !formData.emergencyContactPhone.match(PHONE_REGEX)) {
      newErrors.emergencyContactPhone = "Invalid emergency contact phone format";
    }

    if (formData.emergencyContactName && !formData.emergencyContactName.match(NAME_REGEX)) {
      newErrors.emergencyContactName = "Contact name must be 2-50 characters, letters only";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasUnsavedChanges(true);
  };

  // Handle preference changes
  const handlePreferenceChange = (key: string, value: boolean | string) => {
    setFormData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Update profile in Firestore
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) {
      toast.error("Please fix form errors before submitting");
      return;
    }

    setLoading(true);
    try {
      const updateData: Partial<ExtendedUserProfile> = {
        displayName: formData.displayName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        phoneNumber: formData.phoneNumber,
        emergencyContact: {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyContactRelationship,
        },
        medicalInfo: {
          allergies: formData.allergies
            .split(",")
            .map((a) => a.trim())
            .filter((a) => a),
          conditions: formData.conditions
            .split(",")
            .map((c) => c.trim())
            .filter((c) => c),
          bloodType: formData.bloodType,
        },
        preferences: formData.preferences,
      };

      await updateUserProfile(user.uid, updateData);
      setHasUnsavedChanges(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // Handle profile picture upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 2MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      await uploadProfilePicture(user.uid, file);
      toast.success("Profile picture updated successfully!");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload profile picture");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Export user data
  const handleExportData = () => {
    const exportData = {
      profile: userProfile,
      exportDate: new Date().toISOString(),
      note: "This is your Medibot data export",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Medibot-data-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Data exported successfully!");
  };

  // Clear user data (placeholder)
  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear all your data? This action cannot be undone.")) {
      toast.success("Data clearing initiated. This feature will be implemented soon.");
    }
  };

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen">
        <div className="flex h-screen overflow-hidden">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="text-muted-foreground lg:hidden h-10 w-10"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="font-semibold text-lg">Profile Settings</h1>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Profile Settings */}
                <Card className="bg-card border-border rounded-xl shadow">
                  <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                    <User className="h-5 w-5 text-muted-foreground mr-2" />
<CardTitle className="text-foreground">Profile Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                      {/* Profile Picture */}
                      <div className="flex items-center space-x-6">
                        <Avatar className="w-20 h-20">
                          <AvatarImage src={userProfile?.photoURL || user?.photoURL || ""} />
                          <AvatarFallback className="bg-purple-600 text-white text-2xl font-semibold">
                            {formData.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingPhoto}
                            aria-label="Change profile picture"
                          >
                            {uploadingPhoto ? (
                              <>
                                <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin mr-2" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Camera className="mr-2 h-4 w-4" />
                                Change Photo
                              </>
                            )}
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            aria-hidden="true"
                          />
                          <p className="text-muted-foreground text-sm mt-2">JPG, PNG, or GIF. Max size 2MB.</p>
                        </div>
                      </div>

                      {/* Basic Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="displayName" className="block text-sm font-medium text-muted-foreground mb-1">
                            Display Name
                          </label>
                          <Input
                            id="displayName"
                            value={formData.displayName}
                            onChange={(e) => handleInputChange("displayName", e.target.value)}
                            className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                            placeholder="Enter your display name"
                            aria-describedby="displayName-error"
                            required
                          />
                          {errors.displayName && (
                            <p id="displayName-error" className="text-red-500 text-xs mt-1">
                              {errors.displayName}
                            </p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
                            Email Address
                          </label>
                          <Input
                            id="email"
                            value={formData.email}
                            disabled
                            className="bg-muted border-border text-muted-foreground"
                            aria-describedby="email-note"
                          />
                          <p id="email-note" className="text-muted-foreground text-xs mt-1">
                            Email cannot be changed
                          </p>
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-muted-foreground mb-1">
                            Date of Birth
                          </label>
                          <Input
                            id="dateOfBirth"
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                            className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                            max={new Date().toISOString().split("T")[0]}
                          />
                        </div>
                        <div>
                          <label htmlFor="gender" className="block text-sm font-medium text-muted-foreground mb-1">
                            Gender
                          </label>
                          <Select
                            value={formData.gender}
                            onValueChange={(value) => handleInputChange("gender", value)}
                          >
                            <SelectTrigger
                              id="gender"
                              className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                              aria-label="Select gender"
                            >
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground shadow-lg">
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="phoneNumber" className="block text-sm font-medium text-muted-foreground mb-1">
                            Phone Number
                          </label>
                          <Input
                            id="phoneNumber"
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                            className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                            placeholder="+1234567890"
                            aria-describedby="phoneNumber-error"
                          />
                          {errors.phoneNumber && (
                            <p id="phoneNumber-error" className="text-red-500 text-xs mt-1">
                              {errors.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Emergency Contact */}
                      <div className="space-y-4">
<h3 className="text-lg font-bold text-foreground">Emergency Contact</h3>                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label htmlFor="emergencyContactName" className="block text-sm font-medium text-muted-foreground mb-1">
                              Contact Name
                            </label>
                            <Input
                              id="emergencyContactName"
                              value={formData.emergencyContactName}
                              onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                              className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                              placeholder="Emergency contact name"
                              aria-describedby="emergencyContactName-error"
                            />
                            {errors.emergencyContactName && (
                              <p id="emergencyContactName-error" className="text-red-500 text-xs mt-1">
                                {errors.emergencyContactName}
                              </p>
                            )}
                          </div>
                          <div>
                            <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-muted-foreground mb-1">
                              Contact Phone
                            </label>
                            <Input
                              id="emergencyContactPhone"
                              type="tel"
                              value={formData.emergencyContactPhone}
                              onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                              className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                              placeholder="+1234567890"
                              aria-describedby="emergencyContactPhone-error"
                            />
                            {errors.emergencyContactPhone && (
                              <p id="emergencyContactPhone-error" className="text-red-500 text-xs mt-1">
                                {errors.emergencyContactPhone}
                              </p>
                            )}
                          </div>
                          <div>
                            <label
                              htmlFor="emergencyContactRelationship"
                              className="block text-sm font-medium text-muted-foreground mb-1"
                            >
                              Relationship
                            </label>
                            <Input
                              id="emergencyContactRelationship"
                              value={formData.emergencyContactRelationship}
                              onChange={(e) => handleInputChange("emergencyContactRelationship", e.target.value)}
                              className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                              placeholder="e.g., Parent, Spouse"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Medical Information */}
                      <div className="space-y-4">
<h3 className="text-lg font-bold text-foreground">Medical Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="allergies" className="block text-sm font-medium text-muted-foreground mb-1">
                              Allergies
                            </label>
                            <Input
                              id="allergies"
                              value={formData.allergies}
                              onChange={(e) => handleInputChange("allergies", e.target.value)}
                              className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                              placeholder="e.g., Penicillin, Peanuts (comma separated)"
                            />
                          </div>
                          <div>
                            <label htmlFor="conditions" className="block text-sm font-medium text-muted-foreground mb-1">
                              Medical Conditions
                            </label>
                            <Input
                              id="conditions"
                              value={formData.conditions}
                              onChange={(e) => handleInputChange("conditions", e.target.value)}
                              className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                              placeholder="e.g., Diabetes, Hypertension (comma separated)"
                            />
                          </div>
                        </div>
                        <div className="w-full md:w-1/3">
                          <label htmlFor="bloodType" className="block text-sm font-medium text-muted-foreground mb-1">
                            Blood Type
                          </label>
                          <Select
                            value={formData.bloodType}
                            onValueChange={(value) => handleInputChange("bloodType", value)}
                          >
                            <SelectTrigger
                              id="bloodType"
                              className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                              aria-label="Select blood type"
                            >
                              <SelectValue placeholder="Select blood type" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground shadow-lg">
                              <SelectItem value="A+">A+</SelectItem>
                              <SelectItem value="A-">A-</SelectItem>
                              <SelectItem value="B+">B+</SelectItem>
                              <SelectItem value="B-">B-</SelectItem>
                              <SelectItem value="AB+">AB+</SelectItem>
                              <SelectItem value="AB-">AB-</SelectItem>
                              <SelectItem value="O+">O+</SelectItem>
                              <SelectItem value="O-">O-</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || Object.keys(errors).length > 0}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full"
                        aria-label="Update profile"
                      >
                        {loading ? "Updating..." : "Update Profile"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

               

                {/* Notifications */}
                <Card className="bg-card border-border rounded-xl shadow">
                  <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                    <Bell className="h-5 w-5 text-muted-foreground mr-2" />
                    <CardTitle className="text-foreground">Notifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                       <p className="text-muted-foreground text-sm">
Medication Reminders</p>
                        <p className="text-muted-foreground text-sm">Get notified to take your medications</p>
                      </div>
                      <Switch
                        checked={formData.preferences.medicationReminders}
                        onCheckedChange={(checked) => handlePreferenceChange("medicationReminders", checked)}
                        aria-label="Toggle medication reminders"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                       <p className="text-muted-foreground text-sm">
Appointment Reminders</p>
                        <p className="text-muted-foreground text-sm">Reminders for upcoming medical appointments</p>
                      </div>
                      <Switch
                        checked={formData.preferences.appointmentReminders}
                        onCheckedChange={(checked) => handlePreferenceChange("appointmentReminders", checked)}
                        aria-label="Toggle appointment reminders"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                       <p className="text-muted-foreground text-sm">
Health Tips</p>
                        <p className="text-muted-foreground text-sm">General health tips and wellness advice</p>
                      </div>
                      <Switch
                        checked={formData.preferences.healthTips}
                        onCheckedChange={(checked) => handlePreferenceChange("healthTips", checked)}
                        aria-label="Toggle health tips"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                       <p className="text-muted-foreground text-sm">
Email Notifications</p>
                        <p className="text-muted-foreground text-sm">Receive notifications via email</p>
                      </div>
                      <Switch
                        checked={formData.preferences.emailNotifications}
                        onCheckedChange={(checked) => handlePreferenceChange("emailNotifications", checked)}
                        aria-label="Toggle email notifications"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                       <p className="text-muted-foreground text-sm">
Push Notifications</p>
                        <p className="text-muted-foreground text-sm">Receive push notifications on your device</p>
                      </div>
                      <Switch
                        checked={formData.preferences.pushNotifications}
                        onCheckedChange={(checked) => handlePreferenceChange("pushNotifications", checked)}
                        aria-label="Toggle push notifications"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Privacy & Security */}
                <Card className="bg-card border-border rounded-xl shadow">
                  <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                    <Shield className="h-5 w-5 text-muted-foreground mr-2" />
<CardTitle className="text-foreground">Privacy & Security</CardTitle>                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                       <p className="text-muted-foreground text-sm">
Share Data for Research</p>
                        <p className="text-muted-foreground text-sm">Help improve healthcare by sharing anonymized data</p>
                      </div>
                      <Switch
                        checked={formData.preferences.shareDataForResearch}
                        onCheckedChange={(checked) => handlePreferenceChange("shareDataForResearch", checked)}
                        aria-label="Toggle data sharing for research"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                       <p className="text-muted-foreground text-sm">
Save Conversations</p>
                        <p className="text-muted-foreground text-sm">Keep chat history for future reference</p>
                      </div>
                      <Switch
                        checked={formData.preferences.saveConversations}
                        onCheckedChange={(checked) => handlePreferenceChange("saveConversations", checked)}
                        aria-label="Toggle save conversations"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Data Management */}
                <Card className="bg-card border-border rounded-xl shadow">
                  <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                    <Database className="h-5 w-5 text-muted-foreground mr-2" />
<CardTitle className="text-foreground">Data Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                      <Button
                        onClick={handleExportData}
                        variant="outline"
                        className="bg-muted border-border text-foreground hover:bg-purple-600 hover:text-white"
                        aria-label="Export my data"
                      >
                        📤 Export My Data
                      </Button>
                      <Button
                        onClick={handleClearData}
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        aria-label="Clear all data"
                      >
                        🗑️ Clear All Data
                      </Button>
                    </div>
                    <p className="text-muted-foreground ">
                      Export your data to keep a backup, or clear all your data to start fresh.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
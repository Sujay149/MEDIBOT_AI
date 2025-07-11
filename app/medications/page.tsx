"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Menu, Plus, Pill, Clock, Trash2, Edit, Bell, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  addMedication,
  updateMedication,
  deleteMedication,
  subscribeToUserMedications,
  sendMedicationReminder,
  type Medication,
} from "@/lib/firestore";
import { toast } from "sonner";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MedicationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    frequency: "",
    startDate: "",
    endDate: "",
    notes: "",
    reminderTimes: [""],
    enableWhatsApp: false,
    phoneNumber: "",
  });
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();
  const reminderTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const sendMobileNotification = async (userId: string, title: string, body: string) => {
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      const fcmToken = userDoc.data()?.fcmToken;

      if (!fcmToken) {
        console.log(`No FCM token found for user ${userId}. Falling back to console log.`);
        console.log(`Notification: ${title} - ${body}`);
        toast.info("Push notifications are disabled. Enable them in your browser settings.");
        return;
      }

      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=YOUR_FCM_SERVER_KEY`, // 🔁 Replace with your FCM server key
        },
        body: JSON.stringify({
          to: fcmToken,
          notification: {
            title,
            body,
            icon: "/logo.png",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send mobile notification: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error sending mobile notification: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`Fallback log: ${title} - ${body}`);
      toast.error("Failed to send mobile notification");
    }
  };

  const sendEmailNotification = async (email: string, subject: string, body: string) => {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, subject, message: body }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email notification:", error);
      toast.error("Failed to send email notification");
    }
  };

  const scheduleReminders = (medication: Medication, email: string) => {
    if (!medication.id || !medication.reminderTimes.length) return;

    cancelReminders(medication.id);

    medication.reminderTimes.forEach((time, index) => {
      const [hours, minutes] = time.split(":").map(Number);
      const now = new Date();
      const reminder = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

      if (reminder <= now) {
        reminder.setDate(reminder.getDate() + 1);
      }

      const delay = reminder.getTime() - now.getTime();

      const timeoutId = setTimeout(() => {
        const message = `It's time to take your ${medication.name} (${medication.dosage}) at ${time}.`;
        const notifications = [
          sendMobileNotification(user!.uid, `Medication Reminder: ${medication.name}`, message),
          sendEmailNotification(email, `Medication Reminder: ${medication.name}`, message),
          sendMedicationReminder(user!.uid, medication.name, medication.enableWhatsApp ? medication.phoneNumber : undefined, medication.enableWhatsApp),
        ];
        Promise.all(notifications);

        scheduleReminders(medication, email);
      }, delay);

      reminderTimeouts.current.set(`${medication.id}-${index}`, timeoutId);
    });
  };

  const cancelReminders = (medicationId: string) => {
    reminderTimeouts.current.forEach((timeoutId, key) => {
      if (key.startsWith(medicationId)) {
        clearTimeout(timeoutId);
        reminderTimeouts.current.delete(key);
      }
    });
  };

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserMedications(user.uid, (meds) => {
      setMedications(meds);
      setLoading(false);

      meds.forEach((med) => {
        if (med.reminderTimes.length && user.email) {
          scheduleReminders(med, user.email);
        }
      });
    });

    return () => {
      unsubscribe();
      reminderTimeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
      reminderTimeouts.current.clear();
    };
  }, [user]);

  // Enhanced search functionality
  const filteredMedications = medications.filter((med) =>
    [
      med.name,
      med.dosage,
      med.frequency,
      med.notes || "",
      med.phoneNumber || "",
      med.startDate,
      med.endDate || "",
      ...med.reminderTimes,
    ].some((field) => field.toLowerCase().includes(search.toLowerCase().trim()))
  );

  const resetForm = () => {
    setFormData({
      name: "",
      dosage: "",
      frequency: "",
      startDate: "",
      endDate: "",
      notes: "",
      reminderTimes: [""],
      enableWhatsApp: false,
      phoneNumber: "",
    });
    setEditingMedication(null);
  };

  const handleAddMedication = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEditMedication = (medication: Medication) => {
    setFormData({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      startDate: medication.startDate,
      endDate: medication.endDate || "",
      notes: medication.notes || "",
      reminderTimes: medication.reminderTimes.length ? medication.reminderTimes : [""],
      enableWhatsApp: medication.enableWhatsApp || false,
      phoneNumber: medication.phoneNumber || "",
    });
    setEditingMedication(medication);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    try {
      const medicationData: Omit<Medication, "id" | "userId" | "createdAt" | "updatedAt"> = {
        name: formData.name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        notes: formData.notes || "",
        reminderTimes: formData.reminderTimes.filter((time) => time.trim() !== ""),
        isActive: true,
        enableWhatsApp: formData.enableWhatsApp,
        phoneNumber: formData.enableWhatsApp ? formData.phoneNumber : undefined,
      };

      let medicationId: string;

      if (editingMedication && editingMedication.id) {
        await updateMedication(editingMedication.id, medicationData);
        medicationId = editingMedication.id;
        toast.success("Medication updated successfully!");
      } else {
        medicationId = await addMedication(user.uid, medicationData);
        toast.success("Medication added successfully!");
      }

      const message = `Your medication ${medicationData.name} (${medicationData.dosage}) has been ${editingMedication ? "updated" : "added"} successfully.`;
      const notifications = [
        sendMobileNotification(user.uid, "Medication Saved", message),
        user.email ? sendEmailNotification(user.email, "Medication Saved", message) : Promise.resolve(),
        sendMedicationReminder(user!.uid, medicationData.name, medicationData.enableWhatsApp ? medicationData.phoneNumber : undefined, medicationData.enableWhatsApp),
      ];
      await Promise.all(notifications);

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const notifications = [
        sendMobileNotification(user.uid, "Medication Save Error", `Failed to save medication: ${errorMessage}`),
        user.email ? sendEmailNotification(user.email, "Medication Save Error", `Failed to save medication: ${errorMessage}`) : Promise.resolve(),
      ];
      if (formData.enableWhatsApp && formData.phoneNumber) {
        sendMedicationReminder(user.uid, formData.name, formData.phoneNumber, true);
      }
      await Promise.all(notifications);
      toast.error(`Failed to save medication: ${errorMessage}`);
    }
  };

  const handleDeleteMedication = async (medicationId: string) => {
    try {
      await deleteMedication(medicationId);
      cancelReminders(medicationId);
      toast.success("Medication deleted successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (user) {
        const medication = medications.find((m) => m.id === medicationId);
        const notifications = [
          sendMobileNotification(user.uid, "Medication Delete Error", `Failed to delete medication: ${errorMessage}`),
          user.email ? sendEmailNotification(user.email, "Medication Delete Error", `Failed to delete medication: ${errorMessage}`) : Promise.resolve(),
        ];
        if (medication?.enableWhatsApp && medication.phoneNumber) {
          notifications.push(Promise.resolve(sendMedicationReminder(user.uid, medication.name, medication.phoneNumber, true)));
        }
        await Promise.all(notifications);
      }
      toast.error(`Failed to delete medication: ${errorMessage}`);
    }
  };

  const addReminderTime = () => {
    setFormData({
      ...formData,
      reminderTimes: [...formData.reminderTimes, ""],
    });
  };

  const updateReminderTime = (index: number, time: string) => {
    const newTimes = [...formData.reminderTimes];
    newTimes[index] = time;
    setFormData({
      ...formData,
      reminderTimes: newTimes,
    });
  };

  const removeReminderTime = (index: number) => {
    const newTimes = formData.reminderTimes.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      reminderTimes: newTimes.length > 0 ? newTimes : [""],
    });
  };

  const testReminder = async (medication: Medication) => {
    try {
      if (!user) {
        toast.error("User not authenticated");
        return;
      }
      const message = `🧪 This is a test reminder for your medication ${medication.name} (${medication.dosage}). 💊`;
      const notifications = [
        sendMobileNotification(user.uid, "Test Reminder", message),
        user.email ? sendEmailNotification(user.email, "Test Reminder", message) : Promise.resolve(),
        sendMedicationReminder(user.uid, medication.name, medication.enableWhatsApp ? medication.phoneNumber : undefined, medication.enableWhatsApp),
      ];
      await Promise.all(notifications);
      toast.success("Notifications sent successfully! 📱📧📲");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (user) {
        const notifications = [
          sendMobileNotification(user.uid, "Test Reminder Error", `Failed to send test reminder for ${medication.name}: ${errorMessage}`),
          user.email ? sendEmailNotification(user.email, "Test Reminder Error", `Failed to send test reminder for ${medication.name}: ${errorMessage}`) : Promise.resolve(),
        ];
        if (medication.enableWhatsApp && medication.phoneNumber) {
          notifications.push(Promise.resolve(sendMedicationReminder(user.uid, medication.name, medication.phoneNumber, true)));
        }
        await Promise.all(notifications);
      }
      toast.error(`Failed to send test notifications: ${errorMessage}`);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return isMobile
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (time: string) => (isMobile ? time.replace(/:00$/, "") : time);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-white dark:bg-[#0e1a2b] text-black dark:text-white">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto px-4 pt-10 max-w-5xl mx-auto">
          {/* Header without Theme Toggle */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#a855f7]">Manage Your Medications</h1>
            <p className="text-muted-foreground mt-1 mb-6">Track your medications and set reminders</p>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto mb-8">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by medication, dosage, frequency, or notes..."
              className="w-full pl-10 pr-4 py-3 rounded-full bg-card text-foreground placeholder-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="absolute top-1/2 left-3 transform -translate-y-1/2 text-muted-foreground">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.62-5.88a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Medications Header */}
          <div className="flex justify-between items-center mt-10 mb-4">
            <h2 className="text-xl font-semibold text-foreground">Your Medications</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleAddMedication}
                  className="bg-[#a855f7] hover:bg-teal-600 dark:bg-[#a855f7] dark:hover:bg-teal-600 text-white rounded-lg text-sm px-4 py-2"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card text-foreground border-border max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingMedication ? "Edit" : "New"} Medication</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-muted-foreground">Medication Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dosage" className="text-muted-foreground">Dosage</Label>
                      <Input
                        id="dosage"
                        value={formData.dosage}
                        onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                        placeholder="e.g., 500mg"
                        className="bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="frequency" className="text-muted-foreground">Frequency</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                      >
                        <SelectTrigger className="bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="once-daily">Once daily</SelectItem>
                          <SelectItem value="twice-daily">Twice daily</SelectItem>
                          <SelectItem value="three-times-daily">Three times daily</SelectItem>
                          <SelectItem value="four-times-daily">Four times daily</SelectItem>
                          <SelectItem value="as-needed">As needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate" className="text-muted-foreground">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate" className="text-muted-foreground">End Date (Optional)</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Reminder Times</Label>
                    {formData.reminderTimes.map((time, index) => (
                      <div key={index} className="flex items-center space-x-2 mt-2">
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => updateReminderTime(index, e.target.value)}
                          className="bg-card border-border text-foreground flex-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="HH:MM"
                        />
                        {formData.reminderTimes.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeReminderTime(index)}
                            className="text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                            aria-label="Remove reminder time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={addReminderTime}
                      className="mt-2 text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Reminder Time
                    </Button>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">WhatsApp Reminders</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Switch
                        id="enableWhatsApp"
                        checked={formData.enableWhatsApp}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, enableWhatsApp: checked, phoneNumber: checked ? formData.phoneNumber : "" })
                        }
                      />
                      <Label htmlFor="enableWhatsApp" className="text-muted-foreground">Enable WhatsApp Reminders</Label>
                    </div>
                    {formData.enableWhatsApp && (
                      <div className="mt-2">
                        <Label htmlFor="phoneNumber" className="text-muted-foreground">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          placeholder="e.g., +1234567890"
                          className="bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                          required={formData.enableWhatsApp}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-muted-foreground">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1 text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#a855f7] hover:bg-teal-600 dark:bg-[#a855f7] dark:hover:bg-teal-600 text-white"
                    >
                      {editingMedication ? "Update" : "Add"} Medication
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Medications Content */}
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading medications...</div>
          ) : filteredMedications.length === 0 ? (
            <div className="text-center text-muted-foreground py-20">
              <Pill className="mx-auto mb-2 text-muted-foreground w-10 h-10" />
              No medications found. Try adding one or adjusting your search!
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-2 text-[#a855f7] dark:text-[#a855f7]">Active Medications</h3>
                {filteredMedications.map((medication) => (
                  <Card key={medication.id} className="bg-card border-border rounded-lg mt-4 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-foreground font-semibold text-base">{medication.name}</h4>
                            {medication.enableWhatsApp && (
                              <Badge className="bg-green-600 dark:bg-green-500 text-white text-xs">WhatsApp</Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {medication.dosage} • {medication.frequency} • {formatDate(medication.startDate)}
                            {medication.endDate && ` - ${formatDate(medication.endDate)}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {medication.reminderTimes.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => testReminder(medication)}
                              className="text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                              title="Test Reminder"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditMedication(medication)}
                            className="text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => medication.id && handleDeleteMedication(medication.id)}
                            className="text-red-500 dark:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {medication.reminderTimes.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground mb-1">Reminder Times:</p>
                          <div className="flex flex-wrap gap-2">
                            {medication.reminderTimes.map((time, index) => (
                              <Badge key={index} className="bg-blue-600 dark:bg-blue-500 text-white text-xs">
                                {formatTime(time)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {medication.notes && (
                        <div className="mt-2 bg-muted text-muted-foreground p-2 rounded text-sm">
                          Note: {medication.notes}
                        </div>
                      )}
                      {medication.phoneNumber && (
                        <div className="mt-2 text-muted-foreground text-sm">
                          Phone: {medication.phoneNumber}
                        </div>
                      )}
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 dark:text-red-600 text-xs"
                          onClick={() => medication.id && handleDeleteMedication(medication.id)}
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
        </div>
      </div>
    </AuthGuard>
  );
}
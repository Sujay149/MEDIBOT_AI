
"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Menu, Plus, Pill, Clock, Trash2, Edit, Bell } from "lucide-react";
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
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

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
  const { user } = useAuth();
  const reminderTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

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
          user.email ? sendEmailNotification(user.email, "Medication Delete Error", `Failed to save medication: ${errorMessage}`) : Promise.resolve(),
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
      const message = `🧪 This is a test reminder for your medication ${medication.name} (${medication.dosage}). Your reminders are working! 💊`;
      const notifications = [
        sendMobileNotification(user.uid, "Test Reminder", message),
        user.email ? sendEmailNotification(user.email, "Test Reminder", message) : Promise.resolve(),
        sendMedicationReminder(user.uid, medication.name, medication.enableWhatsApp ? medication.phoneNumber : undefined, medication.enableWhatsApp),
      ];
      await Promise.all(notifications);
      toast.success("Test notifications sent successfully! 📱📧📲");
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

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-card">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-muted-foreground hover:text-foreground lg:hidden h-10 w-10"
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="w-8 h-8 relative">
                <Image src="/logo.png" alt="Medibot Logo" width={32} height={32} className="rounded-full" />
              </div>
              <span className="font-semibold text-lg">Medications</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleAddMedication}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 px-4 sm:px-6 text-sm transform hover:scale-105 transition-transform duration-200"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Add Medication</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border text-foreground max-w-[90vw] sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto rounded-xl shadow p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-lg">{editingMedication ? "Edit Medication" : "Add New Medication"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-muted-foreground">Medication Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
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
                        className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="frequency" className="text-muted-foreground">Frequency</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                      >
                        <SelectTrigger className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground shadow-lg">
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
                        className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
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
                        className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
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
                          className="bg-muted border-border text-foreground flex-1 focus:outline-none focus:ring-2 focus:ring-purple-600"
                          placeholder="HH:MM"
                        />
                        {formData.reminderTimes.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeReminderTime(index)}
                            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted h-10 w-10"
                            aria-label="Remove reminder time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addReminderTime}
                      className="mt-2 border-border bg-muted text-foreground hover:bg-purple-600 hover:text-white rounded-lg"
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
                          className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
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
                      className="bg-muted border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                    >
                      {editingMedication ? "Update" : "Add"} Medication
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold">You may forget, but Medibot never forgets...</h1>
                <p className="text-muted-foreground text-sm">Manage your prescriptions and set reminders</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground text-sm">Loading medications...</p>
                </div>
              ) : medications.length > 0 ? (
                <div className="grid gap-4 sm:gap-6">
                  {medications.map((medication) => (
                    <Card key={medication.id} className="bg-card border-border rounded-xl shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg sm:text-xl flex items-center gap-2 text-foreground">
                              {medication.name}
                              {medication.enableWhatsApp && (
                                <Badge variant="secondary" className="bg-green-600 text-white">
                                  WhatsApp
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-muted-foreground text-sm sm:text-base">
                              {medication.dosage} • {medication.frequency}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {medication.reminderTimes.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => testReminder(medication)}
                                className="text-muted-foreground hover:text-green-500 hover:bg-muted h-8 w-8"
                                title="Test Reminder"
                                aria-label="Test Reminder"
                              >
                                <Bell className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditMedication(medication)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8"
                              title="Edit Medication"
                              aria-label="Edit Medication"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => medication.id && handleDeleteMedication(medication.id)}
                              className="text-muted-foreground hover:text-red-500 hover:bg-muted h-8 w-8"
                              title="Delete Medication"
                              aria-label="Delete Medication"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                              <Clock className="mr-1 h-3 w-3" />
                              {medication.startDate}
                            </Badge>
                            {medication.endDate && (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                Until {medication.endDate}
                              </Badge>
                            )}
                            {medication.phoneNumber && (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                Phone: {medication.phoneNumber}
                              </Badge>
                            )}
                          </div>

                          {medication.reminderTimes.length > 0 && (
                            <div>
                              <p className="text-muted-foreground text-sm mb-2">Reminder times:</p>
                              <div className="flex flex-wrap gap-2">
                                {medication.reminderTimes.map((time, index) => (
                                  <Badge key={index} className="bg-purple-600 text-white">
                                    {time}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {medication.notes && (
                            <p className="text-foreground text-sm bg-muted p-3 rounded-lg">{medication.notes}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="bg-card border-border rounded-2xl p-8 sm:p-12 text-center shadow">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <Pill className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">No medications added</h3>
                  <p className="text-muted-foreground mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base">
                    Add your medications to track doses and set reminders
                  </p>
                  <Button
                    onClick={handleAddMedication}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-12 px-6 sm:px-8 font-semibold text-sm sm:text-base"
                  >
                    <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Add Your First Medication
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
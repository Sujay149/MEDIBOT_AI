"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Menu, Plus, Pill, Clock, Trash2, Edit, Bell } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import {
  addMedication,
  updateMedication,
  deleteMedication,
  subscribeToUserMedications,
  sendMedicationReminder,
  type Medication,
} from "@/lib/firestore"
import { toast } from "sonner"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

export default function MedicationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null)
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
  })
  const { user } = useAuth()
  const reminderTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const sendMobileNotification = async (userId: string, title: string, body: string) => {
    try {
      const userDocRef = doc(db, "users", userId)
      const userDoc = await getDoc(userDocRef)
      const fcmToken = userDoc.data()?.fcmToken

      if (!fcmToken) {
        console.log(`No FCM token found for user ${userId}. Falling back to console log.`)
        console.log(`Notification: ${title} - ${body}`)
        toast.info("Push notifications are disabled. Enable them in your browser settings.")
        return
      }

      const response = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: fcmToken,
          notification: {
            title,
            body,
            icon: "/logo.png",
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to send mobile notification: ${response.statusText}`)
      }
    } catch (error) {
      console.error(`Error sending mobile notification: ${error instanceof Error ? error.message : String(error)}`)
      console.log(`Fallback log: ${title} - ${body}`)
      toast.error("Failed to send mobile notification")
    }
  }

  const sendEmailNotification = async (email: string, subject: string, body: string) => {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject,
          message: body,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to send email")
      }
    } catch (error) {
      console.error("Error sending email notification:", error)
      toast.error("Failed to send email notification")
    }
  }

  const scheduleReminders = (medication: Medication, email: string) => {
    if (!medication.id || !medication.reminderTimes.length) return

    cancelReminders(medication.id)

    medication.reminderTimes.forEach((time, index) => {
      const [hours, minutes] = time.split(":").map(Number)
      const now = new Date()
      const reminder = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0)

      if (reminder <= now) {
        reminder.setDate(reminder.getDate() + 1)
      }

      const delay = reminder.getTime() - now.getTime()

      const timeoutId = setTimeout(() => {
        const message = `It's time to take your ${medication.name} (${medication.dosage}) at ${time}.`
        const notifications = [
          sendMobileNotification(user!.uid, `Medication Reminder: ${medication.name}`, message),
          sendEmailNotification(email, `Medication Reminder: ${medication.name}`, message),
          sendMedicationReminder(user!.uid, medication.name, medication.enableWhatsApp ? medication.phoneNumber : undefined, medication.enableWhatsApp),
        ]
        Promise.all(notifications)

        scheduleReminders(medication, email)
      }, delay)

      reminderTimeouts.current.set(`${medication.id}-${index}`, timeoutId)
    })
  }

  const cancelReminders = (medicationId: string) => {
    reminderTimeouts.current.forEach((timeoutId, key) => {
      if (key.startsWith(medicationId)) {
        clearTimeout(timeoutId)
        reminderTimeouts.current.delete(key)
      }
    })
  }

  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToUserMedications(user.uid, (meds) => {
      setMedications(meds)
      setLoading(false)

      meds.forEach((med) => {
        if (med.reminderTimes.length && user.email) {
          scheduleReminders(med, user.email)
        }
      })
    })

    return () => {
      unsubscribe()
      reminderTimeouts.current.forEach((timeoutId) => clearTimeout(timeoutId))
      reminderTimeouts.current.clear()
    }
  }, [user])

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
    })
    setEditingMedication(null)
  }

  const handleAddMedication = () => {
    resetForm()
    setDialogOpen(true)
  }

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
    })
    setEditingMedication(medication)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.error("User not authenticated")
      return
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
      }

      let medicationId: string

      if (editingMedication && editingMedication.id) {
        await updateMedication(editingMedication.id, medicationData)
        medicationId = editingMedication.id
        toast.success("Medication updated successfully!")
      } else {
        medicationId = await addMedication(user.uid, medicationData)
        toast.success("Medication added successfully!")
      }

      const message = `Your medication ${medicationData.name} (${medicationData.dosage}) has been ${editingMedication ? "updated" : "added"} successfully.`
      const notifications = [
        sendMobileNotification(user.uid, "Medication Saved", message),
        user.email ? sendEmailNotification(user.email, "Medication Saved", message) : Promise.resolve(),
        sendMedicationReminder(user.uid, medicationData.name, medicationData.enableWhatsApp ? medicationData.phoneNumber : undefined, medicationData.enableWhatsApp),
      ]
      await Promise.all(notifications)

      setDialogOpen(false)
      resetForm()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const notifications = [
        sendMobileNotification(user.uid, "Medication Save Error", `Failed to save medication: ${errorMessage}`),
        user.email ? sendEmailNotification(user.email, "Medication Save Error", `Failed to save medication: ${errorMessage}`) : Promise.resolve(),
      ]
      if (formData.enableWhatsApp && formData.phoneNumber) {
        notifications.push(sendMedicationReminder(user.uid, formData.name, formData.phoneNumber, true))
      }
      await Promise.all(notifications)
      toast.error(`Failed to save medication: ${errorMessage}`)
    }
  }

  const handleDeleteMedication = async (medicationId: string) => {
    try {
      await deleteMedication(medicationId)
      cancelReminders(medicationId)
      toast.success("Medication deleted successfully!")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (user) {
        const medication = medications.find((m) => m.id === medicationId)
        const notifications = [
          sendMobileNotification(user.uid, "Medication Delete Error", `Failed to delete medication: ${errorMessage}`),
          user.email ? sendEmailNotification(user.email, "Medication Delete Error", `Failed to delete medication: ${errorMessage}`) : Promise.resolve(),
        ]
        if (medication?.enableWhatsApp && medication.phoneNumber) {
          notifications.push(sendMedicationReminder(user.uid, medication.name, medication.phoneNumber, true))
        }
        await Promise.all(notifications)
      }
      toast.error(`Failed to delete medication: ${errorMessage}`)
    }
  }

  const addReminderTime = () => {
    setFormData({
      ...formData,
      reminderTimes: [...formData.reminderTimes, ""],
    })
  }

  const updateReminderTime = (index: number, time: string) => {
    const newTimes = [...formData.reminderTimes]
    newTimes[index] = time
    setFormData({
      ...formData,
      reminderTimes: newTimes,
    })
  }

  const removeReminderTime = (index: number) => {
    const newTimes = formData.reminderTimes.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      reminderTimes: newTimes.length > 0 ? newTimes : [""],
    })
  }

  const testReminder = async (medication: Medication) => {
    try {
      if (!user) {
        toast.error("User not authenticated")
        return
      }
      const message = `🧪 This is a test reminder for your medication ${medication.name} (${medication.dosage}). Your reminders are working! 💊`
      const notifications = [
        sendMobileNotification(user.uid, "Test Reminder", message),
        user.email ? sendEmailNotification(user.email, "Test Reminder", message) : Promise.resolve(),
        sendMedicationReminder(user.uid, medication.name, medication.enableWhatsApp ? medication.phoneNumber : undefined, medication.enableWhatsApp),
      ]
      await Promise.all(notifications)
      toast.success("Test notifications sent successfully! 📱📧📲")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (user) {
        const notifications = [
          sendMobileNotification(user.uid, "Test Reminder Error", `Failed to send test reminder for ${medication.name}: ${errorMessage}`),
          user.email ? sendEmailNotification(user.email, "Test Reminder Error", `Failed to send test reminder for ${medication.name}: ${errorMessage}`) : Promise.resolve(),
        ]
        if (medication.enableWhatsApp && medication.phoneNumber) {
          notifications.push(sendMedicationReminder(user.uid, medication.name, medication.phoneNumber, true))
        }
        await Promise.all(notifications)
      }
      toast.error(`Failed to send test notifications: ${errorMessage}`)
    }
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-slate-950">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-slate-400 hover:text-white lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="w-8 h-8 relative">
                <Image src="/logo.png" alt="MedBot Logo" width={32} height={32} className="rounded-full" />
              </div>
              <span className="text-purple-400 font-semibold text-lg">My Medications</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleAddMedication}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl h-10 px-4 sm:px-6 shadow-lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingMedication ? "Edit Medication" : "Add New Medication"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Medication Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dosage">Dosage</Label>
                      <Input
                        id="dosage"
                        value={formData.dosage}
                        onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                        placeholder="e.g., 500mg"
                        className="bg-slate-800 border-slate-700 text-white"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
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
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date (Optional)</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Reminder Times</Label>
                    {formData.reminderTimes.map((time, index) => (
                      <div key={index} className="flex items-center space-x-2 mt-2">
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => updateReminderTime(index, e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white flex-1"
                          placeholder="HH:MM"
                        />
                        {formData.reminderTimes.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeReminderTime(index)}
                            className="border-slate-700 text-slate-400 hover:text-white"
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
                      className="mt-2 border-slate-700 text-slate-400 hover:text-white"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Reminder Time
                    </Button>
                  </div>

                  <div>
                    <Label>WhatsApp Reminders</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Switch
                        id="enableWhatsApp"
                        checked={formData.enableWhatsApp}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, enableWhatsApp: checked, phoneNumber: checked ? formData.phoneNumber : "" })
                        }
                      />
                      <Label htmlFor="enableWhatsApp">Enable WhatsApp Reminders</Label>
                    </div>
                    {formData.enableWhatsApp && (
                      <div className="mt-2">
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          placeholder="e.g., +1234567890"
                          className="bg-slate-800 border-slate-700 text-white"
                          required={formData.enableWhatsApp}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1 border-slate-700 text-slate-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
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
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">My Medications</h1>
                <p className="text-slate-400">Manage your prescriptions and set reminders</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-400">Loading medications...</p>
                </div>
              ) : medications.length > 0 ? (
                <div className="grid gap-4 sm:gap-6">
                  {medications.map((medication) => (
                    <Card key={medication.id} className="bg-slate-900 border-slate-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
                              {medication.name}
                              {medication.enableWhatsApp && (
                                <Badge variant="secondary" className="bg-green-600 text-white">
                                  WhatsApp
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-slate-400 text-sm sm:text-base">
                              {medication.dosage} • {medication.frequency}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {medication.reminderTimes.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => testReminder(medication)}
                                className="text-slate-400 hover:text-green-400"
                                title="Test Reminder"
                              >
                                <Bell className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditMedication(medication)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => medication.id && handleDeleteMedication(medication.id)}
                              className="text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                              <Clock className="mr-1 h-3 w-3" />
                              {medication.startDate}
                            </Badge>
                            {medication.endDate && (
                              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                                Until {medication.endDate}
                              </Badge>
                            )}
                            {medication.phoneNumber && (
                              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                                Phone: {medication.phoneNumber}
                              </Badge>
                            )}
                          </div>

                          {medication.reminderTimes.length > 0 && (
                            <div>
                              <p className="text-slate-400 text-sm mb-2">Reminder times:</p>
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
                            <p className="text-slate-300 text-sm bg-slate-800 p-3 rounded-lg">{medication.notes}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <Pill className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">No medications added</h3>
                  <p className="text-slate-400 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-lg">
                    Add your medications to track doses and set reminders
                  </p>
                  <Button
                    onClick={handleAddMedication}
                    className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl h-12 px-6 sm:px-8 font-semibold"
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
  )
}
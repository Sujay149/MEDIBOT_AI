"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Menu, Calendar, Plus, MapPin, Clock, User, Phone, Trash2, Edit, Navigation } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { AppointmentForm } from "@/components/appointment-form"
import { deleteAppointment, subscribeToUserAppointments, type Appointment } from "@/lib/firestore"
import { toast } from "sonner"

export default function AppointmentsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      console.log("No user found, skipping appointments subscription")
      return
    }

    console.log("Setting up appointments subscription for user:", user.uid)

    const unsubscribe = subscribeToUserAppointments(user.uid, (userAppointments) => {
      console.log("Received appointments update:", userAppointments)
      setAppointments(userAppointments)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  const handleAddAppointment = () => {
    setEditingAppointment(null)
    setDialogOpen(true)
  }

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setDialogOpen(true)
  }

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return

    try {
      await deleteAppointment(appointmentId)
      toast.success("Appointment deleted successfully!")
    } catch (error) {
      console.error("Error deleting appointment:", error)
      toast.error("Failed to delete appointment")
    }
  }

  const handleGetDirections = (appointment: Appointment) => {
    if (appointment.hospitalLocation) {
      const { lat, lng } = appointment.hospitalLocation
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
      window.open(url, "_blank")
    } else {
      const query = encodeURIComponent(appointment.hospitalName)
      const url = `https://www.google.com/maps/search/?api=1&query=${query}`
      window.open(url, "_blank")
    }
  }

  const getAppointmentStatus = (appointment: Appointment) => {
    const now = new Date()
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)

    if (appointmentDate < now) {
      return { status: "completed", color: "bg-green-600" }
    } else if (appointmentDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) {
      return { status: "upcoming", color: "bg-yellow-600" }
    } else {
      return { status: "scheduled", color: "bg-blue-600" }
    }
  }

  const upcomingAppointments = appointments.filter((apt) => {
    const appointmentDate = new Date(`${apt.date}T${apt.time}`)
    return appointmentDate >= new Date()
  })

  const pastAppointments = appointments.filter((apt) => {
    const appointmentDate = new Date(`${apt.date}T${apt.time}`)
    return appointmentDate < new Date()
  })

  return (
    <AuthGuard>
      <div className="flex h-screen bg-slate-950 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-slate-400 hover:text-white lg:hidden h-8 w-8 sm:h-10 sm:w-10"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <span className="text-white font-semibold text-base sm:text-lg">My Appointments</span>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={handleAddAppointment}
                    className="bg-gradient-to-r from-indigo-600/20 to-indigo-400/20 border-indigo-500 text-white hover:bg-gradient-to-r hover:from-indigo-600/40 hover:to-indigo-400/40 rounded-lg h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm transform hover:scale-105 transition-transform duration-200"
                  >
                    <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Book Appointment</span>
                    <span className="sm:hidden">Book</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-[90vw] sm:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-lg">
                  <DialogHeader>
                    <DialogTitle className="text-sm sm:text-base">
                      {editingAppointment ? "Edit Appointment" : "Book New Appointment"}
                    </DialogTitle>
                  </DialogHeader>
                  <AppointmentForm
                    appointment={editingAppointment}
                    onSuccess={() => {
                      setDialogOpen(false)
                      setEditingAppointment(null)
                    }}
                    onCancel={() => {
                      setDialogOpen(false)
                      setEditingAppointment(null)
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
            <div className="max-w-full sm:max-w-4xl md:max-w-6xl mx-auto space-y-4 sm:space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Take your  Doctor Appointments From here...</h1>
                <p className="text-slate-400 text-xs sm:text-sm">Manage your medical appointments and schedules</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-400 mb-1 sm:mb-2">{appointments.length}</div>
                    <div className="text-slate-400 font-medium text-xs sm:text-sm">Total Appointments</div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-1 sm:mb-2">{upcomingAppointments.length}</div>
                    <div className="text-slate-400 font-medium text-xs sm:text-sm">Upcoming</div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-green-400 mb-1 sm:mb-2">{pastAppointments.length}</div>
                    <div className="text-slate-400 font-medium text-xs sm:text-sm">Completed</div>
                  </CardContent>
                </Card>
              </div>

              {loading ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3 sm:mb-4"></div>
                  <p className="text-slate-400 text-xs sm:text-sm">Loading appointments...</p>
                </div>
              ) : appointments.length > 0 ? (
                <div className="space-y-6 sm:space-y-8">
                  {/* Upcoming Appointments */}
                  {upcomingAppointments.length > 0 && (
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Upcoming Appointments</h2>
                      <div className="grid gap-3 sm:gap-4">
                        {upcomingAppointments.map((appointment) => {
                          const { status, color } = getAppointmentStatus(appointment)
                          return (
                            <Card key={appointment.id} className="bg-slate-900 border-slate-800">
                              <CardContent className="p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                                      <h3 className="text-white font-semibold text-base sm:text-lg">{appointment.hospitalName}</h3>
                                      <Badge className={`${color} text-white text-xs sm:text-sm`}>
                                        {status === "upcoming" ? "Tomorrow" : "Scheduled"}
                                      </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:gap-4 text-xs sm:text-sm">
                                      <div className="space-y-1 sm:space-y-2">
                                        <div className="flex items-center text-slate-300">
                                          <User className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                          Dr. {appointment.doctorName}
                                        </div>
                                        <div className="flex items-center text-slate-300">
                                          <Calendar className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                          {new Date(appointment.date).toLocaleDateString("en-US", {
                                            weekday: "long",
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                          })}
                                        </div>
                                        <div className="flex items-center text-slate-300">
                                          <Clock className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                          {appointment.time}
                                        </div>
                                      </div>

                                      <div className="space-y-1 sm:space-y-2">
                                        <div className="flex items-center text-slate-300">
                                          <MapPin className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                          {appointment.hospitalAddress}
                                        </div>
                                        {appointment.hospitalPhone && (
                                          <div className="flex items-center text-slate-300">
                                            <Phone className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                            {appointment.hospitalPhone}
                                          </div>
                                        )}
                                        <div className="text-slate-400">
                                          <span className="font-medium">Type:</span> {appointment.appointmentType}
                                        </div>
                                      </div>
                                    </div>

                                    {appointment.notes && (
                                      <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-slate-800 rounded-lg">
                                        <p className="text-slate-300 text-xs sm:text-sm">
                                          <span className="font-medium">Notes:</span> {appointment.notes}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-1 sm:space-x-2 mt-3 sm:mt-0 sm:ml-4">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleGetDirections(appointment)}
                                      className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 sm:h-10 sm:w-10"
                                      title="Get Directions"
                                    >
                                      <Navigation className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditAppointment(appointment)}
                                      className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 sm:h-10 sm:w-10"
                                      title="Edit Appointment"
                                    >
                                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => appointment.id && handleDeleteAppointment(appointment.id)}
                                      className="text-slate-400 hover:text-red-400 hover:bg-slate-800 h-8 w-8 sm:h-10 sm:w-10"
                                      title="Delete Appointment"
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Past Appointments */}
                  {pastAppointments.length > 0 && (
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Past Appointments</h2>
                      <div className="grid gap-3 sm:gap-4">
                        {pastAppointments.slice(0, 5).map((appointment) => (
                          <Card key={appointment.id} className="bg-slate-900 border-slate-800 opacity-75">
                            <CardContent className="p-4 sm:p-6">
                              <div className="flex flex-col sm:flex-row items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                                    <h3 className="text-white font-semibold text-base sm:text-lg">{appointment.hospitalName}</h3>
                                    <Badge className="bg-green-600 text-white text-xs sm:text-sm">Completed</Badge>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3 sm:gap-4 text-xs sm:text-sm">
                                    <div className="space-y-1 sm:space-y-2">
                                      <div className="flex items-center text-slate-300">
                                        <User className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                        Dr. {appointment.doctorName}
                                      </div>
                                      <div className="flex items-center text-slate-300">
                                        <Calendar className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                        {new Date(appointment.date).toLocaleDateString()}
                                      </div>
                                    </div>
                                    <div className="space-y-1 sm:space-y-2">
                                      <div className="text-slate-400">
                                        <span className="font-medium">Type:</span> {appointment.appointmentType}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 sm:space-x-2 mt-3 sm:mt-0 sm:ml-4">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => appointment.id && handleDeleteAppointment(appointment.id)}
                                    className="text-slate-400 hover:text-red-400 hover:bg-slate-800 h-8 w-8 sm:h-10 sm:w-10"
                                    title="Delete Appointment"
                                  >
                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty State */
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-8 md:p-12 text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 md:mb-8">
                    <Calendar className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-slate-400" />
                  </div>

                  <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-white mb-2 sm:mb-3 md:mb-4">
                    No appointments scheduled
                  </h3>
                  <p className="text-slate-400 mb-4 sm:mb-6 md:mb-8 max-w-xs sm:max-w-sm md:max-w-md mx-auto text-xs sm:text-sm md:text-base">
                    Book your first medical appointment to get started
                  </p>

                  <Button
                    onClick={handleAddAppointment}
                    className="bg-gradient-to-r from-indigo-600/20 to-indigo-400/20 border-indigo-500 text-white hover:bg-gradient-to-r hover:from-indigo-600/40 hover:to-indigo-400/40 rounded-lg h-10 sm:h-12 px-4 sm:px-6 md:px-8 font-semibold text-xs sm:text-sm md:text-base transform hover:scale-105 transition-transform duration-200"
                  >
                    <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                    Book Your First Appointment
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
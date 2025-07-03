"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Menu, Calendar, Plus, MapPin, Clock, User, Phone, Trash2, Edit, Navigation } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppointmentForm } from "@/components/appointment-form";
import { deleteAppointment, subscribeToUserAppointments, type Appointment } from "@/lib/firestore";
import { toast } from "sonner";
import axios from "axios";

export default function AppointmentsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 768);
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserAppointments(user.uid, (userAppointments) => {
      setAppointments(userAppointments);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const sendAppointmentEmail = async (appointment: Appointment) => {
    try {
      await axios.post("/api/send-appointment-email", {
        userEmail: user?.email,
        appointment: {
          hospitalName: appointment.hospitalName,
          doctorName: appointment.doctorName,
          date: appointment.date,
          time: appointment.time,
          notes: appointment.notes || "No additional notes",
        },
      });
      toast.success("Appointment confirmation email sent!");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send appointment confirmation email");
    }
  };

  const handleAddAppointment = () => {
    setEditingAppointment(null);
    setDialogOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setDialogOpen(true);
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;

    try {
      await deleteAppointment(appointmentId);
      toast.success("Appointment deleted successfully!");
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast.error("Failed to delete appointment");
    }
  };

  const handleGetDirections = (appointment: Appointment) => {
    if (appointment.hospitalLocation) {
      const { lat, lng } = appointment.hospitalLocation;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, "_blank");
    } else {
      const query = encodeURIComponent(appointment.hospitalName);
      const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(url, "_blank");
    }
  };

  const getAppointmentStatus = (appointment: Appointment) => {
    const now = new Date();
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`);

    if (appointmentDate < now) {
      return { status: "completed", color: "bg-green-600" };
    } else if (appointmentDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) {
      return { status: "upcoming", color: "bg-yellow-600" };
    } else {
      return { status: "scheduled", color: "bg-blue-600" };
    }
  };

  const upcomingAppointments = appointments.filter((apt) => {
    const appointmentDate = new Date(`${apt.date}T${apt.time}`);
    return appointmentDate >= new Date();
  });

  const pastAppointments = appointments.filter((apt) => {
    const appointmentDate = new Date(`${apt.date}T${apt.time}`);
    return appointmentDate < new Date();
  });

  const formatDateForMobile = (dateString: string) => {
    const date = new Date(dateString);
    return isMobile 
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : date.toLocaleDateString("en-US", { 
          weekday: "long", 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        });
  };

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - Optimized for larger screens and mobile */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-card sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground lg:hidden h-10 w-10 md:h-12 md:w-12"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
              <div className="w-9 h-9 md:w-12 md:h-12 bg-purple-600 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 md:h-6 md:w-6 text-white" />
              </div>
              <span className="font-semibold text-lg md:text-xl">Appointments</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleAddAppointment}
                  size={isMobile ? "icon" : "default"}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 md:h-12 px-4 md:px-6 text-sm md:text-base"
                >
                  {isMobile ? (
                    <Plus className="h-5 w-5 md:h-6 md:w-6" />
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                      <span>Book</span>
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-[95vw] md:max-w-lg rounded-lg mx-auto max-h-[90vh] overflow-y-auto p-4 md:p-6">
                <DialogHeader>
                  <DialogTitle className="text-lg md:text-xl">
                    {editingAppointment ? "Edit Appointment" : "New Appointment"}
                  </DialogTitle>
                </DialogHeader>
                <AppointmentForm
                  appointment={editingAppointment}
                  onSuccess={() => {
                    setDialogOpen(false);
                    setEditingAppointment(null);
                  }}
                  onCancel={() => {
                    setDialogOpen(false);
                    setEditingAppointment(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Content - Optimized for larger screens and mobile */}
          <div className="flex-1 p-4 md:p-8 overflow-y-auto">
            <div className="max-w-full md:max-w-4xl mx-auto space-y-6">
              <div>
                <h1 className="text-xl md:text-2xl font-semibold">Your Appointments</h1>
                <p className="text-muted-foreground text-sm md:text-base">Manage your medical schedules</p>
              </div>

              {/* Stats - Larger cards on big screens */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-semibold text-purple-600">{appointments.length}</div>
                    <div className="text-muted-foreground text-sm md:text-base">Total</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-semibold text-yellow-600">{upcomingAppointments.length}</div>
                    <div className="text-muted-foreground text-sm md:text-base">Upcoming</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-semibold text-green-600">{pastAppointments.length}</div>
                    <div className="text-muted-foreground text-sm md:text-base">Completed</div>
                  </CardContent>
                </Card>
              </div>

              {loading ? (
                <div className="text-center py-10">
                  <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-muted-foreground text-sm md:text-base">Loading...</p>
                </div>
              ) : appointments.length > 0 ? (
                <div className="space-y-6">
                  {/* Upcoming Appointments - Larger cards */}
                  {upcomingAppointments.length > 0 && (
                    <div>
                      <h2 className="text-lg md:text-xl font-semibold mb-3">Upcoming</h2>
                      <div className="space-y-3">
                        {upcomingAppointments.map((appointment) => {
                          const { status, color } = getAppointmentStatus(appointment);
                          return (
                            <Card key={appointment.id} className="bg-card border-border rounded-lg shadow-sm">
                              <CardContent className="p-4 md:p-6">
                                <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <h3 className="font-medium text-base md:text-lg line-clamp-1">
                                        {appointment.hospitalName}
                                      </h3>
                                      <Badge className={`${color} text-white text-xs md:text-sm px-2 py-1`}>
                                        {status === "upcoming" ? "Soon" : "Scheduled"}
                                      </Badge>
                                    </div>

                                    <div className="text-sm md:text-base space-y-1.5">
                                      <div className="flex items-center text-foreground">
                                        <User className="mr-1.5 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                                        <span className="truncate">Dr. {appointment.doctorName}</span>
                                      </div>
                                      <div className="flex items-center text-foreground">
                                        <Calendar className="mr-1.5 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                                        {formatDateForMobile(appointment.date)}
                                      </div>
                                      <div className="flex items-center text-foreground">
                                        <Clock className="mr-1.5 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                                        {appointment.time}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2 mt-3 md:mt-0 md:ml-4">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleGetDirections(appointment)}
                                      className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground"
                                      title="Directions"
                                    >
                                      <Navigation className="h-4 w-4 md:h-5 md:w-5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditAppointment(appointment)}
                                      className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground"
                                      title="Edit"
                                    >
                                      <Edit className="h-4 w-4 md:h-5 md:w-5" />
                                    </Button>
                                  </div>
                                </div>

                                {appointment.notes && (
                                  <div className="mt-3 p-3 bg-muted rounded text-sm md:text-base line-clamp-2">
                                    {appointment.notes}
                                  </div>
                                )}

                                <div className="mt-3 flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => appointment.id && handleDeleteAppointment(appointment.id)}
                                    className="text-sm md:text-base h-8 text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="mr-1.5 h-4 w-4 md:h-5 md:w-5" />
                                    Delete
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Past Appointments - Larger compact cards */}
                  {pastAppointments.length > 0 && (
                    <div>
                      <h2 className="text-lg md:text-xl font-semibold mb-3">Past Appointments</h2>
                      <div className="space-y-3">
                        {pastAppointments.slice(0, 3).map((appointment) => (
                          <Card key={appointment.id} className="bg-card border-border rounded-lg shadow-sm opacity-80">
                            <CardContent className="p-4 md:p-6">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <h3 className="font-medium text-base md:text-lg">{appointment.hospitalName}</h3>
                                    <Badge className="bg-green-600 text-white text-xs md:text-sm px-2 py-1">
                                      Completed
                                    </Badge>
                                  </div>
                                  <div className="text-sm md:text-base text-muted-foreground">
                                    Dr. {appointment.doctorName} • {formatDateForMobile(appointment.date)}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => appointment.id && handleDeleteAppointment(appointment.id)}
                                  className="h-8 w-8 md:h-10 md:w-10 text-red-500"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {pastAppointments.length > 3 && (
                        <div className="text-center text-sm md:text-base text-muted-foreground mt-3">
                          + {pastAppointments.length - 3} more past appointments
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Empty State - Larger for big screens, enhanced for mobile */
                <div className="bg-card border-border rounded-xl p-6 md:p-8 text-center shadow-sm mt-6">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold mb-2">
                    No appointments
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm md:text-base">
                    Book your first medical appointment
                  </p>
                  <Button
                    onClick={handleAddAppointment}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 md:h-12 px-4 md:px-6 text-sm md:text-base"
                  >
                    <Plus className="mr-1.5 h-4 w-4 md:h-5 md:w-5" />
                    Book Appointment
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
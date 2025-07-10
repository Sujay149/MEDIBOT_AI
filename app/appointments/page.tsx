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
          weekday: "short", 
          month: "short", 
          day: "numeric" 
        });
  };

  const formatTimeForMobile = (timeString: string) => {
    return isMobile 
      ? timeString.replace(/:00$/, '') // Remove :00 if it's exactly on the hour
      : timeString;
  };

  return (
    <AuthGuard>
      <div className="bg-background text-foreground min-h-screen flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile-optimized header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-card sticky top-0 z-10">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground h-9 w-9"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-semibold text-base">Appointments</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleAddAppointment}
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-9 w-9"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-[95vw] rounded-lg mx-auto max-h-[90vh] overflow-y-auto p-4">
                <DialogHeader>
                  <DialogTitle className="text-base">
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

          {/* Mobile-optimized content */}
          <div className="flex-1 p-3 overflow-y-auto">
            <div className="max-w-full mx-auto space-y-4">
              <div>
                <h1 className="text-lg font-semibold">Your Appointments</h1>
                <p className="text-muted-foreground text-xs">Manage your medical schedules</p>
              </div>

              {/* Mobile stats cards */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-semibold text-purple-600">{appointments.length}</div>
                    <div className="text-muted-foreground text-xs">Total</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-semibold text-yellow-600">{upcomingAppointments.length}</div>
                    <div className="text-muted-foreground text-xs">Upcoming</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg shadow-sm">
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-semibold text-green-600">{pastAppointments.length}</div>
                    <div className="text-muted-foreground text-xs">Completed</div>
                  </CardContent>
                </Card>
              </div>

              {loading ? (
                <div className="text-center py-6">
                  <div className="w-5 h-5 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-muted-foreground text-xs">Loading appointments...</p>
                </div>
              ) : appointments.length > 0 ? (
                <div className="space-y-3">
                  {/* Upcoming Appointments - Mobile cards */}
                  {upcomingAppointments.length > 0 && (
                    <div>
                      <h2 className="text-base font-semibold mb-2">Upcoming</h2>
                      <div className="space-y-2">
                        {upcomingAppointments.map((appointment) => {
                          const { status, color } = getAppointmentStatus(appointment);
                          return (
                            <Card key={appointment.id} className="bg-card border-border rounded-lg shadow-sm">
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-1 mb-1">
                                   <h3 className="font-medium text-sm line-clamp-1 text-gray-900 dark:text-gray-100">
  {appointment.hospitalName}
</h3>

                                      <Badge className={`${color} text-white text-xs px-1.5 py-0.5`}>
                                        {status === "upcoming" ? "Soon" : "Scheduled"}
                                      </Badge>
                                    </div>

                                    <div className="text-xs space-y-1">
                                      <div className="flex items-center text-foreground">
                                        <User className="mr-1 h-3 w-3 text-muted-foreground" />
                                        <span className="truncate">Dr. {appointment.doctorName}</span>
                                      </div>
                                      <div className="flex items-center text-foreground">
                                        <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
                                        {formatDateForMobile(appointment.date)}
                                      </div>
                                      <div className="flex items-center text-foreground">
                                        <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
                                        {formatTimeForMobile(appointment.time)}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-1 ml-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleGetDirections(appointment)}
                                      className="h-7 w-7 text-muted-foreground"
                                      title="Directions"
                                    >
                                      <Navigation className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditAppointment(appointment)}
                                      className="h-7 w-7 text-muted-foreground"
                                      title="Edit"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                {appointment.notes && (
                                  <div className="mt-2 p-2 bg-muted rounded text-xs line-clamp-2">
                                    {appointment.notes}
                                  </div>
                                )}

                                <div className="mt-2 flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => appointment.id && handleDeleteAppointment(appointment.id)}
                                    className="text-xs h-7 text-red-500 hover:text-red-600 px-2"
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
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

                  {/* Past Appointments - Compact mobile cards */}
                  {pastAppointments.length > 0 && (
                    <div>
                      <h2 className="text-base font-semibold mb-2">Past Appointments</h2>
                      <div className="space-y-2">
                        {pastAppointments.slice(0, 3).map((appointment) => (
                          <Card key={appointment.id} className="bg-card border-border rounded-lg shadow-sm opacity-80">
                            <CardContent className="p-3">
                              <div className="flex justify-between items-center">
                                <div className="truncate">
                                  <div className="flex items-center space-x-1">
                                    <h3 className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
                                        {appointment.hospitalName}
                                    </h3>

                                    <Badge className="bg-green-600 text-white text-xs px-1.5 py-0.5">
                                      Done
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    Dr. {appointment.doctorName} • {formatDateForMobile(appointment.date)}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => appointment.id && handleDeleteAppointment(appointment.id)}
                                  className="h-7 w-7 text-red-500"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {pastAppointments.length > 3 && (
                        <div className="text-center text-xs text-muted-foreground mt-1">
                          + {pastAppointments.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Mobile empty state */
                <div className="bg-card border-border rounded-lg p-4 text-center shadow-sm mt-4">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">
                    No appointments
                  </h3>
                  <p className="text-muted-foreground mb-3 text-xs">
                    Book your first medical appointment
                  </p>
                  <Button
                    onClick={handleAddAppointment}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-9 px-3 text-xs"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Book Now
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
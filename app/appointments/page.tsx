"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Menu,
  Calendar,
  Plus,
  Clock,
  User,
  Trash2,
  Edit,
  Navigation,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppointmentForm } from "@/components/appointment-form";
import {
  deleteAppointment,
  subscribeToUserAppointments,
  type Appointment,
} from "@/lib/firestore";
import { toast } from "sonner";

export default function AppointmentsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserAppointments(user.uid, (userAppointments) => {
      setAppointments(userAppointments);
      setLoading(false);
      setError(false);
    });
    return unsubscribe;
  }, [user]);

  const filteredAppointments = appointments.filter((a) =>
    a.hospitalName.toLowerCase().includes(search.toLowerCase()) ||
    a.doctorName.toLowerCase().includes(search.toLowerCase())
  );

  const upcomingAppointments = filteredAppointments.filter((apt) => new Date(`${apt.date}T${apt.time}`) >= new Date());
  const pastAppointments = filteredAppointments.filter((apt) => new Date(`${apt.date}T${apt.time}`) < new Date());

  const getStatus = (apt: Appointment) => {
    const now = new Date();
    const aptDate = new Date(`${apt.date}T${apt.time}`);
    if (aptDate < now) return { label: "Done", color: "bg-green-600 dark:bg-green-500" };
    if (aptDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) return { label: "Soon", color: "bg-yellow-600 dark:bg-yellow-500" };
    return { label: "Scheduled", color: "bg-blue-600 dark:bg-blue-500" };
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return isMobile
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (time: string) => (isMobile ? time.replace(/:00$/, "") : time);

  const handleDirections = (apt: Appointment) => {
    const url = apt.hospitalLocation
      ? `https://www.google.com/maps/dir/?api=1&destination=${apt.hospitalLocation.lat},${apt.hospitalLocation.lng}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apt.hospitalName)}`;
    window.open(url, "_blank");
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-white dark:bg-[#0e1a2b] text-black dark:text-white">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto px-4 pt-10 max-w-5xl mx-auto">
          {/* Header without Theme Toggle */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#a855f7]">Book Your Appointment</h1>
            <p className="text-muted-foreground mt-1 mb-6">Choose from our premium healthcare network</p>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto mb-8">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by hospital, doctor, location..."
              className="w-full pl-10 pr-4 py-3 rounded-full bg-card text-foreground placeholder-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="absolute top-1/2 left-3 transform -translate-y-1/2 text-muted-foreground">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.62-5.88a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-card text-red-400 dark:text-red-600 px-4 py-3 rounded-xl text-center shadow">
              Error loading hospitals. Showing sample data.
            </div>
          )}

          {/* Appointments Header */}
          <div className="flex justify-between items-center mt-10 mb-4">
            <h2 className="text-xl font-semibold text-foreground">Your Appointments</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingAppointment(null);
                    setDialogOpen(true);
                  }}
                  className="bg-[#a855f7] hover:bg-teal-600 dark:bg-[#a855f7] dark:hover:bg-teal-600 text-white rounded-lg text-sm px-4 py-2"
                >
                  <Plus className="mr-1 h-4 w-4 " /> Book
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card text-foreground border-border max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingAppointment ? "Edit" : "New"} Appointment</DialogTitle>
                </DialogHeader>
                <AppointmentForm
                  appointment={editingAppointment}
                  onSuccess={() => {
                    setDialogOpen(false);
                    setEditingAppointment(null);
                  }}
                  onCancel={() => setDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Appointments Content */}
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading appointments...</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center text-muted-foreground py-20">
              <Calendar className="mx-auto mb-2 text-muted-foreground w-10 h-10" />
              No appointments found. Try booking one!
            </div>
          ) : (
            <div className="space-y-6">
              {upcomingAppointments.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold mb-2 text-[#a855f7] dark:text-[#a855f7]">Upcoming</h3>
                  {upcomingAppointments.map((apt) => {
                    const { label, color } = getStatus(apt);
                    return (
                      <Card key={apt.id} className="bg-card border-border rounded-lg mt-4 shadow-md">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-foreground font-semibold text-base">{apt.hospitalName}</h4>
                                <Badge className={`${color} text-white text-xs`}>{label}</Badge>
                              </div>
                              <p className="text-muted-foreground text-sm">
                                Dr. {apt.doctorName} • {formatDate(apt.date)} @ {formatTime(apt.time)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDirections(apt)}
                                className="text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                                title="Directions"
                              >
                                <Navigation className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingAppointment(apt);
                                  setDialogOpen(true);
                                }}
                                className="text-muted-foreground hover:text-teal-300 dark:hover:text-teal-500"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {apt.notes && (
                            <div className="mt-2 bg-muted text-muted-foreground p-2 rounded text-sm">
                              Note: {apt.notes}
                            </div>
                          )}
                          <div className="mt-2 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 dark:text-red-600 text-xs"
                              onClick={() =>
                                apt.id &&
                                deleteAppointment(apt.id)
                                  .then(() => toast.success("Appointment deleted successfully"))
                                  .catch(() => toast.error("Failed to delete appointment"))
                              }
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </section>
              )}

              {pastAppointments.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Past Appointments</h3>
                  {pastAppointments.slice(0, 3).map((apt) => (
                    <Card key={apt.id} className="bg-card border-border mt-4 rounded-lg opacity-70">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <h4 className="text-foreground font-semibold">{apt.hospitalName}</h4>
                          <p className="text-muted-foreground text-sm">
                            Dr. {apt.doctorName} • {formatDate(apt.date)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            apt.id &&
                            deleteAppointment(apt.id)
                              .then(() => toast.success("Appointment deleted successfully"))
                              .catch(() => toast.error("Failed to delete appointment"))
                          }
                          className="text-red-500 dark:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {pastAppointments.length > 10 && (
                    <p className="text-center text-muted-foreground mt-2">
                      + {pastAppointments.length - 3} more
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
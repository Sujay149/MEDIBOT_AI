"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  addAppointment,
  updateAppointment,
  type Appointment,
} from "@/lib/firestore";
import { toast } from "sonner";
import axios from "axios";

interface AppointmentFormProps {
  appointment?: Appointment | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface HospitalLocation {
  lat: number;
  lng: number;
}

export function AppointmentForm({
  appointment,
  onSuccess,
  onCancel,
}: AppointmentFormProps) {
  const [formData, setFormData] = useState({
    hospitalName: "",
    hospitalAddress: "",
    hospitalPhone: "",
    doctorName: "",
    appointmentType: "",
    date: "",
    time: "",
    notes: "",
  });
  const [hospitalLocation, setHospitalLocation] =
    useState<HospitalLocation | undefined>();
  const [loading, setLoading] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const { user } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (appointment) {
      setFormData({
        hospitalName: appointment.hospitalName,
        hospitalAddress: appointment.hospitalAddress,
        hospitalPhone: appointment.hospitalPhone || "",
        doctorName: appointment.doctorName,
        appointmentType: appointment.appointmentType,
        date: appointment.date,
        time: appointment.time,
        notes: appointment.notes || "",
      });
      if (appointment.hospitalLocation) {
        setHospitalLocation(appointment.hospitalLocation);
      }
    }
  }, [appointment]);

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    } else {
      initializeMap();
    }
  }, []);

  useEffect(() => {
    if (hospitalLocation && mapInstanceRef.current) {
      updateMapLocation(hospitalLocation);
    }
  }, [hospitalLocation]);

  const initializeMap = () => {
    if (mapRef.current && window.google) {
      const defaultLocation = { lat: 40.7128, lng: -74.006 };

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: hospitalLocation || defaultLocation,
        disableDefaultUI: false,
      });

      if (hospitalLocation) {
        updateMapLocation(hospitalLocation);
      }
    }
  };

  const updateMapLocation = (location: HospitalLocation) => {
    if (!mapInstanceRef.current) return;

    mapInstanceRef.current.setCenter(location);

    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    markerRef.current = new window.google.maps.Marker({
      position: location,
      map: mapInstanceRef.current,
      title: formData.hospitalName || "Hospital Location",
    });
  };

  const searchHospitalLocation = async () => {
    if (!formData.hospitalName.trim()) {
      toast.error("Please enter a hospital name first");
      return;
    }

    setSearchingLocation(true);

    try {
      if (window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder();
        const query = `${formData.hospitalName} ${formData.hospitalAddress || "hospital"}`;

        geocoder.geocode({ address: query }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location;
            const newLocation = {
              lat: location.lat(),
              lng: location.lng(),
            };
            setHospitalLocation(newLocation);

            if (!formData.hospitalAddress && results[0].formatted_address) {
              setFormData((prev) => ({
                ...prev,
                hospitalAddress: results[0].formatted_address,
              }));
            }

            toast.success("Hospital location found!");
          } else {
            toast.error(
              "Could not find hospital location. Please check the name and try again."
            );
          }
          setSearchingLocation(false);
        });
      }
    } catch (error) {
      console.error("Error searching location:", error);
      toast.error("Failed to search location");
      setSearchingLocation(false);
    }
  };

  const sendWhatsappMessage = async (to: string, text: string) => {
    try {
      await axios.post(
        "/api/send-whatsapp",
        {
          to,
          message: text,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("WhatsApp send error:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.hospitalName.trim())
      return toast.error("Hospital name is required");
    if (!formData.hospitalAddress.trim())
      return toast.error("Hospital address is required");
    if (!formData.doctorName.trim())
      return toast.error("Doctor name is required");
    if (!formData.appointmentType)
      return toast.error("Appointment type is required");
    if (!formData.date) return toast.error("Date is required");
    if (!formData.time) return toast.error("Time is required");

    setLoading(true);

    try {
      const appointmentData = {
        hospitalName: formData.hospitalName.trim(),
        hospitalAddress: formData.hospitalAddress.trim(),
        hospitalPhone: formData.hospitalPhone.trim(),
        doctorName: formData.doctorName.trim(),
        appointmentType: formData.appointmentType,
        date: formData.date,
        time: formData.time,
        notes: formData.notes.trim(),
        hospitalLocation,
       patientPhone: user.phoneNumber || "",

        userName: user.displayName || "",
      };

      if (appointment && appointment.id) {
        await updateAppointment(appointment.id, appointmentData);
        toast.success("Appointment updated successfully!");
      } else {
        await addAppointment(user.uid, {
          ...appointmentData,
          status: "scheduled",
        });
        toast.success("Appointment booked successfully!");
      }

    await sendWhatsappMessage(
  `+91${formData.hospitalPhone}`,
  `📋 New Appointment Request:\n👤 Patient: ${user.displayName}\n🏥 Hospital: ${formData.hospitalName}\n📅 Date: ${formData.date} at ${formData.time}\n📄 Notes: ${formData.notes || "None"}\n\nReply with *ACCEPT* or *REJECT*.`
);


      onSuccess();
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast.error("Failed to save appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Hospital Information</h3>

        <div>
          <Label htmlFor="hospitalName">Hospital Name *</Label>
          <div className="flex space-x-2 mt-1">
            <Input id="hospitalName" value={formData.hospitalName} onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })} required />
            <Button type="button" onClick={searchHospitalLocation} disabled={searchingLocation}> 
              {searchingLocation ? "Searching..." : <Search className="h-4 w-4" />} 
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="hospitalAddress">Hospital Address *</Label>
          <Input id="hospitalAddress" value={formData.hospitalAddress} onChange={(e) => setFormData({ ...formData, hospitalAddress: e.target.value })} required />
        </div>

        <div>
          <Label htmlFor="hospitalPhone">Hospital Phone</Label>
          <Input id="hospitalPhone" value={formData.hospitalPhone} onChange={(e) => setFormData({ ...formData, hospitalPhone: e.target.value })} />
        </div>

        <div className="h-48 bg-muted border rounded overflow-hidden">
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {hospitalLocation && (
          <p className="text-xs text-muted-foreground mt-1">
            <MapPin className="inline h-3 w-3 mr-1" />
            Location: {hospitalLocation.lat.toFixed(6)}, {hospitalLocation.lng.toFixed(6)}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Appointment Details</h3>

        <div>
          <Label htmlFor="doctorName">Doctor Name *</Label>
          <Input id="doctorName" value={formData.doctorName} onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })} required />
        </div>

      
        <div>
          <Label htmlFor="appointmentType">Appointment Type *</Label>
          <Select value={formData.appointmentType} onValueChange={(value) => setFormData({ ...formData, appointmentType: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select appointment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consultation">General Consultation</SelectItem>
              <SelectItem value="checkup">Regular Checkup</SelectItem>
              <SelectItem value="follow-up">Follow-up Visit</SelectItem>
              <SelectItem value="specialist">Specialist Consultation</SelectItem>
              <SelectItem value="emergency">Emergency Visit</SelectItem>
              <SelectItem value="diagnostic">Diagnostic Tests</SelectItem>
              <SelectItem value="surgery">Surgery Consultation</SelectItem>
              <SelectItem value="therapy">Therapy Session</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input type="date" id="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="time">Time *</Label>
            <Input type="time" id="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} required />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Saving..." : appointment ? "Update Appointment" : "Book Appointment"}</Button>
      </div>
    </form>
  );
}

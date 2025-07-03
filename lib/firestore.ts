import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
  limit,
  type Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  dateOfBirth?: string;
  gender?: string;
  phoneNumber?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalInfo?: {
    allergies: string[];
    conditions: string[];
    bloodType?: string;
  };
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  preferences?: {
    theme: "dark" | "light";
    notifications: boolean;
    emailNotifications: boolean;
    medicationReminders: boolean;
    appointmentReminders: boolean;
  };
}

export interface ChatMessage {
  id?: string;
  userId: string;
  image?: string;
  message: string;
  response: string;
  timestamp: Timestamp | Date;
  type: "chat" | "summarizer";
}

export interface ChatSession {
  id?: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Medication {
  id?: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  reminderTimes: string[];
  isActive: boolean;
  enableWhatsApp?: boolean;
  phoneNumber?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface HealthRecord {
  id?: string;
  userId: string;
  type: "symptom" | "appointment" | "test_result" | "vital_signs";
  title: string;
  description: string;
  date: string;
  attachments?: string[];
  createdAt: Timestamp | Date;
}

export interface SummaryRequest {
  id?: string;
  userId: string;
  originalText: string;
  summary: string;
  category: "symptoms" | "medication" | "diagnosis" | "treatment" | "general";
  createdAt: Timestamp | Date;
}

export interface PrescriptionAnalysis {
  id?: string;
  userId: string;
  fileName: string;
  medications: string[];
  dosages: string[];
  instructions: string;
  warnings: string[];
  createdAt: Timestamp | Date;
}

export interface NotificationSettings {
  id?: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  medicationReminders: boolean;
  appointmentReminders: boolean;
  reminderTimes: string[];
  createdAt: Timestamp | Date;
}

export interface Appointment {
  id?: string;
  userId: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone?: string;
  hospitalLocation?: {
    lat: number;
    lng: number;
  };
  doctorName: string;
  appointmentType: string;
  date: string;
  time: string;
  notes?: string;
  status: "scheduled" | "completed" | "cancelled";
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export const createUserProfile = async (
  uid: string,
  email: string,
  displayName?: string,
  photoURL?: string,
  additionalData?: Partial<UserProfile>,
) => {
  try {
    const userRef = doc(db, "users", uid);
    const userData: UserProfile = {
      uid,
      email,
      displayName: displayName || email.split("@")[0],
      photoURL,
      ...additionalData,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      preferences: {
        theme: "dark",
        notifications: true,
        emailNotifications: true,
        medicationReminders: true,
        appointmentReminders: true,
        ...additionalData?.preferences,
      },
    };

    await setDoc(userRef, userData);
    await createNotificationSettings(uid);
    return userData;
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw new Error("Failed to create user profile");
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error("Failed to update user profile");
  }
};

export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
  try {
    const storageRef = ref(storage, `profile-pictures/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    await updateUserProfile(userId, { photoURL: downloadURL });
    return downloadURL;
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    throw new Error("Failed to upload profile picture");
  }
};

export const createChatSession = async (userId: string, title: string) => {
  try {
    const chatRef = collection(db, "chatSessions");
    const chatData = {
      userId,
      title: title.slice(0, 100),
      messages: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(chatRef, chatData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating chat session:", error);
    throw new Error("Failed to create chat session");
  }
};

export const addMessageToSession = async (
  sessionId: string,
  userId: string,
  message: string,
  response: string,
  type: "chat" | "summarizer" = "chat",
) => {
  try {
    const sessionRef = doc(db, "chatSessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error("Session not found");
    }

    const sessionData = sessionSnap.data() as ChatSession;
    const newMessage: ChatMessage = {
      userId,
      message: message.slice(0, 1000),
      response: response.slice(0, 2000),
      type,
      timestamp: new Date(),
    };

    const updatedMessages = [...(sessionData.messages || []), newMessage];

    await updateDoc(sessionRef, {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
    });

    return newMessage;
  } catch (error) {
    console.error("Error adding message to session:", error);
    throw new Error("Failed to add message");
  }
};

export const updateChatSessionTitle = async (sessionId: string, title: string) => {
  try {
    const sessionRef = doc(db, "chatSessions", sessionId);
    await updateDoc(sessionRef, {
      title: title.slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating chat session title:", error);
    throw new Error("Failed to update chat session title");
  }
};

export const getUserChatSessions = async (userId: string): Promise<ChatSession[]> => {
  try {
    const chatsRef = collection(db, "chatSessions");
    const q = query(chatsRef, where("userId", "==", userId), limit(20));

    const querySnapshot = await getDocs(q);
    const sessions = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as ChatSession,
    );

    return sessions.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt as any)?.seconds * 1000 || 0;
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt as any)?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting chat sessions:", error);
    return [];
  }
};

export const getChatSessionById = async (sessionId: string) => {
  try {
    const docRef = doc(db, "chatSessions", sessionId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ChatSession;
    }
    return null;
  } catch (error) {
    console.error("Error getting chat session by ID:", error);
    throw new Error("Failed to get chat session");
  }
};

export const deleteChatSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, "chatSessions", sessionId);
    await deleteDoc(sessionRef);
  } catch (error) {
    console.error("Error deleting chat session:", error);
    throw new Error("Failed to delete chat session");
  }
};

export const subscribeToUserChatSessions = (
  userId: string,
  callback: (sessions: ChatSession[]) => void,
) => {
  try {
    const chatsRef = collection(db, "chatSessions");
    const q = query(chatsRef, where("userId", "==", userId), limit(20));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as ChatSession,
        )
        .sort((a, b) => {
          const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt as any)?.seconds * 1000 || 0;
          const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt as any)?.seconds * 1000 || 0;
          return bTime - aTime;
        });
      callback(sessions);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to chat sessions:", error);
    return () => {};
  }
};

export const analyzePrescription = async (
  userId: string,
  fileName: string,
  description: string,
): Promise<PrescriptionAnalysis> => {
  try {
    const analysis: Omit<PrescriptionAnalysis, "id"> = {
      userId,
      fileName,
      medications: ["Amoxicillin", "Ibuprofen", "Vitamin D3"],
      dosages: ["500mg twice daily", "200mg as needed", "1000 IU daily"],
      instructions: "Take Amoxicillin with food. Ibuprofen for pain relief only. Vitamin D3 with breakfast.",
      warnings: [
        "Do not take Ibuprofen on empty stomach",
        "Complete full course of Amoxicillin even if feeling better",
        "Avoid alcohol while taking Amoxicillin",
      ],
      createdAt: serverTimestamp() as Timestamp,
    };

    const analysisRef = collection(db, "prescriptionAnalyses");
    const docRef = await addDoc(analysisRef, analysis);

    return { id: docRef.id, ...analysis };
  } catch (error) {
    console.error("Error analyzing prescription:", error);
    throw new Error("Failed to analyze prescription");
  }
};

export const getUserPrescriptionAnalyses = async (userId: string): Promise<PrescriptionAnalysis[]> => {
  try {
    const analysesRef = collection(db, "prescriptionAnalyses");
    const q = query(analysesRef, where("userId", "==", userId), limit(20));

    const querySnapshot = await getDocs(q);
    const analyses = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as PrescriptionAnalysis,
    );

    return analyses.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.seconds * 1000 || 0;
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting prescription analyses:", error);
    return [];
  }
};

export const deletePrescriptionAnalysis = async (analysisId: string) => {
  try {
    const analysisRef = doc(db, "prescriptionAnalyses", analysisId);
    await deleteDoc(analysisRef);
  } catch (error) {
    console.error("Error deleting prescription analysis:", error);
    throw new Error("Failed to delete prescription analysis");
  }
};

export const addMedication = async (
  userId: string,
  medication: Omit<Medication, "id" | "userId" | "createdAt" | "updatedAt">,
) => {
  try {
    const medicationRef = collection(db, "medications");
    const medicationData: Omit<Medication, "id"> = {
      userId,
      ...medication,
      isActive: true,
      enableWhatsApp: medication.enableWhatsApp || false,
      phoneNumber: medication.enableWhatsApp ? medication.phoneNumber : undefined,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(medicationRef, medicationData);

    if (medication.reminderTimes.length) {
      await scheduleMedicationReminders(userId, docRef.id, medication.reminderTimes, medication.enableWhatsApp, medication.phoneNumber);
    }

    return docRef.id;
  } catch (error) {
    console.error("Error adding medication:", error);
    throw new Error("Failed to add medication");
  }
};

export const updateMedication = async (medicationId: string, data: Partial<Medication>) => {
  try {
    const docRef = doc(db, "medications", medicationId);
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value === null ? null : value;
      }
    }
    updateData.updatedAt = serverTimestamp();
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error("Error updating medication:", error);
    throw new Error("Failed to update medication");
  }
};

export const deleteMedication = async (medicationId: string) => {
  try {
    const medicationRef = doc(db, "medications", medicationId);
    await deleteDoc(medicationRef);

    const remindersRef = collection(db, "medicationReminders");
    const q = query(remindersRef, where("medicationId", "==", medicationId));
    const querySnapshot = await getDocs(q);
    for (const doc of querySnapshot.docs) {
      await deleteDoc(doc.ref);
    }
  } catch (error) {
    console.error("Error deleting medication:", error);
    throw new Error("Failed to delete medication");
  }
};

export const getUserMedications = async (userId: string): Promise<Medication[]> => {
  try {
    const medicationsRef = collection(db, "medications");
    const q = query(medicationsRef, where("userId", "==", userId), limit(50));

    const querySnapshot = await getDocs(q);
    const medications = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Medication,
    );

    return medications.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt as any)?.seconds * 1000 || 0;
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt as any)?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting medications:", error);
    return [];
  }
};

export const scheduleMedicationReminders = async (
  userId: string,
  medicationId: string,
  reminderTimes: string[],
  enableWhatsApp?: boolean,
  phoneNumber?: string,
) => {
  try {
    const remindersRef = collection(db, "medicationReminders");
    for (const time of reminderTimes) {
      const reminderData = {
        userId,
        medicationId,
        time,
        enableWhatsApp: enableWhatsApp || false,
        phoneNumber: enableWhatsApp ? phoneNumber : null,
        createdAt: serverTimestamp(),
      };
      await addDoc(remindersRef, reminderData);
    }
  } catch (error) {
    console.error("Error scheduling medication reminders:", error);
    throw new Error("Failed to schedule medication reminders");
  }
};

export const addHealthRecord = async (
  userId: string,
  record: Omit<HealthRecord, "id" | "userId" | "createdAt">,
) => {
  try {
    const recordsRef = collection(db, "healthRecords");
    const recordData: Omit<HealthRecord, "id"> = {
      userId,
      ...record,
      createdAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(recordsRef, recordData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding health record:", error);
    throw new Error("Failed to add health record");
  }
};
export const sendMedicationReminder = () => {
  // TODO: Implement sendMedicationReminder
  throw new Error("sendMedicationReminder not implemented");
};
export const subscribeToUserMedications = (
  userId: string,
  callback: (medications: Medication[]) => void,
) => {
  try {
    const medicationsRef = collection(db, "medications");
    const q = query(medicationsRef, where("userId", "==", userId), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const medications = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Medication,
        )
        .sort((a, b) => {
          const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt as any)?.seconds * 1000 || 0;
          const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt as any)?.seconds * 1000 || 0;
          return bTime - aTime;
        });
      callback(medications);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to medications:", error);
    return () => {};
  }
};
// TODO: Implement getUserSummaries
export const getUserSummaries = () => {
  throw new Error("getUserSummaries not implemented");
};
// TODO: Implement addSummaryRequest
export const addSummaryRequest = () => {
  throw new Error("addSummaryRequest not implemented");
};


export const getUserHealthRecords = async (userId: string): Promise<HealthRecord[]> => {
  try {
    const recordsRef = collection(db, "healthRecords");
    const q = query(recordsRef, where("userId", "==", userId), limit(50));

    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as HealthRecord,
    );

    return records.sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting health records:", error);
    return [];
  }
};

export const updateHealthRecord = async (recordId: string, data: Partial<HealthRecord>) => {
  try {
    const docRef = doc(db, "healthRecords", recordId);
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value === null ? null : value;
      }
    }
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error("Error updating health record:", error);
    throw new Error("Failed to update health record");
  }
};

export const deleteHealthRecord = async (recordId: string) => {
  try {
    const recordRef = doc(db, "healthRecords", recordId);
    await deleteDoc(recordRef);
  } catch (error) {
    console.error("Error deleting health record:", error);
    throw new Error("Failed to delete health record");
  }
};

export const createSummaryRequest = async (
  userId: string,
  request: Omit<SummaryRequest, "id" | "userId" | "createdAt">,
) => {
  try {
    const summariesRef = collection(db, "summaryRequests");
    const summaryData: Omit<SummaryRequest, "id"> = {
      userId,
      ...request,
      createdAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(summariesRef, summaryData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating summary request:", error);
    throw new Error("Failed to create summary request");
  }
};

export const getUserSummaryRequests = async (userId: string): Promise<SummaryRequest[]> => {
  try {
    const summariesRef = collection(db, "summaryRequests");
    const q = query(summariesRef, where("userId", "==", userId), limit(50));

    const querySnapshot = await getDocs(q);
    const summaries = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as SummaryRequest,
    );

    return summaries.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.seconds * 1000 || 0;
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting summary requests:", error);
    return [];
  }
};

export const deleteSummaryRequest = async (summaryId: string) => {
  try {
    const summaryRef = doc(db, "summaryRequests", summaryId);
    await deleteDoc(summaryRef);
  } catch (error) {
    console.error("Error deleting summary request:", error);
    throw new Error("Failed to delete summary request");
  }
};

export const createNotificationSettings = async (userId: string) => {
  try {
    const settingsRef = doc(db, "notificationSettings", userId);
    const settingsData: NotificationSettings = {
      userId,
      emailNotifications: true,
      pushNotifications: true,
      medicationReminders: true,
      appointmentReminders: true,
      reminderTimes: ["09:00", "13:00", "18:00"],
      createdAt: serverTimestamp() as Timestamp,
    };

    await setDoc(settingsRef, settingsData);
    return settingsData;
  } catch (error) {
    console.error("Error creating notification settings:", error);
    throw new Error("Failed to create notification settings");
  }
};

export const getNotificationSettings = async (userId: string): Promise<NotificationSettings | null> => {
  try {
    const settingsRef = doc(db, "notificationSettings", userId);
    const settingsSnap = await getDoc(settingsRef);

    if (settingsSnap.exists()) {
      return settingsSnap.data() as NotificationSettings;
    }
    return null;
  } catch (error) {
    console.error("Error getting notification settings:", error);
    return null;
  }
};

export const updateNotificationSettings = async (userId: string, data: Partial<NotificationSettings>) => {
  try {
    const settingsRef = doc(db, "notificationSettings", userId);
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value === null ? null : value;
      }
    }
    await updateDoc(settingsRef, updateData);
  } catch (error) {
    console.error("Error updating notification settings:", error);
    throw new Error("Failed to update notification settings");
  }
};

export const addAppointment = async (
  userId: string,
  appointment: Omit<Appointment, "id" | "userId" | "createdAt" | "updatedAt">,
) => {
  try {
    const appointmentsRef = collection(db, "appointments");
    const appointmentData: Omit<Appointment, "id"> = {
      userId,
      ...appointment,
      status: appointment.status || "scheduled",
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(appointmentsRef, appointmentData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding appointment:", error);
    throw new Error("Failed to add appointment");
  }
};

export const getUserAppointments = async (userId: string): Promise<Appointment[]> => {
  try {
    const appointmentsRef = collection(db, "appointments");
    const q = query(appointmentsRef, where("userId", "==", userId), limit(50));

    const querySnapshot = await getDocs(q);
    const appointments = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Appointment,
    );

    return appointments.sort((a, b) => {
      const aTime = new Date(`${a.date} ${a.time}`).getTime();
      const bTime = new Date(`${b.date} ${b.time}`).getTime();
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting appointments:", error);
    return [];
  }
};

export const updateAppointment = async (appointmentId: string, data: Partial<Appointment>) => {
  try {
    const docRef = doc(db, "appointments", appointmentId);
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value === null ? null : value;
      }
    }
    updateData.updatedAt = serverTimestamp();
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw new Error("Failed to update appointment");
  }
};

export const deleteAppointment = async (appointmentId: string) => {
  try {
    const appointmentRef = doc(db, "appointments", appointmentId);
    await deleteDoc(appointmentRef);
  } catch (error) {
    console.error("Error deleting appointment:", error);
    throw new Error("Failed to delete appointment");
  }
};

export const subscribeToUserAppointments = (
  userId: string,
  callback: (appointments: Appointment[]) => void,
) => {
  try {
    const appointmentsRef = collection(db, "appointments");
    const q = query(appointmentsRef, where("userId", "==", userId), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appointments = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Appointment,
        )
        .sort((a, b) => {
          const aTime = new Date(`${a.date} ${a.time}`).getTime();
          const bTime = new Date(`${b.date} ${b.time}`).getTime();
          return bTime - aTime;
        });
      callback(appointments);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to appointments:", error);
    return () => {};
  }
};

export const uploadHealthRecordAttachment = async (userId: string, recordId: string, file: File): Promise<string> => {
  try {
    const storageRef = ref(storage, `healthRecords/${userId}/${recordId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    const recordRef = doc(db, "healthRecords", recordId);
    const recordSnap = await getDoc(recordRef);
    if (recordSnap.exists()) {
      const recordData = recordSnap.data() as HealthRecord;
      const updatedAttachments = [...(recordData.attachments || []), downloadURL];
      await updateDoc(recordRef, { attachments: updatedAttachments });
    }

    return downloadURL;
  } catch (error) {
    console.error("Error uploading health record attachment:", error);
    throw new Error("Failed to upload health record attachment");
  }
};
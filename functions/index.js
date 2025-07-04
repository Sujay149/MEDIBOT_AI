const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();

const resend = new Resend(functions.config().resend.api_key);

// Helper function to generate a token and store it
async function generateAndStoreToken(appointmentId, action) {
  const token = uuidv4();
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  );

  await admin.firestore().collection("appointmentTokens").add({
    appointmentId,
    action,
    token,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    used: false,
  });

  return token;
}

// On Appointment Creation: Send confirmation to user and review request to admin
exports.sendAppointmentConfirmationAndReview = functions.firestore
  .document("appointments/{appointmentId}")
  .onCreate(async (snap, context) => {
    const appointment = snap.data();
    const { userId, hospitalName, doctorName, date, time, appointmentType, hospitalAddress } = appointment;
    const appointmentId = context.params.appointmentId;

    // Fetch user email from Firestore
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("User not found:", userId);
      return null;
    }
    const user = userDoc.data();
    const userEmail = user.email;

    // Generate tokens for approve and reject actions
    const approveToken = await generateAndStoreToken(appointmentId, "approve");
    const rejectToken = await generateAndStoreToken(appointmentId, "reject");

    // Base URL for HTTP functions (replace with your Firebase Functions URL)
    const baseUrl = "https://us-central1-medibot-457514.cloudfunctions.net";

    // User confirmation email
    const userEmailData = {
      from: "MediBot <no-reply@your-domain.com>", // Replace with your Resend-verified domain
      to: [userEmail],
      subject: "Your Appointment Request is Pending",
      text: `Dear ${user.displayName || "User"},\n\nYour appointment with Dr. ${doctorName} at ${hospitalName} on ${date} at ${time} has been successfully submitted and is pending approval. You will receive another email once it is reviewed.\n\nBest regards,\nMediBot Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Appointment Request Submitted</h2>
          <p>Dear ${user.displayName || "User"},</p>
          <p>Your appointment with Dr. ${doctorName} at ${hospitalName} on ${date} at ${time} has been successfully submitted and is pending approval. You will receive another email once it is reviewed.</p>
          <p>Best regards,<br>MediBot Team</p>
        </div>
      `,
    };

    // Admin review request email with approve/reject links
    const adminEmailData = {
      from: "MediBot <no-reply@your-domain.com>", // Replace with your Resend-verified domain
      to: ["sujayss762@gmail.com"],
      subject: "New Appointment Request for Review",
      text: `Dear Admin,\n\nA new appointment request has been submitted:\n\n- User: ${user.displayName || user.email}\n- Hospital: ${hospitalName}\n- Address: ${hospitalAddress}\n- Doctor: Dr. ${doctorName}\n- Type: ${appointmentType}\n- Date: ${date}\n- Time: ${time}\n\nPlease review and take action:\n- Approve: ${baseUrl}/approveAppointment?token=${approveToken}\n- Reject: ${baseUrl}/rejectAppointment?token=${rejectToken}\n\nThese links expire in 24 hours.\n\nBest regards,\nMediBot Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>New Appointment Request</h2>
          <p>Dear Admin,</p>
          <p>A new appointment request has been submitted:</p>
          <ul>
            <li><strong>User:</strong> ${user.displayName || user.email}</li>
            <li><strong>Hospital:</strong> ${hospitalName}</li>
            <li><strong>Address:</strong> ${hospitalAddress}</li>
            <li><strong>Doctor:</strong> Dr. ${doctorName}</li>
            <li><strong>Type:</strong> ${appointmentType}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Time:</strong> ${time}</li>
          </ul>
          <p>Please review and take action:</p>
          <div style="margin: 20px 0;">
            <a href="${baseUrl}/approveAppointment?token=${approveToken}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve</a>
            <a href="${baseUrl}/rejectAppointment?token=${rejectToken}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject</a>
          </div>
          <p><em>These links expire in 24 hours.</em></p>
          <p>Best regards,<br>MediBot Team</p>
        </div>
      `,
    };

    try {
      // Send user confirmation email
      await resend.emails.send(userEmailData);
      console.log(`Confirmation email sent to ${userEmail} for appointment ${appointmentId}`);

      // Send admin review request email
      await resend.emails.send(adminEmailData);
      console.log(`Review request email sent to sujayss762@gmail.com for appointment ${appointmentId}`);
    } catch (error) {
      console.error("Error sending email:", error);
    }

    return null;
  });

// On Appointment Update: Send status update to user
exports.sendAppointmentStatusEmail = functions.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    const { userId, hospitalName, doctorName, date, time, status } = newData;

    // Only send email if the status has changed
    if (previousData.status === newData.status) {
      return null;
    }

    // Only send email for approved or rejected statuses
    if (!["approved", "rejected"].includes(status)) {
      return null;
    }

    // Fetch user email from Firestore
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("User not found:", userId);
      return null;
    }
    const user = userDoc.data();
    const email = user.email;

    // Prepare email content based on status
    let subject, text, html;
    switch (status) {
      case "approved":
        subject = "Your Appointment Has Been Approved";
        text = `Dear ${user.displayName || "User"},\n\nYour appointment with Dr. ${doctorName} at ${hospitalName} on ${date} at ${time} has been approved.\n\nBest regards,\nMediBot Team`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Appointment Approved</h2>
            <p>Dear ${user.displayName || "User"},</p>
            <p>Your appointment with Dr. ${doctorName} at ${hospitalName} on ${date} at ${time} has been approved.</p>
            <p>Best regards,<br>MediBot Team</p>
          </div>
        `;
        break;
      case "rejected":
        subject = "Your Appointment Has Been Rejected";
        text = `Dear ${user.displayName || "User"},\n\nUnfortunately, your appointment with Dr. ${doctorName} at ${hospitalName} on ${date} at ${time} has been rejected. Please contact the hospital for more details or book another appointment.\n\nBest regards,\nMediBot Team`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Appointment Rejected</h2>
            <p>Dear ${user.displayName || "User"},</p>
            <p>Unfortunately, your appointment with Dr. ${doctorName} at ${hospitalName} on ${date} at ${time} has been rejected. Please contact the hospital for more details or book another appointment.</p>
            <p>Best regards,<br>MediBot Team</p>
          </div>
        `;
        break;
      default:
        return null;
    }

    const emailData = {
      from: "MediBot <no-reply@your-domain.com>", // Replace with your Resend-verified domain
      to: [email],
      subject,
      text,
      html,
    };

    try {
      await resend.emails.send(emailData);
      console.log(`Email sent to ${email} for appointment ${context.params.appointmentId} with status ${status}`);
    } catch (error) {
      console.error("Error sending email:", error);
    }

    return null;
  });

// HTTP Function to Approve Appointment
exports.approveAppointment = functions.https.onRequest(async (req, res) => {
  const token = req.query.token;

  if (!token) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #f44336; }
          </style>
        </head>
        <body>
          <h1>Error</h1>
          <p>Missing token</p>
        </body>
      </html>
    `);
    return;
  }

  try {
    // Find the token in Firestore
    const tokenQuery = await admin.firestore()
      .collection("appointmentTokens")
      .where("token", "==", token)
      .where("action", "==", "approve")
      .where("used", "==", false)
      .get();

    if (tokenQuery.empty) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <h1>Error</h1>
            <p>Invalid or used token</p>
          </body>
        </html>
      `);
      return;
    }

    const tokenDoc = tokenQuery.docs[0];
    const tokenData = tokenDoc.data();
    const { appointmentId, expiresAt } = tokenData;

    // Check if token is expired
    const now = new Date();
    if (expiresAt.toDate() < now) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <h1>Error</h1>
            <p>Token expired</p>
          </body>
        </html>
      `);
      return;
    }

    // Update appointment status
    await admin.firestore().collection("appointments").doc(appointmentId).update({
      status: "approved",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark token as used
    await tokenDoc.ref.update({ used: true });

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Appointment Approved</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #4CAF50; }
          </style>
        </head>
        <body>
          <h1>Appointment Approved Successfully</h1>
          <p>The appointment status has been updated.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error approving appointment:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #f44336; }
          </style>
        </head>
        <body>
          <h1>Error</h1>
          <p>Internal server error</p>
        </body>
      </html>
    `);
  }
});

// HTTP Function to Reject Appointment
exports.rejectAppointment = functions.https.onRequest(async (req, res) => {
  const token = req.query.token;

  if (!token) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #f44336; }
          </style>
        </head>
        <body>
          <h1>Error</h1>
          <p>Missing token</p>
        </body>
      </html>
    `);
    return;
  }

  try {
    // Find the token in Firestore
    const tokenQuery = await admin.firestore()
      .collection("appointmentTokens")
      .where("token", "==", token)
      .where("action", "==", "reject")
      .where("used", "==", false)
      .get();

    if (tokenQuery.empty) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <h1>Error</h1>
            <p>Invalid or used token</p>
          </body>
        </html>
      `);
      return;
    }

    const tokenDoc = tokenQuery.docs[0];
    const tokenData = tokenDoc.data();
    const { appointmentId, expiresAt } = tokenData;

    // Check if token is expired
    const now = new Date();
    if (expiresAt.toDate() < now) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <h1>Error</h1>
            <p>Token expired</p>
          </body>
        </html>
      `);
      return;
    }

    // Update appointment status
    await admin.firestore().collection("appointments").doc(appointmentId).update({
      status: "rejected",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark token as used
    await tokenDoc.ref.update({ used: true });

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Appointment Rejected</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #f44336; }
          </style>
        </head>
        <body>
          <h1>Appointment Rejected Successfully</h1>
          <p>The appointment status has been updated.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error rejecting appointment:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #f44336; }
          </style>
        </head>
        <body>
          <h1>Error</h1>
          <p>Internal server error</p>
        </body>
      </html>
    `);
  }
});
import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userEmail, appointment } = req.body;

  if (!userEmail || !appointment) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Configure Nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email service
    auth: {
      user: process.env.EMAIL_USER, // Your email address
      pass: process.env.EMAIL_PASS, // Your email password or app-specific password
    },
  });

  // Email content
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: `Appointment Confirmation - ${appointment.hospitalName}`,
    html: `
      <h2>Appointment Confirmation</h2>
      <p>Dear Patient,</p>
      <p>Your appointment has been successfully booked with the following details:</p>
      <ul>
        <li><strong>Hospital:</strong> ${appointment.hospitalName}</li>
        <li><strong>Doctor:</strong> ${appointment.doctorName}</li>
        <li><strong>Date:</strong> ${appointment.date}</li>
        <li><strong>Time:</strong> ${appointment.time}</li>
        <li><strong>Notes:</strong> ${appointment.notes}</li>
      </ul>
      <p>Thank you for using our service!</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ message: 'Failed to send email' });
  }
}
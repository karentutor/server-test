//server/utils/sendEmail.js
import sgMail from "@sendgrid/mail";

const sendEmail = async (options) => {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const message = {
    from: {
      name: process.env.FROM_NAME,   // e.g. "Acme Corp"
      email: process.env.FROM_EMAIL, // e.g. "no-reply@yourdomain.com"
    },
    to: options.email,               // recipient
    subject: options.subject,
    html: options.message,
  };

  try {
    await sgMail.send(message);
    console.log("Email sent successfully via SendGrid");
  } catch (error) {
    console.error("SendGrid error:", error);
    throw new Error("Failed to send email via SendGrid");
  }
};

export default sendEmail;

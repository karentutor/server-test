// services/emailService.js

import sendEmail from "../utils/sendEmail.js";
import ContactMessage from "../models/ContactMessage.js";

// Keep your existing regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Simple utility to validate the required fields and email format.
 * Now, senderEmail, senderFirstName, and senderLastName are OPTIONAL.
 */
function validateEmailPayload({
  email,
  subject,
  message,
  senderEmail,
  senderFirstName,
  senderLastName,
}) {
  // Check for the absolutely required fields
  if (!email || !subject || !message) {
    throw new Error("Required fields: email, subject, message");
  }

  // Validate primary recipient email format
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email address.");
  }

  // If a senderEmail is provided, validate it. (Optional)
  if (senderEmail && !emailRegex.test(senderEmail)) {
    throw new Error("Invalid senderEmail address.");
  }

  // If you want to require names only if senderEmail is present, you could do so,
  // but currently they're optional as well. Hence, no extra checks here.
}

/**
 * Build an HTML snippet for the email's body
 */
function buildEmailContent({
  senderEmail,
  senderFirstName,
  senderLastName,
  message,
}) {
  // If you want to include the optional fields, you can conditionally show them:
  let fromSection = "";
  if (senderEmail || senderFirstName || senderLastName) {
    fromSection = `
      <p><strong>From:</strong> ${senderEmail || "N/A"}</p>
      <p><strong>Name:</strong> ${senderFirstName || ""} ${senderLastName || ""}</p>
      <hr />
    `;
  }

  return `
    <div>
      ${fromSection}
      <p>${message}</p>
      <hr />
      <p>This email is courtesy of the Oxsaid App.</p>
    </div>
  `;
}

/**
 * Service method: just sends an email (no DB save).
 */
export async function sendEmailService(payload) {
  // 1) Validate (sender info is optional now)
  validateEmailPayload(payload);

  // 2) Construct HTML
  const emailContent = buildEmailContent(payload);

  // 3) Send email via your sendEmail utility (e.g., SendGrid)
  await sendEmail({
    email: payload.email,
    subject: payload.subject,
    message: emailContent,
  });

  // Return something if needed, or just success
  return true;
}

/**
 * Service method: send email AND save to DB.
 */
export async function saveEmailService(payload) {
  // 1) Validate (sender info is optional)
  validateEmailPayload(payload);

  // 2) Build HTML
  const emailContent = buildEmailContent(payload);

  // 3) Send email
  await sendEmail({
    email: payload.email,
    subject: payload.subject,
    message: emailContent,
  });

  // 4) Save to DB (if you still want to store any provided sender info, do so)
  const savedMessage = await ContactMessage.create({
    email: payload.email,
    subject: payload.subject,
    message: payload.message,
    senderEmail: payload.senderEmail || "",
    senderFirstName: payload.senderFirstName || "",
    senderLastName: payload.senderLastName || "",
  });

  return savedMessage;
}

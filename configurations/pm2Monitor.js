import pm2 from "pm2";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const ERROR_LOGGING = process.env.ERROR_LOGGING === "true"; // Convert string to boolean
let lastAlertTime = 0;
const ALERT_COOLDOWN = 60 * 60 * 1000; // 1 hour in milliseconds

export const monitorPM2Logs = () => {
  if (!ERROR_LOGGING) {
    console.log("⚠️ PM2 Error Monitoring is DISABLED.");
    return; // Exit if logging is turned off
  }

  console.log("✅ PM2 Error Monitoring is ENABLED.");

  pm2.launchBus((err, bus) => {
    if (err) {
      console.error("❌ PM2 Event Bus Error:", err);
      return;
    }

    bus.on("log:err", async (log) => {
      if (log.data.includes("500")) {
        console.error("🚨 500 Error Detected in PM2 logs:", log.data);

        const now = Date.now();
        if (now - lastAlertTime < ALERT_COOLDOWN) {
          console.log("⏳ Alert suppressed (Rate-limited, waiting for cooldown).");
          return;
        }

        lastAlertTime = now;

        const msg = {
          to: process.env.ALERT_EMAIL,
          from: process.env.FROM_EMAIL,
          subject: "🚨 500 Error Detected in PM2 Logs",
          text: `A 500 error occurred: ${log.data}`,
        };

        try {
          await sgMail.send(msg);
          console.log("📩 PM2 Error Alert Sent!");
        } catch (emailErr) {
          console.error("❌ Error sending email:", emailErr);
        }
      }
    });
  });
};

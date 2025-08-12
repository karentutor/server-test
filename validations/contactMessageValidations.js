// server/validations/contactMessageValidations.js
// server/validations/contactMessageValidations.js
import { body } from "express-validator";

export const contactMessageValidationRules = [
  body("subject")
    .notEmpty()
    .withMessage("Subject is required"),
  body("message")
    .notEmpty()
    .withMessage("Message is required"),
  body("senderEmail")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
  body("senderFirstName")
    .notEmpty()
    .withMessage("First name is required"),
  body("senderLastName")
    .notEmpty()
    .withMessage("Last name is required"),
];

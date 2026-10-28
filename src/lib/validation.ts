import { z } from "zod";
import { passwordProblem } from "./password";
import { EMPLOYMENT_TYPES, ENQUIRY_CATEGORIES } from "./status";

const categories = Object.keys(ENQUIRY_CATEGORIES) as [string, ...string[]];

export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100, "Name is too long."),
  company: z.string().trim().max(150, "Company name is too long.").optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{7,16}$/, "Enter a valid phone number, for example +91 98765 43210.")
    .optional()
    .or(z.literal("")),
  category: z.enum(categories, { message: "Choose what your enquiry is about." }),
  message: z.string().trim().min(15, "Describe your requirement in at least 15 characters.").max(3000, "Keep the message under 3000 characters."),
  consent: z.literal("on", { message: "Please accept the privacy notice to continue." }),
  website: z.string().max(0).optional(), // honeypot: real users never fill this
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,16}$/, "Enter a valid phone number, for example +91 98765 43210.");

export const applySchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  phone,
  password: z.string().max(200).superRefine((v, ctx) => {
    const p = passwordProblem(v);
    if (p) ctx.addIssue({ code: "custom", message: p });
  }),
  coverNote: z.string().trim().max(1500, "Keep the note under 1500 characters.").optional().or(z.literal("")),
  consent: z.literal("on", { message: "Please accept the privacy notice to continue." }),
  website: z.string().max(0).optional(),
});

export const profileSchema = z.object({
  phone,
  city: z.string().trim().max(80).optional().or(z.literal("")),
  qualification: z.string().trim().max(150).optional().or(z.literal("")),
  experienceYears: z.coerce.number().int("Enter whole years.").min(0).max(60).optional().or(z.literal("").transform(() => undefined)),
  summary: z.string().trim().max(1500, "Keep the summary under 1500 characters.").optional().or(z.literal("")),
  coverNote: z.string().trim().max(1500).optional().or(z.literal("")),
});

export const vacancySchema = z.object({
  title: z.string().trim().min(4, "Enter a job title.").max(120),
  department: z.string().trim().max(80).optional().or(z.literal("")),
  location: z.string().trim().min(2, "Enter a location.").max(120),
  employmentType: z.enum(Object.keys(EMPLOYMENT_TYPES) as [string, ...string[]], { message: "Choose an employment type." }),
  description: z.string().trim().min(30, "Describe the role in at least 30 characters.").max(5000),
  eligibility: z.string().trim().min(10, "List the eligibility criteria.").max(3000),
  closesAt: z.string().optional().or(z.literal("")),
});

/** Readable one-line summary of the first validation problem (used by flash-message forms). */
export function firstError(error: z.ZodError): string {
  const i = error.issues[0];
  return i ? i.message : "Please check the form.";
}

export const convertSchema = z.object({
  department: z.string().trim().min(2, "Enter the department.").max(80),
  jobTitle: z.string().trim().min(2, "Enter the job title.").max(100),
  employmentType: z.enum(Object.keys(EMPLOYMENT_TYPES) as [string, ...string[]], { message: "Choose an employment type." }),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the joining date."),
});

export const employeeDetailsSchema = z.object({
  addressLine: z.string().trim().min(8, "Enter your full current address.").max(300),
  emergencyName: z.string().trim().min(2, "Enter the emergency contact's name.").max(100),
  emergencyRelation: z.string().trim().min(2, "Enter their relationship to you.").max(50),
  emergencyPhone: phone,
});

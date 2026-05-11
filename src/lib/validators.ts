import { z } from "zod";

const phoneRegex = /^\+?[0-9]{10,15}$/;

export const bookingFormSchema = z.object({
  firstName: z.string().min(1, "required"),
  lastName: z.string().optional(),
  phone: z.string().regex(phoneRegex, "invalidPhone"),
  email: z.string().email("invalidEmail").optional().or(z.literal("")),
  notes: z.string().optional(),
  date: z.string().min(1, "required"),
  time: z.string().min(1, "required"),
  consentGiven: z.literal(true, { message: "consentRequired" }),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

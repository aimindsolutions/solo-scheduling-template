import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalizes Ukrainian phone numbers to +380XXXXXXXXX format.
// Handles: +380..., 380..., 0XXXXXXXXX (10-digit local), bare 9-digit.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("380") && digits.length === 12) return "+" + digits;
  if (digits.startsWith("38") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+38" + digits;
  if (digits.length === 9) return "+380" + digits;
  const stripped = raw.replace(/[^\d+]/g, "");
  return stripped.startsWith("+") ? stripped : "+" + stripped;
}

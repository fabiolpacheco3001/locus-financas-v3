import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Helper para valores de Select do Radix UI.
 * Retorna undefined se o valor for null, undefined ou string vazia.
 * Isso evita o erro: "SelectItem must have a value prop that is not an empty string"
 */
export function safeSelectValue(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return value;
}

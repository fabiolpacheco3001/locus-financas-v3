export interface CreditCard {
  id: string;
  household_id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color: string;
  brand?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'debit' | 'credit_card' | 'cash' | 'pix' | 'boleto';

export const CARD_BRANDS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'other', label: 'Outro' },
] as const;

export const CARD_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#1e293b', // Slate dark
] as const;

/**
 * Calculate which invoice month a purchase belongs to based on closing day
 * @param purchaseDate - The date of the purchase
 * @param closingDay - The day of month when the invoice closes (1-31)
 * @returns The invoice month in YYYY-MM format
 */
export function calculateInvoiceMonth(purchaseDate: Date, closingDay: number): string {
  const day = purchaseDate.getDate();
  let invoiceMonth = new Date(purchaseDate);
  
  // If purchase is on or after closing day, it goes to next month's invoice
  if (day >= closingDay) {
    invoiceMonth.setMonth(invoiceMonth.getMonth() + 1);
  }
  
  const year = invoiceMonth.getFullYear();
  const month = String(invoiceMonth.getMonth() + 1).padStart(2, '0');
  
  return `${year}-${month}`;
}

/**
 * Get the due date for an invoice based on the invoice month and due day
 * @param invoiceMonth - The invoice month in YYYY-MM format
 * @param dueDay - The day of month when the invoice is due (1-31)
 * @returns The due date as a Date object
 */
export function getInvoiceDueDate(invoiceMonth: string, dueDay: number): Date {
  const [year, month] = invoiceMonth.split('-').map(Number);
  
  // Due date is in the month after the invoice month
  const dueDate = new Date(year, month, dueDay); // month is 0-indexed, so this is already +1
  
  // Handle months with fewer days
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  if (dueDay > lastDayOfMonth) {
    dueDate.setDate(lastDayOfMonth);
  }
  
  return dueDate;
}

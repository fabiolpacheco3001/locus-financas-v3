/**
 * Open Finance Types
 * 
 * Types for Open Finance integration (Pluggy/Belvo style)
 * Supporting the consent flow and data synchronization
 */

// ============================================
// BANK & INSTITUTION TYPES
// ============================================

export interface Bank {
  id: string;
  name: string;
  logo: string;
  primaryColor: string;
  /** Whether the bank supports Open Finance */
  isOpenFinanceEnabled: boolean;
  /** Connection type */
  connectionType: 'oauth' | 'credentials';
}

// ============================================
// CONSENT TYPES
// ============================================

export type ConsentPermission = 
  | 'ACCOUNTS_READ'
  | 'BALANCES_READ'
  | 'TRANSACTIONS_READ'
  | 'CREDIT_CARDS_READ'
  | 'INVESTMENTS_READ';

export interface ConsentRequest {
  /** Permissions being requested */
  permissions: ConsentPermission[];
  /** Duration in days */
  expirationDays: number;
  /** Whether user accepted privacy terms */
  privacyAccepted: boolean;
  /** Whether user wants to receive sync notifications */
  notificationsEnabled: boolean;
}

export interface ConsentState {
  step: 1 | 2 | 3 | 'success' | 'error';
  selectedBank: Bank | null;
  permissions: ConsentPermission[];
  privacyAccepted: boolean;
  notificationsEnabled: boolean;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// CONNECTION TYPES
// ============================================

export type ConnectionStatus = 
  | 'pending'      // Waiting for bank authorization
  | 'authorized'   // Bank authorized, syncing
  | 'active'       // Fully synced and active
  | 'expired'      // Consent expired
  | 'revoked'      // User revoked access
  | 'error';       // Connection error

export interface OpenFinanceConnection {
  id: string;
  household_id: string;
  bank_id: string;
  bank_name: string;
  bank_logo: string;
  status: ConnectionStatus;
  permissions: ConsentPermission[];
  /** Last successful sync */
  last_sync_at: string | null;
  /** When consent expires */
  expires_at: string;
  /** External provider connection ID */
  external_connection_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface WebhookPayload {
  event: 'connection.authorized' | 'connection.synced' | 'connection.revoked' | 'connection.error';
  connection_id: string;
  external_connection_id: string;
  timestamp: string;
  data?: {
    accounts_count?: number;
    transactions_count?: number;
    error_message?: string;
  };
}

// ============================================
// MOCK DATA
// ============================================

export const MOCK_BANKS: Bank[] = [
  {
    id: 'bb',
    name: 'Banco do Brasil',
    logo: '🏛️',
    primaryColor: '#FFCC00',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
  {
    id: 'itau',
    name: 'Itaú Unibanco',
    logo: '🏦',
    primaryColor: '#EC7000',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
  {
    id: 'bradesco',
    name: 'Bradesco',
    logo: '🔴',
    primaryColor: '#CC092F',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
  {
    id: 'santander',
    name: 'Santander',
    logo: '🔶',
    primaryColor: '#EC0000',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
  {
    id: 'nubank',
    name: 'Nubank',
    logo: '💜',
    primaryColor: '#820AD1',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
  {
    id: 'inter',
    name: 'Banco Inter',
    logo: '🟠',
    primaryColor: '#FF7A00',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
  {
    id: 'c6',
    name: 'C6 Bank',
    logo: '⬛',
    primaryColor: '#242424',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
  {
    id: 'caixa',
    name: 'Caixa Econômica',
    logo: '🔵',
    primaryColor: '#005CA9',
    isOpenFinanceEnabled: true,
    connectionType: 'oauth',
  },
];

export const DEFAULT_PERMISSIONS: ConsentPermission[] = [
  'ACCOUNTS_READ',
  'BALANCES_READ',
  'TRANSACTIONS_READ',
];

export const ALL_PERMISSIONS: ConsentPermission[] = [
  'ACCOUNTS_READ',
  'BALANCES_READ',
  'TRANSACTIONS_READ',
  'CREDIT_CARDS_READ',
  'INVESTMENTS_READ',
];

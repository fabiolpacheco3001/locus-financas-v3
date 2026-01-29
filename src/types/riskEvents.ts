export type RiskEventType = 
  | 'MONTH_AT_RISK'      // Saldo previsto < 0
  | 'PAYMENT_DELAYED'    // Despesa planned passou do vencimento
  | 'RISK_REDUCED'       // Simulação/ação levou vermelho → verde
  | 'MONTH_RECOVERED';   // Saldo previsto voltou a ≥ 0

export interface RiskEvent {
  id: string;
  household_id: string;
  event_type: RiskEventType;
  reference_month: string; // YYYY-MM
  reference_id: string | null;
  reference_type: 'transaction' | 'account' | 'simulation' | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RiskEventMetadata {
  // MONTH_AT_RISK / MONTH_RECOVERED
  projected_balance?: number;
  previous_balance?: number;
  
  // PAYMENT_DELAYED
  transaction_description?: string;
  days_overdue?: number;
  amount?: number;
  due_date?: string;
  
  // RISK_REDUCED
  action_type?: 'confirm' | 'cancel' | 'simulation' | 'edit';
  balance_before?: number;
  balance_after?: number;
}

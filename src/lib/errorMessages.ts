// Friendly error messages for common database errors

type ErrorPattern = {
  pattern: RegExp | string;
  message: string;
};

const errorPatterns: ErrorPattern[] = [
  // ========================================
  // Authentication errors
  // ========================================
  {
    pattern: /Invalid login credentials/i,
    message: 'Email ou senha incorretos.',
  },
  {
    pattern: /Email not confirmed/i,
    message: 'Confirme seu email antes de fazer login.',
  },
  {
    pattern: /already registered/i,
    message: 'Este email já está cadastrado.',
  },
  {
    pattern: /User already registered/i,
    message: 'Este email já está cadastrado.',
  },
  {
    pattern: /signup is disabled/i,
    message: 'Cadastro temporariamente indisponível.',
  },
  {
    pattern: /rate limit/i,
    message: 'Muitas tentativas. Aguarde alguns minutos.',
  },
  {
    pattern: /invalid.*email/i,
    message: 'Email inválido. Verifique o formato.',
  },
  {
    pattern: /password.*too short/i,
    message: 'A senha deve ter pelo menos 6 caracteres.',
  },
  {
    pattern: /password.*weak/i,
    message: 'A senha é muito fraca. Use letras, números e símbolos.',
  },

  // ========================================
  // Business rule errors (thrown directly)
  // ========================================
  {
    pattern: 'Saldo insuficiente para esta transferência.',
    message: 'Saldo insuficiente para realizar a transferência.',
  },
  {
    pattern: /saldo insuficiente/i,
    message: 'Saldo insuficiente para realizar a transferência.',
  },

  // ========================================
  // Foreign key violations - Transactions
  // ========================================
  {
    pattern: /violates foreign key constraint.*transactions.*account_id/i,
    message: 'Não é possível excluir esta conta porque existem transações vinculadas.',
  },
  {
    pattern: /violates foreign key constraint.*transactions.*to_account_id/i,
    message: 'Não é possível excluir esta conta porque existem transações vinculadas.',
  },
  {
    pattern: /violates foreign key constraint.*transactions.*category_id/i,
    message: 'Não é possível excluir esta categoria porque existem transações vinculadas.',
  },
  {
    pattern: /violates foreign key constraint.*transactions.*subcategory_id/i,
    message: 'Não é possível excluir esta subcategoria porque existem transações vinculadas.',
  },
  {
    pattern: /violates foreign key constraint.*transactions.*member_id/i,
    message: 'Não é possível excluir este membro porque existem transações vinculadas.',
  },

  // ========================================
  // Foreign key violations - Budgets
  // ========================================
  {
    pattern: /violates foreign key constraint.*budgets.*category_id/i,
    message: 'Não é possível excluir esta categoria porque existem orçamentos vinculados.',
  },
  {
    pattern: /violates foreign key constraint.*budgets.*subcategory_id/i,
    message: 'Não é possível excluir esta subcategoria porque existem orçamentos vinculados.',
  },

  // ========================================
  // Foreign key violations - Subcategories
  // ========================================
  {
    pattern: /violates foreign key constraint.*subcategories.*category_id/i,
    message: 'Não é possível excluir esta categoria porque existem subcategorias vinculadas.',
  },

  // ========================================
  // Generic foreign key violation
  // ========================================
  {
    pattern: /violates foreign key constraint/i,
    message: 'Não é possível excluir porque existem registros vinculados.',
  },

  // ========================================
  // Unique constraint violations
  // ========================================
  {
    pattern: /duplicate key value.*budgets.*unique/i,
    message: 'Já existe um orçamento para este mês. Edite o existente.',
  },
  {
    pattern: /duplicate key value.*budgets/i,
    message: 'Já existe um orçamento para este mês. Edite o existente.',
  },
  {
    pattern: /duplicate key value violates unique constraint/i,
    message: 'Já existe um registro com esses dados.',
  },

  // ========================================
  // Not null violations
  // ========================================
  {
    pattern: /null value in column.*violates not-null constraint/i,
    message: 'Preencha os campos obrigatórios para continuar.',
  },
  {
    pattern: /not-null constraint/i,
    message: 'Preencha os campos obrigatórios para continuar.',
  },

  // ========================================
  // Permission / RLS violations
  // ========================================
  {
    pattern: /row-level security/i,
    message: 'Você não tem permissão para executar esta ação.',
  },
  {
    pattern: /permission denied/i,
    message: 'Você não tem permissão para executar esta ação.',
  },
  {
    pattern: /401/,
    message: 'Você precisa estar logado para executar esta ação.',
  },
  {
    pattern: /403/,
    message: 'Você não tem permissão para executar esta ação.',
  },
  {
    pattern: /JWT expired/i,
    message: 'Sua sessão expirou. Faça login novamente.',
  },
  {
    pattern: /token.*expired/i,
    message: 'Sua sessão expirou. Faça login novamente.',
  },

  // ========================================
  // Transaction-specific errors
  // ========================================
  {
    pattern: /Transação confirmada não pode ter data futura/i,
    message: 'Transação confirmada não pode ter data futura. Use "Não pago" para agendar.',
  },
  
  // ========================================
  // Check constraint violations
  // ========================================
  {
    pattern: /transactions_planned_status_rules/i,
    message: 'Erro de regra de status. Atualize a página e tente novamente.',
  },
  {
    pattern: /violates check constraint/i,
    message: 'Os dados informados não são válidos.',
  },
  {
    pattern: /Subcategory does not belong to the selected category/i,
    message: 'A subcategoria selecionada não pertence a esta categoria.',
  },

  // ========================================
  // Network/connection errors
  // ========================================
  {
    pattern: /network/i,
    message: 'Erro de conexão. Verifique sua internet.',
  },
  {
    pattern: /fetch failed/i,
    message: 'Erro de conexão. Verifique sua internet.',
  },
  {
    pattern: /timeout/i,
    message: 'A operação demorou muito. Tente novamente.',
  },
  {
    pattern: /Failed to fetch/i,
    message: 'Erro de conexão. Verifique sua internet.',
  },
  {
    pattern: /ERR_CONNECTION/i,
    message: 'Erro de conexão. Verifique sua internet.',
  },

  // ========================================
  // Generic internal errors
  // ========================================
  {
    pattern: /No household/i,
    message: 'Você precisa estar em uma residência para continuar.',
  },
];

/**
 * Maps technical error messages to user-friendly messages.
 * Always logs the original error to console for debugging.
 */
export function getFriendlyErrorMessage(error: Error | string | unknown, debugPayload?: unknown): string {
  // Extract error message from various error types
  let errorMessage: string;
  let errorDetails: string | undefined;
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    errorMessage = String(errorObj.message || errorObj.error || error);
    // Capture Supabase detailed error info
    if (errorObj.details) errorDetails = String(errorObj.details);
    if (errorObj.hint) errorDetails = (errorDetails ? errorDetails + ' | ' : '') + String(errorObj.hint);
    if (errorObj.code) errorDetails = (errorDetails ? errorDetails + ' | ' : '') + `Code: ${errorObj.code}`;
  } else {
    errorMessage = String(error);
  }
  
  // Log the original error for debugging (always)
  console.error('[Error]', error);
  if (errorDetails) {
    console.error('[Error Details]', errorDetails);
  }
  if (debugPayload !== undefined) {
    console.error('[Error Payload]', debugPayload);
  }
  
  // Try to match against known patterns
  for (const { pattern, message } of errorPatterns) {
    if (typeof pattern === 'string') {
      if (errorMessage === pattern) {
        return message;
      }
    } else if (pattern.test(errorMessage)) {
      return message;
    }
  }
  
  // If we have details and no pattern matched, show a more informative fallback
  if (errorDetails) {
    console.error('[Unmatched Error - Full Details]', { message: errorMessage, details: errorDetails });
    return `Erro: ${errorMessage.slice(0, 100)}`;
  }
  
  // Default fallback - hide all technical details from user
  return 'Não foi possível concluir a ação. Tente novamente.';
}

/**
 * Helper to show a standardized error toast.
 * Use this instead of calling toast.error directly with raw errors.
 */
export function showErrorToast(error: Error | string | unknown): void {
  import('sonner').then(({ toast }) => {
    toast.error(getFriendlyErrorMessage(error));
  });
}

/**
 * Helper to show a standardized success toast.
 */
export function showSuccessToast(message: string): void {
  import('sonner').then(({ toast }) => {
    toast.success(message);
  });
}

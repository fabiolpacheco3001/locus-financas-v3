
-- ===========================================
-- 1. IDEMPOTÊNCIA FORTE EM NOTIFICATIONS
-- ===========================================

-- Adicionar coluna dedupe_key para identificação única de notificações
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Adicionar coluna para controle de status "aberto" (not dismissed)
-- Usamos uma coluna computada para o índice único
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS is_open BOOLEAN GENERATED ALWAYS AS (dismissed_at IS NULL) STORED;

-- Criar índice único parcial para evitar duplicações
-- Apenas notificações abertas com mesmo dedupe_key são bloqueadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_unique 
ON public.notifications (household_id, dedupe_key) 
WHERE dedupe_key IS NOT NULL AND dismissed_at IS NULL;

-- Índice para consultas por dedupe_key
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe_key 
ON public.notifications (household_id, dedupe_key) 
WHERE dedupe_key IS NOT NULL;


-- ===========================================
-- 2. ÍNDICES DE PERFORMANCE - TRANSACTIONS
-- ===========================================

-- Índice para consultas por data (dashboard, relatórios)
CREATE INDEX IF NOT EXISTS idx_transactions_household_date 
ON public.transactions (household_id, date);

-- Índice para consultas por due_date (vencimentos, a pagar)
CREATE INDEX IF NOT EXISTS idx_transactions_household_due_date 
ON public.transactions (household_id, due_date) 
WHERE due_date IS NOT NULL;

-- Índice para consultas por status e kind (filtros comuns)
CREATE INDEX IF NOT EXISTS idx_transactions_household_status_kind 
ON public.transactions (household_id, status, kind);

-- Índice para transações planejadas (usadas em cálculos de risco)
CREATE INDEX IF NOT EXISTS idx_transactions_planned_expenses 
ON public.transactions (household_id, due_date, amount) 
WHERE status = 'planned' AND kind = 'EXPENSE';


-- ===========================================
-- 3. ÍNDICES DE PERFORMANCE - NOTIFICATIONS
-- ===========================================

-- Melhorar índice para consultas por household + created_at
CREATE INDEX IF NOT EXISTS idx_notifications_household_created 
ON public.notifications (household_id, created_at DESC);

-- Índice para consultas por reference_id
CREATE INDEX IF NOT EXISTS idx_notifications_reference 
ON public.notifications (household_id, event_type, reference_id) 
WHERE reference_id IS NOT NULL;


-- ===========================================
-- 4. CAMPOS DE AUDITORIA - TRANSACTIONS
-- ===========================================

-- created_by já existe implicitamente (member_id), mas vamos adicionar updated_by
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.members(id);

-- Atualizar trigger para setar updated_by (opcional, via app)

-- ===========================================
-- 5. CAMPOS DE AUDITORIA - NOTIFICATIONS
-- ===========================================

-- Adicionar created_by para rastrear origem
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.members(id);


-- ===========================================
-- 6. VERIFICAR RLS - households INSERT policy
-- A política atual usa "true" que é muito permissiva
-- Mas é necessária para signup, então vamos manter
-- porém adicionar validação que só pode criar 1 household por user
-- ===========================================

-- Não vamos alterar a política de INSERT em households pois é necessária
-- para o fluxo de signup. A função create_household_with_admin já garante
-- que o household é criado corretamente com o membro admin.


-- ===========================================
-- 7. FUNÇÃO PARA UPSERT DE NOTIFICAÇÃO COM DEDUPE_KEY
-- ===========================================

CREATE OR REPLACE FUNCTION public.upsert_notification(
  p_household_id UUID,
  p_dedupe_key TEXT,
  p_event_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_reference_id TEXT DEFAULT NULL,
  p_cta_label TEXT DEFAULT NULL,
  p_cta_target TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_existing_id UUID;
BEGIN
  -- Verificar se já existe notificação ativa com mesmo dedupe_key
  SELECT id INTO v_existing_id
  FROM public.notifications
  WHERE household_id = p_household_id
    AND dedupe_key = p_dedupe_key
    AND dismissed_at IS NULL
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    -- Atualizar notificação existente
    UPDATE public.notifications
    SET 
      title = p_title,
      message = p_message,
      type = p_type,
      cta_label = p_cta_label,
      cta_target = p_cta_target,
      metadata = p_metadata
    WHERE id = v_existing_id
    RETURNING id INTO v_notification_id;
  ELSE
    -- Criar nova notificação
    INSERT INTO public.notifications (
      household_id,
      dedupe_key,
      event_type,
      title,
      message,
      type,
      reference_id,
      cta_label,
      cta_target,
      metadata,
      created_by
    ) VALUES (
      p_household_id,
      p_dedupe_key,
      p_event_type,
      p_title,
      p_message,
      p_type,
      p_reference_id,
      p_cta_label,
      p_cta_target,
      p_metadata,
      p_created_by
    )
    RETURNING id INTO v_notification_id;
  END IF;
  
  RETURN v_notification_id;
END;
$$;


-- ===========================================
-- 8. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ===========================================

COMMENT ON COLUMN public.notifications.dedupe_key IS 'Chave única para idempotência. Formato: {event_type}:{reference_id}';
COMMENT ON COLUMN public.notifications.is_open IS 'Coluna computada: TRUE se dismissed_at IS NULL';
COMMENT ON COLUMN public.notifications.created_by IS 'ID do membro que criou a notificação (NULL = sistema)';
COMMENT ON COLUMN public.transactions.updated_by IS 'ID do membro que fez a última atualização';
COMMENT ON FUNCTION public.upsert_notification IS 'Cria ou atualiza notificação de forma idempotente usando dedupe_key';

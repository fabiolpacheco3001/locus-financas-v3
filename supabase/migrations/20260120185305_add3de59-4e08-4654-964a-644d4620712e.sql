-- PATCH (definitivo) — Hardening de JSONB (metadata/params)

-- 1) Função allowlist para JSONB
create or replace function public.jsonb_allowlist(obj jsonb, allowed_keys text[])
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := '{}'::jsonb;
  k text;
  v jsonb;
begin
  if obj is null then
    return '{}'::jsonb;
  end if;
  if jsonb_typeof(obj) <> 'object' then
    return '{}'::jsonb;
  end if;
  for k, v in
    select key, value from jsonb_each(obj)
  loop
    if k = any(allowed_keys) then
      result := result || jsonb_build_object(k, v);
    end if;
  end loop;
  return jsonb_strip_nulls(result);
end;
$$;

-- 2) Triggers para sanitizar antes de INSERT/UPDATE
create or replace function public.trg_sanitize_risk_events_metadata()
returns trigger
language plpgsql
as $$
begin
  -- Ajuste a allowlist conforme seu domínio, mantendo apenas referências e classificação
  new.metadata := public.jsonb_allowlist(new.metadata, array[
    'rule_key',        -- ex: "OVER_BUDGET", "LOW_BALANCE"
    'severity',        -- ex: "low|medium|high"
    'scope',           -- ex: "month|account|household"
    'month',           -- "2026-01"
    'account_id',      -- referência
    'category_id',     -- referência
    'budget_id',       -- referência
    'transaction_id'   -- referência
  ]);
  -- limite de tamanho (ajuste se necessário)
  if octet_length(new.metadata::text) > 1024 then
    raise exception 'risk_events.metadata too large';
  end if;
  return new;
end;
$$;

drop trigger if exists sanitize_risk_events_metadata on public.risk_events;
create trigger sanitize_risk_events_metadata
before insert or update on public.risk_events
for each row
execute function public.trg_sanitize_risk_events_metadata();

create or replace function public.trg_sanitize_notifications_metadata()
returns trigger
language plpgsql
as $$
begin
  -- metadata: apenas referência/roteamento (sem valor, saldo, descrição)
  new.metadata := public.jsonb_allowlist(new.metadata, array[
    'template_key',    -- ex: "BUDGET_ALERT", "RISK_ALERT"
    'severity',        -- "info|warning|critical"
    'month',           -- "2026-01"
    'entity_type',     -- "transaction|budget|account|risk_event"
    'entity_id'        -- id referenciado
  ]);
  -- params: somente chaves "de texto" / não-sensíveis para i18n (sem números exatos)
  new.params := public.jsonb_allowlist(new.params, array[
    'category_name',
    'account_name',
    'title_key',       -- opcional (se usa templates)
    'body_key'         -- opcional
  ]);
  if octet_length(new.metadata::text) > 1024 then
    raise exception 'notifications.metadata too large';
  end if;
  if octet_length(new.params::text) > 1024 then
    raise exception 'notifications.params too large';
  end if;
  return new;
end;
$$;

drop trigger if exists sanitize_notifications_metadata on public.notifications;
create trigger sanitize_notifications_metadata
before insert or update on public.notifications
for each row
execute function public.trg_sanitize_notifications_metadata();

-- 3) Backfill: limpar dados já gravados
update public.risk_events
set metadata = public.jsonb_allowlist(metadata, array[
  'rule_key','severity','scope','month','account_id','category_id','budget_id','transaction_id'
])
where metadata is not null;

update public.notifications
set
  metadata = public.jsonb_allowlist(metadata, array[
    'template_key','severity','month','entity_type','entity_id'
  ]),
  params = public.jsonb_allowlist(params, array[
    'category_name','account_name','title_key','body_key'
  ])
where metadata is not null or params is not null;
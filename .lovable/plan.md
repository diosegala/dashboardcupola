# Restringir acesso seller aos dados do Pipedrive

## Políticas atuais, consultadas no Lovable Cloud

RLS está habilitada nas seis tabelas. Todas as políticas abaixo se aplicam ao papel PostgreSQL `authenticated`.

Cada tabela possui exatamente estas três políticas (substitua `<tabela>` pelo nome na tabela abaixo):

| Nome da política | Tipo | Operação | USING | WITH CHECK |
|---|---|---|---|---|
| `Admins can manage <tabela>` | PERMISSIVE | ALL | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| `View <tabela> of allowed accounts` | PERMISSIVE | SELECT | `can_see_crm_account(crm_account)` | — |
| `Sellers cannot read <tabela>` | RESTRICTIVE | SELECT | `NOT is_seller()` | — |

Tabelas consultadas: `deals`, `deal_products`, `crm_products`, `deal_installments`, `crm_leads`, `crm_organizations`.

`is_seller()` verifica o papel seller em `user_roles`, sem exceção para admin. Portanto, a restrição atual também bloqueia leituras de usuários que acumulam os dois papéis. O SQL abaixo preserva as políticas permissivas de administradores e explicita a prioridade do papel admin nas restritivas.

`can_see_crm_account()` permite admins ou contas vinculadas a eventos acessíveis ao usuário. Esse escopo permanece inalterado: as novas regras não liberam outras contas/eventos.

## Resultado proposto

- **deals:** seller sem admin lê somente `won` com `is_deleted = false`, dentro das contas já permitidas.
- **deal_products:** lê somente produtos de negócios visíveis pela regra acima e pelo escopo atual.
- **crm_products:** leitura dentro das contas já permitidas, sem filtro adicional.
- **deal_installments, crm_leads, crm_organizations:** continuam invisíveis para seller sem admin.
- **Escritas:** continuam exclusivas de admin nas seis tabelas; não alterar grants compartilhados de `authenticated`, pois também são usados por administradores.
- Não modificar tabelas, funções de sincronização ou dados. Não aplicar nada antes da aprovação.

## SQL exato a aplicar após aprovação

```sql
BEGIN;

ALTER POLICY "Sellers cannot read deals"
ON public.deals
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
  OR (status = 'won' AND is_deleted = false)
);

ALTER POLICY "Sellers cannot read deal_products"
ON public.deal_products
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
  OR EXISTS (
    SELECT 1
    FROM public.deals AS d
    WHERE d.id = deal_products.deal_id
      AND d.status = 'won'
      AND d.is_deleted = false
  )
);

ALTER POLICY "Sellers cannot read crm_products"
ON public.crm_products
USING (true);

ALTER POLICY "Sellers cannot read deal_installments"
ON public.deal_installments
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
);

ALTER POLICY "Sellers cannot read crm_leads"
ON public.crm_leads
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
);

ALTER POLICY "Sellers cannot read crm_organizations"
ON public.crm_organizations
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
);

COMMIT;
```

As políticas continuam RESTRICTIVE e apenas SELECT. `USING (true)` em `crm_products` remove apenas o bloqueio seller; a política permissiva de contas continua necessária. A consulta a `deals` na regra de `deal_products` também respeita a RLS de `deals`.

## Validação após aprovação

Aplicar o SQL exatamente como apresentado por uma migração no Lovable Cloud e consultar novamente as políticas. Executar verificações sob papel `authenticated` com identidade seller sem admin: somente negócios ganhos não excluídos e seus produtos, leitura de catálogo no escopo permitido, zero registros das três tabelas bloqueadas e nenhuma escrita autorizada. Validar separadamente admin e admin+seller sem as restrições seller, além da preservação do comportamento de viewers. Registrar testes de permissões no projeto e executá-los; realizar as verificações de escrita em transações revertidas, sem mudanças duráveis de dados.
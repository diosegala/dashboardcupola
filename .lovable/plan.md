

# Adicionar filtro de status na tabela de usuários

## Alteração

Adicionar um `Select` de filtro acima da tabela de usuários com 3 opções: "Todos", "Ativos" e "Pendentes". Filtra a lista `users` antes de renderizar com base no campo `email_confirmed_at`.

## Implementação — `src/pages/Settings.tsx`

1. Novo estado: `const [statusFilter, setStatusFilter] = useState<string>("all")`
2. Filtro aplicado: `const filteredUsers = users?.filter(u => statusFilter === "all" ? true : statusFilter === "active" ? !!u.email_confirmed_at : !u.email_confirmed_at)`
3. Um `Select` entre o `CardDescription` e a tabela, com as opções:
   - `all` → "Todos"
   - `active` → "Ativos"
   - `pending` → "Pendentes"
4. Renderizar `filteredUsers` em vez de `users` no `TableBody`


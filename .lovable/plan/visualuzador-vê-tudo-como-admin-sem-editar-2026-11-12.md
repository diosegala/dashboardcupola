# Visualuzador vê tudo, como admin (sem editar)

## O que está acontecendo

A conta [kassia.calonassi@cupola.com.br](mailto:kassia.calonassi@cupola.com.br) é Visualizador, mas não está liberada em nenhum evento. Hoje, quem não é admin só vê os eventos em que foi incluído — por isso o painel dela aparece zerado ("0 ingressos", "Nenhum lote cadastrado"). Outros visualizadores funcionam porque foram incluídos nos 2 eventos.

## O que vou mudar

- Visualizador passa a ver todos os eventos e todos os dados (vendas, lotes, compradores, patrocínios, marketing, metas), igual ao admin, sem precisar ser incluído em cada evento.
- Continua sem poder criar/editar/excluir metas, mexer em Configurações, Integrações, usuários, cupons ou lotes. Essas proteções já existem e não mudam.
- Equipe (vendedores) continua com as restrições atuais.

## Detalhes técnicos

- Atualizar `can_see_event` e `can_see_crm_account` para retornar verdadeiro também para `has_role(auth.uid(),'viewer')` (só leitura; as políticas de escrita seguem exigindo admin).
- Revisar funções de leitura que checam admin diretamente (`get_buyer_events`, `get_buyer_rows`, `get_integrations_status`) e liberar leitura para viewer onde fizer sentido (compradores sim; segredos de integração não).
- Conferir no app se alguma tela esconde dados com `isAdmin` em vez de "pode editar".
- Testar entrando como a Kassia e confirmar números iguais aos do admin, e que salvar meta é bloqueado.
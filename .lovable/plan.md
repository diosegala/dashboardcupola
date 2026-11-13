# Revisão dos papéis de acesso, eventos, ranking e cupons

## O que encontrei hoje

- **14 pessoas com acesso**: 7 Admin, 6 Visualizador, 1 Equipe de venda (leticia.pinguelli). Cada uma tem um único papel, sem duplicidade.
- **3 pessoas sem nenhum evento liberado**: keity.marques (Admin), kassia.calonassi (Visualizador) e leticia.pinguelli (Equipe). Admin e Visualizador já veem tudo pela regra nova; a Equipe ainda depende dessa liberação, por isso a Leticia pode ver zero.
- **Ninguém tem cupom ligado à própria conta.** A tela da equipe identifica a pessoa logada só por esse vínculo, então o ranking não destaca ninguém. Esse é o principal motivo do "ranking genérico".
- **Troca de papel não aparece na hora**: o painel lê o papel uma vez ao entrar e não relê depois. A pessoa precisa sair e entrar de novo.
- A tabela de Cupons (56 pessoas) já segue o padrão NOME + letra + desconto e está correta na maioria.

## O que vou fazer

1. **Equipe vê todos os eventos**: a liberação por evento deixa de ser exigida para a Equipe ler ranking e compradores. Admin e Visualizador continuam vendo tudo. A Equipe continua sem acesso às outras áreas, no banco e na tela.
2. **Visualizador**: continua vendo tudo; Integrações, Configurações e criação/edição de metas ficam bloqueadas no banco e na tela (já é assim; vou revisar cada tabela e confirmar).
3. **Troca de papel imediata**: o painel passa a reler o papel ao voltar para a aba, a cada poucos minutos e quando o login é renovado, e limpa os dados guardados da sessão anterior. A pessoa vê o novo papel sem precisar sair.
4. **Ligar cada pessoa ao seu cupom**: a ligação passa a ser feita automaticamente pelo nome da conta (ex.: suellen.moreira → Suellen), usando a tabela de Cupons que já existe. Sem nova tabela paralela. Quando houver dúvida, a ligação não é feita e o caso vai para a lista de validação abaixo.
5. **Leitura do código do cupom**: regra única e testada que separa nome, letra e desconto (LETICIAA5 → Leticia, A, 5%; LETICIAB15 → Leticia, B, 15%). Cupons que não seguem o padrão ou que não têm dono aparecem num aviso para o admin em Configurações › Cupons.
6. **Ranking da pessoa logada**: destaca a posição, ingressos, vendas e status de quem entrou. Admin e Visualizador continuam vendo o ranking geral.
7. **Testes**: regras automáticas para os três papéis e para a leitura dos cupons; depois entro no painel como Admin, Visualizador e Equipe e confiro cada tela com dados reais.

## Precisa da sua validação antes de eu ligar

- **"Leticia B"** junta LETICIAC5, LETICIA10 e LETICIA15 e três nomes de vendedora (Bello, Pinguelli, Caetana), e está fora do ranking. A conta da leticia.pinguelli (Equipe) deveria ser a "Leticia B"? Se sim, ela aparece fora do ranking.
- **LETICIAB5**, citado no seu exemplo, não está cadastrado. A quem pertence?
- **ERICA TIMECUPOLA** foge do padrão (sem desconto). Fica assim?
- **Aline**: existem "Aline B", "Aline P" e "Aline Pavezi" (ALINEPAVEZI5). aline.pavezi seria "Aline P" ou "Aline Pavezi"? Pode ser a mesma pessoa duplicada.
- Admins e Visualizadores que também vendem (ex.: Alice, Dioner, Greice, Renata, Rubens, Lorrainny, Kássia, Keity, Emillyn) também devem ser ligados aos seus cupons para aparecerem destacados?

## Detalhes técnicos

- `can_see_event`/`get_buyer_rows`/`get_buyer_events`: incluir `is_seller()` para leitura; políticas de escrita continuam só admin.
- Revisar políticas de todas as tabelas por papel (admin escreve; viewer lê; seller só ranking, compradores, cupons e vendas ganhas já definidas).
- Vínculo pessoa↔cupom: popular `team_coupons` a partir de `coupon_people` por correspondência exata do primeiro nome + letra do sobrenome; ambíguos ficam de fora. Tela de Configurações continua sendo o lugar para ajustar.
- `useAuth`: reler `user_roles` em `TOKEN_REFRESHED`, foco da janela e intervalo; limpar o cache de consultas ao mudar o papel.
- Parser de cupom puro em `src/lib/coupons.ts` com testes (letra x número, descontos variáveis).

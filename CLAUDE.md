# Painel de Eventos CUPOLA

Projeto Lovable "[SUM] Dashboard de vendas e Marketing", sincronizado com o GitHub pela branch `main`.
A palavra CUPOLA é sempre escrita em maiúsculas. Textos da interface em português do Brasil.

## Sincronização com o Lovable (sempre seguir)

1. **Ao iniciar qualquer sessão**, antes de ler ou editar código:
   `git checkout main && git pull --ff-only origin main`
   Assim entram as mudanças feitas no Lovable por qualquer pessoa.
2. **Cada tarefa em uma branch própria**, criada a partir da `main` atualizada: `git checkout -b <tema-curto>`.
3. Mostrar a prévia (`npm run dev`) e só seguir depois da aprovação da Emillyn.
4. **Para publicar**, quando a Emillyn pedir:
   - `git checkout main && git pull --ff-only origin main`
   - `git merge --no-ff <branch>` e rodar `npm run build`. Se o build falhar, não enviar.
   - `git push origin main`
   - Avisar que o código já está no Lovable e que falta clicar em **Publicar** no Lovable para o site no ar mudar.
5. Se o `pull` acusar conflito ou histórico divergente, parar e explicar. Nunca resolver com força.

## Proibido

- `git push --force`, `git rebase` na `main` ou reescrever histórico já enviado.
- Editar `src/integrations/supabase/client.ts` e `src/integrations/supabase/types.ts` (gerados pelo Lovable).
- Criar ou rodar migrações, alterar edge functions, segredos ou integrações sem aprovação. O banco é o Lovable Cloud: mudanças de banco aprovadas são pedidas no chat do Lovable, não aplicadas daqui.
- Colocar chaves secretas (service role, tokens de API) em qualquer arquivo do repositório. O repositório pode ficar público.
- Salvar senhas, e-mails de acesso ou dados pessoais em arquivos de plano ou documentação.

## Referências

- Design system: `docs/design-system/ds-summit.html`
- Briefing do redesign: `docs/BRIEFING-CLAUDE-CODE.md`
- Logos: `public/brand/`

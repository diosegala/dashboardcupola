
# Restringir pagina de Integracoes apenas para admins

## Mudancas

### 1. Sidebar (`src/components/AppSidebar.tsx`)
Mover o item "Integracoes" para dentro do bloco condicional `isAdmin`, junto com "Configuracoes". Assim, usuarios viewers nao verao o link no menu.

### 2. Pagina Integrations (`src/pages/Integrations.tsx`)
Adicionar uma verificacao no inicio do componente: se `isAdmin` for `false` (e `loading` ja tiver terminado), redirecionar para `/` usando `<Navigate to="/" replace />`. Isso impede acesso direto pela URL.

Remover a mensagem de "acesso de visualizacao" que ja nao sera necessaria.

### Detalhes tecnicos
- No `AppSidebar.tsx`, separar os itens publicos (Dashboard, Metas) dos restritos (Integracoes, Configuracoes), renderizando os restritos condicionalmente com `isAdmin`
- No `Integrations.tsx`, importar `Navigate` do `react-router-dom` e retornar `<Navigate to="/" replace />` quando `!loading && !isAdmin`

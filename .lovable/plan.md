

# Recuperação de Senha

## Problema
Não existe fluxo de "Esqueci minha senha" na tela de login. Se um usuário como o Juliano perder a senha, não tem como recuperar sozinho.

## Solução

Adicionar dois elementos:

### 1. Link "Esqueceu sua senha?" na tela de Login (`src/pages/Login.tsx`)
- Adicionar um link abaixo do botão "Entrar" que leva para `/forgot-password`

### 2. Nova página `/forgot-password` (`src/pages/ForgotPassword.tsx`)
- Campo de e-mail + botão "Enviar link de recuperação"
- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/set-password' })`
- Mostra mensagem de sucesso orientando o usuário a checar o e-mail

### 3. Rota no App.tsx
- Adicionar `<Route path="/forgot-password" element={<ForgotPassword />} />`

### 4. Ajuste em `SetPassword.tsx`
- Já existe e trata o evento `PASSWORD_RECOVERY`, então funcionará como página de redefinição de senha sem alterações.

## Resultado
O Juliano (e qualquer outro usuário) poderá clicar em "Esqueceu sua senha?" na tela de login, receber um e-mail com link de recuperação e definir uma nova senha pela página `/set-password` que já existe.


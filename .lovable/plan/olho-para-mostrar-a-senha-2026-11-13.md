# Olho para mostrar a senha

Todos os campos de senha ganham um ícone de olho à direita. Ao clicar, a senha fica visível (olho aberto) e, ao clicar de novo, volta a ficar oculta (olho riscado).

Onde aparece:
- Login
- Criação de senha (convite e redefinição), nos dois campos
- Meu perfil (troca de senha)
- Painel da pessoa em Configurações (senha definida pelo administrador)

## Detalhes técnicos
- Novo componente `src/components/ui/password-input.tsx` (Input + botão com Eye/EyeOff, `aria-label` "Mostrar senha"/"Ocultar senha", `tabIndex` normal, cores por tokens).
- Trocar os `Input type="password"` de Login, SetPassword, Profile e UserDetailSheet por `PasswordInput`, mantendo props atuais.

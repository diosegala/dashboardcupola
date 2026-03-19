

# Corrigir R$ duplicado no card de Investimento

## Problema

Na linha 164 de `MarketingSection.tsx`, o valor já é formatado com `R$ ` no template string (`R$ ${totalSpend...}`), e o `prefix="R$ "` adiciona o símbolo novamente.

## Correção

Remover o `R$ ` do `value` e manter apenas o `prefix`. Assim o `MetricCard` cuida da formatação, e a meta também exibirá o prefixo correto.

```tsx
// De:
value={`R$ ${totalSpend.toLocaleString(...)}`} prefix="R$ "

// Para:
value={totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} prefix="R$ "
```

Arquivo: `src/components/dashboard/MarketingSection.tsx`, linha 164.




# Adicionar botao "Todo o periodo" ao lado do seletor de datas

## O que sera feito

Adicionar um botao "Todo o periodo" ao lado do seletor de calendario no dashboard. Ao clicar, o filtro de datas sera expandido para cobrir desde a data mais antiga dos dados ate hoje, mostrando todas as metricas sem restricao de periodo.

## Implementacao

### 1. Atualizar `PeriodSelector.tsx`

- Adicionar uma nova prop `onSelectAllTime` (callback sem argumentos)
- Renderizar um botao com icone `Infinity` (do lucide-react) ao lado do botao de calendario existente, com texto "Todo periodo"
- Ao clicar, chama `onSelectAllTime()`
- Os dois botoes ficam lado a lado num flex container

### 2. Atualizar `Index.tsx`

- Criar uma funcao `handleAllTime` que define o range como `{ from: new Date(2020, 0, 1), to: new Date() }` (data suficientemente antiga para cobrir todos os dados)
- Passar essa funcao como prop `onSelectAllTime` para o `PeriodSelector`

## Layout

```text
[Dashboard title]          [ Todo periodo ]  [ 01 fev - 28 fev 2026 ]
```

## Arquivos alterados

1. `src/components/dashboard/PeriodSelector.tsx` -- nova prop e botao
2. `src/pages/Index.tsx` -- handler e passagem da prop


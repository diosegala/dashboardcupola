

# Melhorar o seletor de período do dashboard

## Problemas atuais

1. **UX de seleção de intervalo**: ao clicar numa data no calendário, o `onChange` dispara imediatamente (inclusive com `from === to`), o que pode fechar o popover ou causar comportamento inesperado antes de selecionar a segunda data
2. **Presets incompletos**: faltam "Hoje", "Ontem", "Este trimestre", "Trimestre passado"; sobram "Últimos 7 dias" e "Últimos 30 dias" que podem ser mantidos
3. **Layout**: presets e calendário empilhados verticalmente ocupam muito espaço; um layout lado a lado ficaria mais limpo

## Implementação — `src/components/dashboard/PeriodSelector.tsx`

### 1. Layout lado a lado (presets à esquerda, calendário à direita)

```text
┌─────────────────────────────────────────────┐
│ Hoje              │                         │
│ Ontem             │   ◀ Mar 2026    Abr ▶   │
│ Esta semana       │   ┌──┬──┬──┬──┬──┬──┐   │
│ Semana passada    │   │  │  │  │  │  │  │   │
│ Este mês          │   │  │  │  │  │  │  │   │
│ Mês passado       │   └──┴──┴──┴──┴──┴──┘   │
│ Este trimestre    │                         │
│ Trimestre passado │                         │
│ Todo o período    │                         │
├─────────────────────────────────────────────┤
│              [Aplicar]  [Limpar]            │
└─────────────────────────────────────────────┘
```

### 2. Presets atualizados

- **Hoje** — dia atual
- **Ontem** — dia anterior
- **Esta semana** — seg a dom (semana atual)
- **Semana passada** — seg a dom anterior
- **Este mês** — mês atual
- **Mês passado** — mês anterior
- **Este trimestre** — Q1/Q2/Q3/Q4 atual
- **Trimestre passado** — trimestre anterior
- **Todo o período** — desde 2020

Ao clicar num preset, aplica imediatamente e fecha o popover (comportamento atual, funciona bem para presets).

### 3. Seleção manual com confirmação

Problema principal: atualmente qualquer clique no calendário chama `onChange` direto, o que atualiza o dashboard antes de completar a seleção.

Solução:
- Estado interno `tempRange` para guardar a seleção em progresso
- O calendário atualiza `tempRange` (não o `onChange` do pai)
- Botão **"Aplicar"** chama `onChange(tempRange)` e fecha o popover
- Botão **"Limpar"** reseta `tempRange` para o range atual
- Ao abrir o popover, `tempRange` é inicializado com o `range` atual

### 4. Highlight visual do preset ativo

Comparar o `range` atual com cada preset e destacar o botão correspondente com `variant="secondary"`.

### 5. Fechar popover programaticamente

Usar estado `open` controlado no `Popover` para fechar ao aplicar ou ao clicar num preset.

## Detalhes técnicos

- Adicionar imports: `startOfQuarter`, `endOfQuarter`, `subQuarters`, `startOfDay`, `endOfDay`, `isSameDay` de `date-fns`
- Estado interno: `const [tempRange, setTempRange] = useState<DateRange>(range)` + `const [open, setOpen] = useState(false)`
- Popover controlado: `<Popover open={open} onOpenChange={setOpen}>`
- `useEffect` para sincronizar `tempRange` quando `range` muda externamente


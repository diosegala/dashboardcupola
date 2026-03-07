

# Comparador de Campanhas RD Station

## Ideia

Adicionar uma seção de comparação lado a lado abaixo dos cards atuais do RD Station. Dois painéis horizontais, cada um com seu próprio seletor de campanha (seleção única), exibindo os mesmos indicadores para permitir comparação direta.

## Layout

```text
┌─── RD Station ──────────────────────────────────────────────────┐
│ [filtro multi-campanha existente - sem mudança]                 │
│ [cards agregados existentes - sem mudança]                      │
│                                                                 │
│ ── Comparar Campanhas ──────────────────────────────────────    │
│                                                                 │
│ ┌─ Campanha A ────────────────┐  ┌─ Campanha B ──────────────┐ │
│ │ [seletor campanha única ▼]  │  │ [seletor campanha única ▼]│ │
│ │                             │  │                            │ │
│ │ Enviados: 1.250             │  │ Enviados: 890              │ │
│ │ Abriram:  400 (32.0%)       │  │ Abriram:  310 (34.8%)     │ │
│ │ Clicaram: 85  (6.8%)        │  │ Clicaram: 72  (8.1%)      │ │
│ └─────────────────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Alterações

### `src/components/dashboard/MarketingSection.tsx`

1. **Novo estado**: dois states para a campanha selecionada em cada lado (`compareA` e `compareB`, tipo `string | null`).

2. **Seletor de campanha única**: reutilizar um `<Select>` simples (do shadcn) com as opções de `emailCampaignOptions`. Cada lado tem seu próprio select. Placeholder: "Selecione uma campanha".

3. **Painel de comparação**: um `grid grid-cols-1 md:grid-cols-2 gap-4` abaixo dos cards existentes, só visível quando pelo menos uma campanha estiver selecionada em qualquer lado. Cada lado é um `<Card>` que mostra:
   - Nome da campanha (título do card)
   - Total enviados (`total_sent`)
   - Abriram (`total_opened`) com taxa de abertura
   - Clicaram (`total_clicked`) com taxa de clique
   - Layout em linhas com `<Separator />` entre métricas (mesmo padrão do card Leads Engajados)

4. **Lookup**: para cada lado, filtrar `emailCampaigns` pelo `rd_campaign_id` selecionado e somar os valores (uma campanha pode ter múltiplos registros).

### Nenhuma alteração de banco de dados necessária.

Arquivo editado: apenas `src/components/dashboard/MarketingSection.tsx`.




# Ajustar card "Leads Engajados" para layout em linhas

Substituir o layout `grid grid-cols-2` com divisor vertical por duas linhas empilhadas com um `<Separator />` horizontal entre elas.

## Alteração em `src/components/dashboard/MarketingSection.tsx`

Trocar o conteúdo do `<CardContent>` do card "Leads Engajados" por:

```tsx
<CardContent>
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Abriram</span>
      <span className="text-2xl font-bold">{emailTotals.totalOpened.toLocaleString("pt-BR")}</span>
    </div>
    <Separator />
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Clicaram</span>
      <span className="text-2xl font-bold">{emailTotals.totalClicked.toLocaleString("pt-BR")}</span>
    </div>
  </div>
</CardContent>
```

Cada linha mostra o label à esquerda e o valor à direita, separados por uma linha horizontal. Adicionar import do `Separator` se ainda não estiver importado.


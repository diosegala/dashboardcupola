

# Limitar tabelas de origem ao Top 10

## Mudanca
Adicionar `.slice(0, 10)` no array `sorted` dentro do `SourceBreakdownTable`, exibindo apenas as 10 origens com maior valor da metrica selecionada.

## Detalhe tecnico
Na linha 32 do `SourceBreakdownTable.tsx`, apos o `.sort()`, encadear `.slice(0, 10)` para cortar o array. Isso se aplica automaticamente as 4 tabelas (Sessoes, Conversoes, Tempo de Engajamento, Taxa de Rejeicao por Origem) pois todas usam o mesmo componente.


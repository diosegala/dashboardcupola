# Ritmo de vendas sem espaço em branco

Só visual, no card "Ritmo de vendas" da aba Comercial. Cálculos, textos e regras ficam iguais.

## O que muda
- O velocímetro fica maior e centralizado, ocupando a largura do card em vez de ficar num cantinho à esquerda.
- O conteúdo se distribui pela altura do card (que acompanha o card escuro "Ingressos pagantes"): velocímetro em cima, informações embaixo, sem o vão vazio no fim.
- As informações ("Precisa de 15 por dia útil", "133 dias úteis até o evento", comparativo e selo "Abaixo do ritmo") ficam numa faixa de baixo, separadas por uma linha fina, alinhadas ao rodapé do card escuro.

## Detalhes técnicos
- `src/components/dashboard/PaceGauge.tsx`: área de conteúdo vira `flex-1 flex-col justify-between`; SVG passa de tamanho fixo `h-[144px] w-[200px]` para `w-full max-w-[320px] h-auto mx-auto`; bloco de texto ganha `border-t border-line pt-4` e linha com chip à direita.
- Conferir no navegador em 1036px e 1280px de largura.

// Definições em linguagem de negócio usadas no botão "i" de cada indicador e gráfico.
export const METRIC_INFO: Record<string, string> = {
  // Vendas
  "Ingressos Vendidos (acumulado)":
    "Todos os ingressos vendidos desde a abertura das vendas, respeitando o filtro de valor mínimo. Não muda com o período escolhido.",
  "Receita Total (acumulado)":
    "Soma do valor de todos os ingressos vendidos desde a abertura das vendas, respeitando o filtro de valor mínimo.",
  "Ingressos Vendidos": "Ingressos vendidos no período selecionado, respeitando o filtro de valor mínimo.",
  "Receita Total": "Soma do valor dos ingressos vendidos no período selecionado.",
  "Ticket Médio": "Receita do período dividida pela quantidade de ingressos vendidos no mesmo período.",
  "Progresso por Lote": "Ingressos vendidos em cada lote comparados à meta do lote.",
  "Top 5 Tipos de Ingresso": "Os cinco tipos de ingresso mais vendidos no período.",
  "Ingressos Vendidos por Dia": "Ingressos vendidos em cada dia do período selecionado.",
  "Ingressos por Tipo": "Ingressos vendidos no período, separados por tipo de ingresso.",
  "Vendas por Dia da Semana (histórico)": "Ingressos vendidos em cada dia da semana, somando todo o histórico de vendas.",
  "Funil de KPIs":
    "Resultado de cada etapa do funil, do engajamento até a venda, semana a semana e comparado à meta de cada semana.",
  "Funil de Deals por Estágio": "Negócios do CRM em cada estágio do funil comercial.",

  // Meta Ads
  Campanhas: "Campanhas do Meta Ads com dados no período.",
  Investimento: "Valor investido em anúncios do Meta Ads no período.",
  "Impressões": "Quantas vezes os anúncios do Meta Ads apareceram na tela no período.",
  "Cliques no Link": "Cliques nos anúncios que levaram a pessoa para o link de destino.",
  CPC: "Custo por clique no link: investimento dividido pelos cliques no link.",
  CTR: "Taxa de cliques: cliques no link divididos pelas impressões.",
  "Compras (Pixel)": "Compras registradas pelo Pixel da Meta e atribuídas aos anúncios.",
  "Taxa de Conversão": "Compras registradas pelo Pixel divididas pelos cliques no link.",
  Mensagens: "Conversas iniciadas a partir dos anúncios.",
  "Adição de Carrinho": "Eventos de adição ao carrinho registrados pelo Pixel da Meta.",
  "Remarketing Qualificado": "Conversão personalizada do Meta Ads que marca visitantes qualificados para remarketing.",
  "Cliques por Dia (Meta Ads)": "Cliques no link dos anúncios do Meta Ads em cada dia do período.",

  // E-mail (RD Station)
  "Campanhas Enviadas": "Campanhas de e-mail do RD Station enviadas no período.",
  "Taxa de Abertura": "Média da taxa de abertura das campanhas de e-mail enviadas no período.",
  "Taxa de Clique": "Média da taxa de cliques das campanhas de e-mail enviadas no período.",

  // Site (Google Analytics)
  "Sessões": "Visitas ao site registradas pelo Google Analytics no período.",
  "Usuários": "Pessoas diferentes que visitaram o site no período.",
  "Conversões": "Eventos principais (key events) registrados pelo Google Analytics no período.",
  Pageviews: "Páginas visualizadas no site no período.",
  "Sessões por Origem": "Visitas ao site separadas pela origem do tráfego.",
  "Conversões por Origem": "Eventos principais do site separados pela origem do tráfego.",
  "Tempo Médio de Engajamento": "Tempo médio em que o site ficou aberto e em uso, por origem do tráfego.",
  "Taxa de Rejeição": "Percentual de sessões sem engajamento, por origem do tráfego.",
  "Sessões do Site por Dia": "Visitas ao site em cada dia do período.",
  "Funil de Conversão do Site": "Etapas do site da visita até a compra, com quantas pessoas passam de uma etapa para a outra.",
  "Geração de Demanda por Dia": "Cliques nos principais botões de interesse do site em cada dia, registrados pelo Google Analytics.",
  "Geração de Demanda no Site": "Total de cliques em cada botão de interesse do site no período.",
};

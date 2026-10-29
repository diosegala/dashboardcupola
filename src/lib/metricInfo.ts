// Definições em linguagem de negócio usadas no botão "i" de cada indicador e gráfico.
export const METRIC_INFO: Record<string, string> = {
  // Aba Comercial (definições do ds-summit)
  "Meta de ingressos pagantes":
    "Soma dos ingressos pagos na Sympla com os faturados internamente. Cortesias, expositores e patrocinadores não entram. A meta é cadastrada na tela Metas.",
  "Ritmo de vendas":
    "O arco mostra o ritmo atual: média de pagantes por dia útil nos últimos 10 dias úteis. O marcador escuro é o ritmo necessário: o que falta para a meta dividido pelos dias úteis até a véspera do evento, sem fins de semana e feriados nacionais.",
  "Ritmo necessário":
    "Ingressos pagantes que faltam divididos pelos dias úteis de hoje até a véspera do evento. Fins de semana e feriados nacionais ficam de fora.",
  "Ritmo atual":
    "Média de ingressos pagantes vendidos por dia útil nos últimos 10 dias úteis. Comparado com o ritmo necessário para indicar se a venda está no ritmo.",
  "Pagos na Sympla":
    "Pedidos aprovados na Sympla com qualquer valor acima de zero. Pendentes e cancelados não contam.",
  "Faturados internamente":
    "Ingressos vendidos pelo comercial fora da Sympla e resgatados com cupom que começa com FATURADO. Passa a contar quando a Sympla enviar o cupom.",
  Bonificados:
    "Ingressos aprovados sem valor: cortesias, expositores, patrocinadores, convidados e equipe. Ficam visíveis para controle de lotação, mas não somam na meta nem na receita.",
  "Ingressos pagantes":
    "Soma dos ingressos pagos na Sympla com os faturados internamente. Cortesias, expositores e patrocinadores não entram. Para acompanhar uma meta, defina-a na tela Metas.",
  "Pagantes acumulados": "Total de pagantes semana a semana desde a primeira venda. Com uma meta de pagantes na tela Metas, aparece também a trajetória até ela.",
  "Receita acumulada": "Valor dos ingressos pagantes desde a abertura das vendas. Com uma meta de receita na tela Metas, aparece o progresso até ela.",
  "Pagantes acumulados x meta":
    "Linha cheia: total de pagantes semana a semana. Linha tracejada: trajetória até a meta no dia do evento, distribuída por dias úteis.",
  "Ingressos emitidos":
    "Todos os ingressos do evento em três visões. Por categoria: contam na meta os pagos na Sympla (com ou sem cupom de desconto) e os faturados internamente; não contam as cortesias (cupom de 100%), as credenciais (equipe, expositores, imprensa, mesmo que tenham valor), os gratuitos sem cupom e os pendentes. Ingressos abaixo do 'Valor mínimo' do painel ficam fora de tudo. Por tipo: Padrão, VIP, combos, Grupo, Visita presencial e Credenciais, pelo nome na Sympla. Por lote: pagantes e receita de cada lote, com a meta do lote e o ano anterior.",
  "Composição":
    "Divide os ingressos emitidos entre os que contam na meta (pagos e faturados) e os bonificados (cortesias, credenciais e gratuitos).",
  "Vendas por dia útil":
    "Pagantes vendidos em cada um dos últimos 15 dias úteis. A linha marca o ritmo necessário. Barras abaixo da linha ficam em âmbar.",

  "Pagantes por tipo de ingresso": "Ingressos pagantes por categoria vendida. Nesta fase a meta é única e não separa VIP.",
  "Pagantes por região": "Região do comprador a partir do estado informado no formulário de inscrição da Sympla.",
  "Pagantes por perfil da empresa":
    "Perfil da empresa do comprador, informado no formulário de inscrição da Sympla. O formulário não pergunta o porte, então este é o dado mais próximo.",
  "Pagantes por forma de pagamento": "Como cada ingresso pagante foi pago na Sympla: cartão, boleto, Pix e outros.",
  "Pagantes por origem (UTM)": "Origem da venda pela UTM do link usado na compra (utm_source). Vendas sem UTM não aparecem.",
  Cupons:
    "Cupons usados nos ingressos emitidos, separados por grupo: Faturados (começam com FATURADO), Resgate (GANHADOR ou RESGATE), Palestrantes, Equipe CUPOLA (nome + 5, com 5% de desconto) e Parceiros e outros.",
  "Ranking da equipe":
    "Pagantes vendidos com o cupom de cada pessoa da equipe CUPOLA. O ranking recomeça a cada lote; o lote atual é o da venda mais recente. Passe o mouse no nome para ver o cupom. Ao lado, quantos lotes cada pessoa liderou.",

  "Pessoas no evento": "Pessoas que compraram ou vão participar do evento selecionado, juntando comprador e participante quando têm o mesmo e-mail, CPF, telefone ou nome completo.",
  "Já vieram antes": "Pessoas do evento selecionado que também compraram ou participaram de algum evento anterior.",
  "Empresas no evento": "Empresas com compradores ou participantes no evento selecionado, juntando pelo CNPJ ou pelo nome da empresa.",
  "Empresas que já vieram": "Empresas do evento selecionado que também estiveram em algum evento anterior.",

  "Vendas por dia da semana":
    "Quantas vendas pagantes cada dia da semana teve desde a abertura das vendas. O melhor dia fica em destaque. Cortesias e credenciais não entram.",

  "Região": "Região de quem vai ao evento, pelo estado informado no formulário de inscrição da Sympla. Ingressos aprovados.",
  "Perfil da empresa": "Perfil da empresa de quem vai ao evento, informado no formulário de inscrição da Sympla.",
  Acessibilidade: "Recursos de acessibilidade pedidos no formulário de inscrição. Respostas parecidas são agrupadas.",
  Cargo: "Cargo informado no formulário de inscrição.",
  Cidades: "Cidades informadas no formulário de inscrição. Grafias diferentes da mesma cidade são juntadas; o tamanho mostra quantas pessoas.",
  Participantes: "Ingressos aprovados do evento selecionado.",
  Estados: "Quantos estados diferentes aparecem entre os ingressos aprovados.",
  "Voltaram à CUPOLA": "Parte das pessoas deste evento que já participaram de algum outro evento CUPOLA (edições anteriores, imersões e outros).",
  Empresas: "Empresas diferentes entre os participantes deste evento.",
  "De onde vêm": "Estado de quem vai ao evento, informado no formulário de inscrição. A cor de cada região é fixa; quanto mais forte, mais pessoas daquele estado.",
  "Empresas da casa":
    "Empresas presentes neste evento, ranqueadas pela fidelidade à CUPOLA: em quantos eventos já vieram, depois quantos ingressos pagos somam em todos eles. Estreante é quem vem pela primeira vez.",
  "Visita presencial": "Opção de visita presencial escolhida no formulário de inscrição.",

  // Vendas
  "Ingressos Vendidos (acumulado)":
    "Todos os ingressos vendidos desde a abertura das vendas. Não muda com o período escolhido.",
  "Receita Total (acumulado)":
    "Soma do valor de todos os ingressos vendidos desde a abertura das vendas.",
  "Ingressos Vendidos": "Ingressos vendidos no período selecionado.",
  "Receita Total": "Soma do valor dos ingressos vendidos no período selecionado.",
  "Ticket Médio": "Receita do período dividida pela quantidade de ingressos vendidos no mesmo período.",
  "Progresso por Lote": "Ingressos vendidos em cada lote comparados à meta do lote.",
  "Vendas por lote":
    "Pagantes e receita de cada lote (pré-venda, lote 1, lote 2…). O lote 0 conta como pré-venda. Com meta do lote, aparece a marca da meta. Com a chave de comparação ligada, a linha tracejada mostra o mesmo lote do evento anterior, inteiro.",
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

  "Saúde das integrações":
    "Situação de cada fonte de dados do painel. Em dia: sincronizou nas últimas 26 horas. Atrasada: passou desse prazo. Erro: a última sincronização falhou.",

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

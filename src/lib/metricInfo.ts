// Definições em linguagem de negócio usadas no botão "i" de cada indicador e gráfico.
export const METRIC_INFO: Record<string, string> = {
  // Página Cupons
  "Entradas liberadas": "Ingressos aprovados com cupom de 100% de desconto (resgate, palestrantes, parceiros etc.). Não contam na meta de pagantes.",
  "Descontos concedidos": "Diferença entre o preço cheio e o valor pago, somada só nos cupons com desconto parcial (menor que 100%). Em cupom percentual, o preço cheio é calculado a partir do valor pago: valor pago ÷ (1 − desconto). Em cupom de valor fixo, soma-se o valor do cupom por ingresso. Cupons de 100% ficam de fora. Faturados internos entram só quando o desconto do produto está preenchido no negócio do Pipedrive (percentual ou valor); hoje esse campo não costuma vir.",
  "Códigos em circulação": "Quantidade de códigos de cupom diferentes usados em ingressos aprovados do evento.",
  "Vendas com cupom": "Ingressos aprovados que usaram algum cupom, de qualquer tipo.",
  "Hall da fama": "Soma das vendas pagantes de cada pessoa da equipe em todos os lotes, incluindo o atual. Aparecem os 3 primeiros; Ver mais abre o restante. Abaixo do nome, quantos lotes já encerrados a pessoa venceu. Empates ficam na mesma posição.",
  "Cupons em uso": "Todos os cupons usados no evento, do mais usado para o menos usado. O grupo é identificado pelo código (equipe, resgate, palestrantes, parceiros, faturados). A pizza mostra os 5 mais usados do filtro atual; o resto fica em Outros.",
  // Aba Comercial (definições do ds-summit)
  "Meta de ingressos pagantes":
    "Soma dos ingressos pagos na Sympla com os faturados internamente. Cortesias, expositores e patrocinadores não entram. A meta é cadastrada na tela Metas.",
  "Ritmo de vendas":
    "Ritmo atual: média de pagantes por dia útil nos últimos 10 dias úteis. Ritmo necessário: pagantes que faltam divididos pelos dias úteis até a véspera do evento (sem fins de semana e feriados). Se o atual for menor que o necessário, a venda está abaixo do ritmo.",
  "Ritmo necessário":
    "Ingressos pagantes que faltam divididos pelos dias úteis de hoje até a véspera do evento. Fins de semana e feriados nacionais ficam de fora.",
  "Ritmo atual":
    "Média de ingressos pagantes vendidos por dia útil nos últimos 10 dias úteis. Comparado com o ritmo necessário para indicar se a venda está no ritmo.",
  "Pagos na Sympla":
    "Pedidos aprovados na Sympla com qualquer valor acima de zero. Pendentes e cancelados não contam.",
  "Faturados internamente":
    "Ingressos vendidos pelo comercial fora da Sympla: negócios ganhos no Pipedrive com produto Ingressos Summit, pela quantidade e pelo valor do produto, na data em que o negócio foi ganho. O comercial só marca como ganho depois do contrato assinado ou da primeira parcela paga, então ganho conta como vendido, mesmo parcelado. Negócios abertos (negociação, fechamento) aparecem à parte e não contam. Forma de pagamento \"Bonificação / Permuta\" ou produto com valor zero no negócio conta como bonificado. Parcelado só é indicado. 2 ou mais ingressos Padrão no mesmo negócio contam como Grupo. O ano anterior não tem faturados internos. O resgate na Sympla (cupom de 100% com o nome da empresa, como COPAAZUL100) só dá baixa: não conta de novo.",
  Bonificados:
    "Ingressos aprovados sem valor: cortesias, expositores, patrocinadores, convidados e equipe. Ficam visíveis para controle de lotação, mas não somam na meta nem na receita.",
  "Ingressos pagantes":
    "Soma dos ingressos pagos na Sympla com os faturados internamente. Cortesias, expositores e patrocinadores não entram. Para acompanhar uma meta, defina-a na tela Metas.",
  "Pagantes acumulados": "Total de pagantes semana a semana desde a primeira venda. Com uma meta de pagantes na tela Metas, aparece também a trajetória até ela.",
  "Descontos concedidos (Comercial)": "Soma do que deixou de ser cobrado com cupons de desconto parcial. Cupons de 100% não entram. O % é sobre a receita bruta: receita paga + descontos. Faturados internos só entram quando o desconto do produto vem preenchido no Pipedrive.",
  "Receita acumulada x meta": "Receita dos pagantes somada semana a semana desde a primeira venda. A linha tracejada é a trajetória até a meta de receita definida na aba Metas, distribuída pelos dias úteis até o evento. A linha pontilhada é o evento anterior na mesma data, quando 'Comparar' está ligado.",
  "Receita acumulada": "Valor dos ingressos pagantes desde a abertura das vendas. Com a meta de receita da aba Metas, mostra o % atingido e quanto falta.",
  "Pagantes acumulados x meta":
    "Linha cheia: total de pagantes semana a semana. Linha tracejada: trajetória até a meta no dia do evento, distribuída por dias úteis.",
  "Ingressos emitidos":
    "Todos os ingressos do evento em três visões. Por categoria: contam na meta os pagos na Sympla (com ou sem cupom de desconto) e os faturados internamente; não contam as cortesias (cupom de 100% na Sympla) e os bonificados dos faturados, as credenciais (equipe, expositores, imprensa, mesmo que tenham valor), os gratuitos sem cupom e os pendentes. Por tipo: Padrão, VIP, combos, Grupo, Visita presencial e Credenciais, pelo nome na Sympla. Por lote: pagantes e receita de cada lote, com a meta do lote e o ano anterior.",
  "Composição":
    "Divide os ingressos emitidos entre os que contam na meta (pagos e faturados) e os bonificados (cortesias, credenciais e gratuitos).",
  "Vendas por dia útil":
    "Pagantes vendidos em cada um dos últimos 15 dias úteis. A linha marca o ritmo necessário. Barras abaixo da linha ficam em âmbar.",

  "Pagantes por tipo de ingresso": "Ingressos pagantes por categoria vendida. Nesta fase a meta é única e não separa VIP.",
  "Pagantes por região": "Região do comprador a partir do estado informado no formulário de inscrição da Sympla.",
  "Pagantes por perfil da empresa":
    "Perfil da empresa do comprador, informado no formulário de inscrição da Sympla. O formulário não pergunta o porte, então este é o dado mais próximo.",
  "Pagantes por forma de pagamento": "Como cada ingresso pagante foi pago: cartão, boleto, Pix e outros. Soma a Sympla e os faturados internos (campo Forma de pagamento do negócio no Pipedrive; Hotmart conta junto). Passe o mouse em cada forma para ver quanto veio da Sympla e do faturamento interno.",
  "Pagantes por origem (UTM)": "Origem da venda pela UTM do link usado na compra (utm_source). Maiúsculas e minúsculas contam como o mesmo canal, e \"ig\" e \"instagram\" são juntados em Instagram. Ao lado de cada origem está o valor pago pelos ingressos. Vendas sem UTM não aparecem; embaixo, o card diz quantos ingressos pagantes têm UTM.",
  Cupons:
    "Cupons usados nos ingressos emitidos, separados por grupo: Faturados (negócios ganhos no Pipedrive, por vendedor), Resgate (GANHADOR ou RESGATE), Palestrantes, Equipe CUPOLA (nome + 5, com 5% de desconto) e Parceiros e outros.",
  "Ranking da equipe":
    "Pagantes vendidos com o cupom de cada pessoa da equipe CUPOLA, lote a lote. Na linha do tempo, o lote atual (o da venda mais recente) abre sozinho; os lotes anteriores podem ser consultados e os próximos aparecem esmaecidos. Os 3 primeiros ficam em destaque e Ver mais abre os demais. Passe o mouse no nome para ver o cupom.",

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
    "Pagantes e receita de cada lote (Pré-venda, Lote 0, Lote 1…). Com meta do lote, aparece a marca da meta. Com a chave de comparação ligada, a linha tracejada mostra o mesmo lote do evento anterior, inteiro.",
  "Funil de KPIs":
    "Resultado de cada etapa do funil, do engajamento até a venda, semana a semana e comparado à meta de cada semana.",
  "Funil de Deals por Estágio": "Negócios do CRM em cada estágio do funil comercial.",

  // Meta Ads
  Campanhas: "Campanhas do Meta Ads com dados no período.",
  Investimento: "Valor investido nos anúncios desta plataforma no período.",
  "Investimento em mídia": "Soma do que foi investido no Meta Ads e no Google Ads no período.",
  "Investimento por ingresso": "Investimento em mídia dividido pelos ingressos pagantes do período (Sympla e faturados). Mostra quanto a mídia custou por venda, sem dizer que toda venda veio da mídia.",
  "Receita por real investido": "Receita dos ingressos pagantes do período dividida pelo investimento em mídia. 5x quer dizer R$ 5 em vendas para cada R$ 1 investido.",
  "Vendas com link parametrizado": "Parte dos ingressos pagos na Sympla que veio por um link com UTM. Quanto maior, melhor dá para saber qual canal trouxe a venda.",
  "Com link parametrizado": "Parte dos ingressos pagos na Sympla, no recorte escolhido, que veio por um link com UTM.",
  "Canais com venda": "Quantos canais diferentes trouxeram pelo menos uma venda.",
  "Vendas por canal": "Ingressos e valor por canal. O canal vem dos UTMs do link: links da equipe (medium timecupola), cupom sem link e faturados internos contam para a Equipe CUPOLA, e RD Station conta como E-mail marketing. Na aba Links, escolha um lote ou o evento todo para comparar com a meta de cada canal.",
  "Por link parametrizado": "Cada combinação de UTM (source, medium e campanha) usada nas compras, com ingressos e valor.",
  "Desempenho por campanha": "Uma linha por campanha, da que mais investiu para a que menos. Custo por compra é o investimento dividido pelas compras registradas.",
  "E-mails enviados": "Todos os e-mails desta edição do Summit enviados pelo RD Station, do mais recente para o mais antigo. Importante: no RD, o nome do e-mail precisa começar com a tag [SUM27] para aparecer aqui; sem a tag, o painel não reconhece como e-mail do Summit. A tag fica oculta na lista. Abertura e clique sobre os e-mails entregues.",
  "Desempenho de cada e-mail": "Uma coluna por e-mail do período, em ordem de envio. Acima da linha: abertura e clique (sobre os entregues). Abaixo: descadastro (sobre os entregues) e bounce (sobre os enviados). Cada métrica tem a própria escala, então a barra mais alta de cada cor, com contorno, é o e-mail que mais teve aquilo. Passe o mouse num e-mail para ver todos os números.",
  "Comparar dois e-mails": "Escolha dois e-mails para ver lado a lado quantos chegaram, abriram e clicaram.",
  "Taxa de Entrega": "E-mails que chegaram na caixa de entrada divididos pelos enviados que já têm retorno do RD Station. Bounce e descartados ficam de fora.",
  "Entrega dos e-mails": "O que aconteceu com cada e-mail enviado. Entregue: chegou na caixa. Bounce: voltou no envio (endereço inexistente, domínio inválido ou caixa cheia). Descartado: contato que o RD já inativou por bounces anteriores e que nem recebe o envio. Sem retorno: disparo recente, o RD ainda não mandou o relatório. Embaixo, quem recebeu e saiu da lista (descadastro ou spam), que não é problema de entrega.",
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
  "Taxa de Abertura": "Pessoas que abriram dividido pelos e-mails entregues no período, somando todas as campanhas.",
  "Taxa de Clique": "Pessoas que clicaram dividido pelos e-mails entregues no período, somando todas as campanhas.",

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

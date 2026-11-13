# Revisão dos papéis de acesso, eventos, ranking e cupons

## O que encontrei hoje

- **14 pessoas com acesso**: 7 Admin, 6 Visualizador, 1 Equipe de venda (leticia.pinguelli). Cada uma tem um único papel, sem duplicidade.
- **3 pessoas sem nenhum evento liberado**: keity.marques (Admin), kassia.calonassi (Visualizador) e leticia.pinguelli (Equipe). Admin e Visualizador já veem tudo pela regra nova; a Equipe ainda depende dessa liberação, por isso a Leticia pode ver zero. sempre libere todos os eventos pra todo mundo, assim ninguem nunca ve zerado
- **Ninguém tem cupom ligado à própria conta.** A tela da equipe identifica a pessoa logada só por esse vínculo, então o ranking não destaca ninguém. Esse é o principal motivo do "ranking genérico".
- **Troca de papel não aparece na hora**: o painel lê o papel uma vez ao entrar e não relê depois. A pessoa precisa sair e entrar de novo.
- A tabela de Cupons (56 pessoas) já segue o padrão NOME + letra + desconto e está correta na maioria.

## O que vou fazer

1. **Equipe vê todos os eventos**: a liberação por evento deixa de ser exigida para a Equipe ler ranking e compradores. Admin e Visualizador continuam vendo tudo. A Equipe continua sem acesso às outras áreas, no banco e na tela.
2. **Visualizador**: continua vendo tudo; Integrações, Configurações e criação/edição de metas ficam bloqueadas no banco e na tela (já é assim; vou revisar cada tabela e confirmar).
3. **Troca de papel imediata**: o painel passa a reler o papel ao voltar para a aba, a cada poucos minutos e quando o login é renovado, e limpa os dados guardados da sessão anterior. A pessoa vê o novo papel sem precisar sair.
4. **Ligar cada pessoa ao seu cupom**: a ligação passa a ser feita automaticamente pelo nome da conta (ex.: suellen.moreira → Suellen), usando a tabela de Cupons que já existe. Sem nova tabela paralela. Quando houver dúvida, a ligação não é feita e o caso vai para a lista de validação abaixo.
5. **Leitura do código do cupom**: regra única e testada que separa nome, letra e desconto (LETICIAA5 → Leticia, A, 5%; LETICIAB15 → Leticia, B, 15%). Cupons que não seguem o padrão ou que não têm dono aparecem num aviso para o admin em Configurações › Cupons.
6. **Ranking da pessoa logada**: destaca a posição, ingressos, vendas e status de quem entrou. Admin e Visualizador continuam vendo o ranking geral.
7. **Testes**: regras automáticas para os três papéis e para a leitura dos cupons; depois entro no painel como Admin, Visualizador e Equipe e confiro cada tela com dados reais.
8. atualize o nome dos apaieis só a nomenclatura 

## Precisa da sua validação antes de eu ligar

- **"Leticia B"** junta LETICIAC5, LETICIA10 e LETICIA15 e três nomes de vendedora (Bello, Pinguelli, Caetana), e está fora do ranking. A conta da leticia.pinguelli (Equipe) deveria ser a "Leticia B"? Se sim, ela aparece fora do ranking. ela não aparece no ranking, mas precisa ve-lo, a lista de comprados tbm deve ser. 
- **LETICIAB5**, citado no seu exemplo, não está cadastrado. A quem pertence? não. as 2 q existem são 

  |                                 |           |
  | ------------------------------- | --------- |
  | Letícia Ardigó da Trindade      | LETICIAA5 |
  | Leticia Caetana Bello Pinguelli | LETICIAC5 |

- **ERICA TIMECUPOLA** foge do padrão (sem desconto). Fica assim? conte como erica5, vou colocar a lista completa
- **Aline**: existem "Aline B", "Aline P" e "Aline Pavezi" (ALINEPAVEZI5). aline.pavezi seria "Aline P" ou "Aline Pavezi"? Pode ser a mesma pessoa duplicada.  


  |                          |              |
  | ------------------------ | ------------ |
  | Aline Borges de Sá       | ALINEB5      |
  | Aline Ellen Silva Pavezi | ALINEPAVEZI5 |
  | Aline Pereira dos Santos | ALINEP5      |

    

- Admins e Visualizadores que também vendem (ex.: Alice, Dioner, Greice, Renata, Rubens, Lorrainny, Kássia, Keity, Emillyn) também devem ser ligados aos seus cupons para aparecerem destacados? sim

## Detalhes técnicos

- `can_see_event`/`get_buyer_rows`/`get_buyer_events`: incluir `is_seller()` para leitura; políticas de escrita continuam só admin.
- Revisar políticas de todas as tabelas por papel (admin escreve; viewer lê; seller só ranking, compradores, cupons e vendas ganhas já definidas).
- Vínculo pessoa↔cupom: popular `team_coupons` a partir de `coupon_people` por correspondência exata do primeiro nome + letra do sobrenome; ambíguos ficam de fora. Tela de Configurações continua sendo o lugar para ajustar.
- `useAuth`: reler `user_roles` em `TOKEN_REFRESHED`, foco da janela e intervalo; limpar o cache de consultas ao mudar o papel.
- Parser de cupom puro em `src/lib/coupons.ts` com testes (letra x número, descontos variáveis).  
  
  


  |                                               |              |
  | --------------------------------------------- | ------------ |
  | Adilton Jarshi Fernandes                      | ADILTON5     |
  | Alice dos Santos Borges                       | ALICE5       |
  | Aline Borges de Sá                            | ALINEB5      |
  | Aline Ellen Silva Pavezi                      | ALINEPAVEZI5 |
  | Aline Pereira dos Santos                      | ALINEP5      |
  | Altair de Jesus Canuto Junior                 | ALTAIR5      |
  | Amanda Carolina Peres Mancio                  | AMANDA5      |
  | Ana Carolina de Souza                         | ANA5         |
  | Andressa dos Santos Andrade                   | ANDRESSA5    |
  | Angela Carolina Matos Rodrigues               | ANGELA5      |
  | Camila Silva Gasparini                        | CAMILA5      |
  | Catiane Bottega                               | CATIANE5     |
  | Dario de Toledo Piza FIlho                    | DARIO5       |
  | Dioner Segala                                 | DIONER5      |
  | Eduardo Furtado Prieto                        | EDUARDO5     |
  | Elaíny Carmona Pereira                        | ELAINY5      |
  | Emillyn Helen Machado da Silva                | EMILLYN5     |
  | Erica Rocha de Souza                          | ERICA        |
  | Erick Willian Santos de Sant'Ana              | ERICK5       |
  | Fabiana Fortes de Abreu                       | FABIANA5     |
  | Fabio Toshio Kawashima                        | FABIO5       |
  | Gabriela da Silva Rodrigues                   | GABRIELA5    |
  | Gabrielle Cristina de Paula Xavier            | GABRIELLE5   |
  | Giuliano Marcelo Ferraz Maximiano de Oliveira | GIULIANO5    |
  | Greice Cristiane Nardelli                     | GREICE5      |
  | Guilherme Damiani                             | GUILHERMED5  |
  | Guilherme Hilgenstieler Faria                 | GUILHERMEH5  |
  | Isabelle Saldanha Reganhã                     | ISABELLE5    |
  | Janile da Silva Ramos Chagas da Silva         | JANILE5      |
  | Jaqueline Oliveira Barbosa                    | JAQUELINE5   |
  | Julia Lazzarotto Orsioli                      | JULIA5       |
  | Kamila Freitas da Silva                       | KAMILA5      |
  | Kariny Martins Fagundes de Souza              | KARINY5      |
  | Kássia Calonassi de Oliveira da Silva         | KASSIA5      |
  | Keity Cristina Marques da Silva               | KEITY5       |
  | Letícia Ardigó da Trindade                    | LETICIAA5    |
  | Leticia Caetana Bello Pinguelli               | LETICIAC5    |
  | Lorrainny Eduardo da Silva Alves              | LORRAINNY5   |
  | Mariana Corazza dos Santos                    | MARIANA5     |
  | Mateus Toignal de Oliveira                    | MATEUS5      |
  | Matheus Henrique Pinheiro                     | MATHEUSH5    |
  | Matheus Paiva Delgado                         | MATHEUSP5    |
  | Michel Oliveira do Prado                      | MICHEL5      |
  | Pollyana Ferrari Perazzolo                    | POLLYANA5    |
  | Reinilton Sousa Gomes                         | REINILTON5   |
  | Renata Martins Soares Maciel                  | RENATA5      |
  | Robson Godoy da Rosa                          | ROBSON5      |
  | Rodrigo Werneck Seixas                        | RODRIGO5     |
  | Rubens Gabriel Pereira da Luz                 | RUBENS5      |
  | Samara Tavares Camargo                        | SAMARA5      |
  | Suellen de Cassia Moreira                     | SUELLEN5     |
  | Suzana Beatriz Segalla e Silva                | SUZANA5      |
  | Taís Vieira                                   | TAIS5        |
  | Tauan Filipe Domingues da Silva               | TAUAN5       |
  | Thais Pereira Berlim                          | THAISP5      |
  | Vivian de Sousa Carvalho                      | VIVIAN5      |
  | &nbsp;                                        | &nbsp;       |

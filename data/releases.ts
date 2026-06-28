export const CURRENT_VERSION = '1.92.0';

export interface Release {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASES: Release[] = [
  {
    version: '1.92.0',
    date: '2026-06-28',
    changes: [
      'Ajuste no componentes especiais',
    ],
  },
  {
    version: '1.91.0',
    date: '2026-06-28',
    changes: [
      'Coerência de palpites no Regulamento 2: os 5pts de "Classificados 2ª Fase" (Oitavas, Quartas, Semis) só são concedidos se o palpite do jogo knockout correspondente (da fase anterior) existe e é coerente com a escolha de quem avança',
      'Se o usuário não palpitar no jogo, os 5pts não são concedidos (obrigatório palpitar em ambos)',
      'Se o palpite do jogo indica vitória do adversário, os 5pts não são concedidos (incoerente)',
      'Se o palpite do jogo é empate, qualquer um dos dois times é coerente (empate libera qualquer escolha)',
      'Pontos dos jogos permanecem inalterados — a coerência afeta apenas os 5pts do especial',
    ],
  },
  {
    version: '1.90.0',
    date: '2026-06-28',
    changes: [
      'Banner de palpites pendentes do Regulamento 2 agora sempre exibe cor amber e lista detalhada dos jogos não palpitados da fase atual',
      'Alertas de especiais (Classificados e Maior Diferença) agora baseados na fase que está prestes a começar, não mais em janela de 5 dias',
      'Adicionado alerta para "Maior Diferença - 16 Avos" no banner de pendências',
    ],
  },
  {
    version: '1.89.0',
    date: '2026-06-28',
    changes: [
      'Corrigida exibição prematura do item "Maior Diferença de Gols - 16 Avos de Final" no modal de auditoria: agora só aparece depois que o primeiro jogo da fase começa',
    ],
  },
  {
    version: '1.88.0',
    date: '2026-06-28',
    changes: [
      'Corrigida exibição prematura do item "Maior Diferença de Gols - 16 Avos de Final" no modal de auditoria: agora só aparece depois que o primeiro jogo da fase começa',
    ],
  },
  {
    version: '1.87.0',
    date: '2026-06-27',
    changes: [
      'Melhoria no layout do badge de fase nos cabeçalhos de data: textos abreviados (16 Avos, Oitavas, Quartas, Semis) e estilo maior para evitar quebras estranhas',
    ],
  },
  {
    version: '1.86.0',
    date: '2026-06-27',
    changes: [
      'Melhorias para o Regulamento 2, cálculo de pontos para classificados nas oitavas de final',
    ],
  },
  {
    version: '1.85.0',
    date: '2026-06-27',
    changes: [
      'Melhoria no componente CLASSIFICADOS 2º FASE (Regulamento 2)',
    ],
  },
  {
    version: '1.84.0',
    date: '2026-06-25',
    changes: [
      'Corrigido bloqueio de fases no card "Maior Diferença de Gols por Fase": todas as fases (incluindo grupos) agora travam quando o primeiro jogo da fase começa',
      'Palpites dos outros usuários mostram "Oculto" até o primeiro jogo da fase começar, mantendo fair play',
      'Adicionado suporte a LAST_32 e LAST_16 nos nomes de fase da API para mapeamento correto dos jogos',
    ],
  },
  {
    version: '1.83.0',
    date: '2026-06-25',
    changes: [
      'No Regulamento 2, cada fase do mata-mata agora trava de forma independente: palpites só ficam bloqueados quando o primeiro jogo daquela fase começa',
      'O card "O que a galera acha" continua escondendo os palpites até a fase começar, garantindo fair play',
      'Agora a fase do jogo aparece como uma etiqueta discreta ao lado da data nos cabeçalhos da lista de jogos',
      'Suporte aos nomes de fase oficiais da API (LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, etc.)',
    ],
  },
  {
    version: '1.82.0',
    date: '2026-06-24',
    changes: [
      'O card "O que a galera acha" agora sempre ordena os palpites por pontuação, do maior para o menor, em qualquer estado do jogo',
    ],
  },
  {
    version: '1.81.0',
    date: '2026-06-24',
    changes: [
      'Agora o botão de palpite avisa quando você ainda não salvou: fica amarelo com "Salvar" enquanto você edita e verde com "Salvo" depois de confirmar',
    ],
  },
  {
    version: '1.80.0',
    date: '2026-06-24',
    changes: [
      'Nova fase de Dezesseis Avos de Final (32 seleções) disponível nos palpites de Classificação da 2ª Fase, exibida apenas nas competições que possuem essa fase',
      'Cada acerto de classificado nos Dezesseis Avos vale 5 pontos',
      'Banner de pendências agora alerta sobre palpites de Dezesseis Avos não preenchidos',
      'Admin pode cadastrar o resultado oficial dos classificados de Dezesseis Avos',
      'Correção dos rótulos das fases: Dezesseis Avos (32 seleções) e Oitavas de Final agora aparecem corretamente',
    ],
  },
  {
    version: '1.79.0',
    date: '2026-06-22',
    changes: [
      'Melhoria no placar ao vivo: agora depende exclusivamente da API football-data.org, garantindo consistência oficial',
    ],
  },
  {
    version: '1.78.0',
    date: '2026-06-22',
    changes: [
      'Novo status DELAYED para jogos paralisados: admin pode marcar jogos como PARALIZADO no painel',
      'Jogos DELAYED aparecem na seção Jogos Ao Vivo com badge amber e ícone de exclamação',
      'Comportamento igual ao LIVE: bloqueia palpites, placar vermelho, timeline e estatísticas ativas',
    ],
  },
  {
    version: '1.77.0',
    date: '2026-06-22',
    changes: [
      'Adicionada coluna de gols do artilheiro na tabela de palpites do grupo (Regulamento 1)',
    ],
  },
  {
    version: '1.75.0',
    date: '2026-06-22',
    changes: [
      'Pontos de palpites especiais no Regulamento 1 só são calculados após a final da copa ser finalizada',
      'Modal de auditoria de pontos agora aplica a mesma regra para o Regulamento 1',
    ],
  },
  {
    version: '1.74.0',
    date: '2026-06-22',
    changes: [],
  },
  {
    version: '1.73.0',
    date: '2026-06-22',
    changes: [
      'Nova funcionalidade de Enquetes: responda perguntas que aparecem ao abrir o app',
      'Enquetes com escolha única ou múltipla escolha, em modal para você responder',
      'Depois de votar, a enquete não aparece mais para você',
      'Resultados anônimos: ninguém vê em qual opção você votou',
      'Nova aba Enquetes no menu admin, com filtro por status e barra de participação',
      'Enquetes podem ser direcionadas a todos ou apenas a participantes do Regulamento 1 e/ou Regulamento 2',
      'Cada enquete aparece somente para quem já estava cadastrado quando ela foi criada',
    ],
  },
  {
    version: '1.72.0',
    date: '2026-06-21',
    changes: [
      'Melhoria no minuto a minuto',
    ],
  },
  {
    version: '1.71.0',
    date: '2026-06-21',
    changes: [
      'Melhoria na regra no calculo para regra de classificados do Regulamento 2',
    ],
  },
  {
    version: '1.70.0',
    date: '2026-06-21',
    changes: [
      'Card de Classificados dos Grupos agora mostra seu próprio palpite na lista com badge VOCÊ para facilitar comparação',
    ],
  },
  {
    version: '1.69.0',
    date: '2026-06-21',
    changes: [
      'Melhoria na Regra de calculo para classificados da fase de grupos para o Regulamento 2',
    ],
  },
  {
    version: '1.68.0',
    date: '2026-06-20',
    changes: [
      'Agora rola uma comemoracao na tela quando sai GOL ao vivo: uma bola entra no gol e a animacao some sozinha',
      'Cartoes amarelos e vermelhos ao vivo tambem ganharam animacao na hora do lance',
      'As animacoes so aparecem com o app aberto no momento do lance, sem repetir jogadas antigas',
      'No painel do admin, a nova aba "Animacoes" permite pre-visualizar e ligar ou desligar cada animacao para todos os usuarios',
    ],
  },
  {
    version: '1.67.0',
    date: '2026-06-20',
    changes: [
      'Troca de grupo pelo usuario, renderiza todo o app.',
    ],
  },
  {
    version: '1.66.0',
    date: '2026-06-20',
    changes: [
      'Melhorias no header do aplicativo',
    ],
  },
  {
    version: '1.65.0',
    date: '2026-06-20',
    changes: [
      'Os cards dos jogos agora mostram a "forma recente" de cada time: uma faixa com os últimos resultados na competição, em verde (vitória), cinza (empate) e vermelho (derrota)',
      'Toque na faixa ou no nome do time para abrir os detalhes dos últimos jogos, com adversário, placar, data e mando de campo',
      'A forma recente aparece em jogos agendados e ao vivo',
    ],
  },
  {
    version: '1.64.0',
    date: '2026-06-20',
    changes: [
      'Melhoria no score do minuto a minuto',
    ],
  },
  {
    version: '1.63.0',
    date: '2026-06-20',
    changes: [
      'Melhorias ao atualizar e fazer refresh no aplicativo',
    ],
  },
  {
    version: '1.62.0',
    date: '2026-06-20',
    changes: [
      'Corrigida a exibição de substituições na timeline ao vivo: agora o jogador que entra aparece em destaque com seta verde para cima, e o jogador que sai aparece abaixo com seta vermelha para baixo',
    ],
  },
  {
    version: '1.61.0',
    date: '2026-06-19',
    changes: [
      'Na seção "Jogos Anteriores" você pode alternar a ordenação dos jogos encerrados entre "Por grupo" e "Por dia" (do dia mais recente para o mais antigo)',
    ],
  },
  {
    version: '1.60.0',
    date: '2026-06-19',
    changes: [
      'Auditoria de pontos exibe os artilheiros oficiais resolvidos a partir da lista de jogadores da competição, incluindo múltiplos artilheiros empatados.',
    ],
  },
  {
    version: '1.59.9',
    date: '2026-06-18',
    changes: [
      'A timeline de jogos ao vivo agora exibe os lances mais recentes primeiro (ordem decrescente).',
    ],
  },
  {
    version: '1.59.8',
    date: '2026-06-18',
    changes: ['Ajuste de layout no header da página de STATS.'],
  },
  {
    version: '1.59.7',
    date: '2026-06-18',
    changes: ['STATS podem ser visto para outros usuarios do grupo.'],
  },
  {
    version: '1.59.6',
    date: '2026-06-18',
    changes: ['Correção para carracamento mais performatico de dados do banco.'],
  },
  {
    version: '1.59.5',
    date: '2026-06-18',
    changes: ['Correção para carracamento mais performatico de dados do banco.'],
  },
  {
    version: '1.59.4',
    date: '2026-06-18',
    changes: ['Ajustes de layout adaptativo'],
  },
  {
    version: '1.59.3',
    date: '2026-06-18',
    changes: [
      'Corrigido cálculo de zebra no menu de stats para Regulamento 1 (agora usa lógica real com rankings dos times)',
      'Adicionado contador de "Acertou Sozinho" no menu de stats para Regulamento 2 (placares isolados)',
      'Removido componente UserStats.tsx (não estava sendo usado)',
    ],
  },
  {
    version: '1.59.2',
    date: '2026-06-17',
    changes: [
      'Leaderboard: grupos com mais de 8 participantes destacam os 4 últimos colocados (Z4) com fundo vermelho e borda lateral vermelha',
      'Top 3 do ranking ganham fundos distintos em tons escuros: ouro (1º), prata (2º) e bronze (3º)',
    ],
  },
  {
    version: '1.59.1',
    date: '2026-06-17',
    changes: [
      'Os gols na linha do tempo dos jogos ao vivo agora aparecem com a bola oficial da Copa do Mundo 2026 no lugar do emoji de bola',
    ],
  },
  {
    version: '1.59.0',
    date: '2026-06-17',
    changes: [
      'Cálculo do artilheiro no Regulamento 1 é feito apenas no final da Copa (valor fixo definido pelo admin)',
    ],
  },
  {
    version: '1.58.2',
    date: '2026-06-17',
    changes: [
      'Ajuste no cabeçalho do card de jogo: a marcação de "zebra" não fica mais colada no horário em telas estreitas, com um espaçamento melhor entre data, horário e a etiqueta de zebra',
    ],
  },
  {
    version: '1.58.1',
    date: '2026-06-17',
    changes: [
      'Pequeno ajuste visual: o grupo do jogo (ex: "Grupo I") agora aparece centralizado acima dos times no card, evitando que fique apertado com a marcação de zebra em telas estreitas',
    ],
  },
  {
    version: '1.58.0',
    date: '2026-06-16',
    changes: [
      'Novo painel de estatísticas nos jogos ao vivo: toque no ícone de gráfico no card do jogo para ver posse de bola, finalizações, escanteios, faltas, cartões e passes de cada time, lado a lado',
    ],
  },
  {
    version: '1.57.0',
    date: '2026-06-16',
    changes: ['Melhorias no layout'],
  },
  {
    version: '1.56.0',
    date: '2026-06-16',
    changes: [
      'A linha do tempo "minuto a minuto" dos jogos ao vivo agora mostra também as substituições, com quem entrou e quem saiu de campo',
      'A linha do tempo passou a exibir as revisões do VAR, como gols anulados e pênaltis confirmados',
    ],
  },
  {
    version: '1.55.0',
    date: '2026-06-16',
    changes: [
      'Corrigido o card de palpite: ao editar um palpite antes do jogo começar, o placar digitado não some mais sozinho enquanto você decide — sua edição é mantida até você salvar',
      'Agora o card de cada jogo mostra a qual grupo a partida pertence (ex: "Grupo I"), com o nome exibido de forma clara e legível',
    ],
  },
  {
    version: '1.53.0',
    date: '2026-06-16',
    changes: [
      'Cálculo de pontos do artilheiro no Regulamento 2 agora usa o identificador oficial do jogador, garantindo mais precisão e permitindo múltiplos artilheiros empatados',
    ],
  },
  {
    version: '1.52.0',
    date: '2026-06-16',
    changes: [
      'Ajuste para admin poder fazer o save dos artilheiros via painel em caso da api falhar',
    ],
  },
  {
    version: '1.51.0',
    date: '2026-06-16',
    changes: [
      'Adicionado campo topScorerPlayerIds nas competições para armazenar múltiplos artilheiros empatados em primeiro lugar',
      'Campo preenchido automaticamente durante o sync de artilheiros da Football Data API',
    ],
  },
  {
    version: '1.50.0',
    date: '2026-06-15',
    changes: ['Correçao de versionamento.'],
  },
  {
    version: '1.48.0',
    date: '2026-06-15',
    changes: [
      'Rank do Regulamento 2 agora separa pontos de jogos e pontos especiais (torneio + extra phase)',
      'Labels compactas exibidas abaixo do total de pontos nas views Ranking e Detalhes',
    ],
  },
  {
    version: '1.47.0',
    date: '2026-06-15',
    changes: [
      'Admin pode importar palpites de um usuário de outro grupo ao adicioná-lo em um grupo existente (Regulamento 1)',
      'Modal de importação exibe grupos elegíveis com mesma competição e mesmo regulamento',
      'Importa palpites de jogos e palpites especiais (campeão, artilheiro, melhor jogador, melhor goleiro)',
      'Palpites originais nunca são alterados — apenas clonados para o novo grupo',
    ],
  },
  {
    version: '1.46.2',
    date: '2026-06-15',
    changes: ['Failback para Classificados do Grupo quando API falha'],
  },
  {
    version: '1.46.1',
    date: '2026-06-15',
    changes: [
      'Simplificado sync do live-details (api-sports): removido lock próprio, agora usa gate simples dentro do lock principal do sync',
      'Adicionadas opções de intervalo para o admin: 40s, 45s, 50s e 55s (além de 30s e 1min)',
      'Default do intervalo de live-details alterado de 5min para 50s',
    ],
  },
  {
    version: '1.45.0',
    date: '2026-06-14',
    changes: [
      'Adicionado modal "Sobre" ao clicar no ícone do bolão no header',
      'Modal exibe informações sobre o projeto, desenvolvedores e infraestrutura',
      'Inclui chave Pix para doações com botão de copiar',
    ],
  },
  {
    version: '1.44.1',
    date: '2026-06-14',
    changes: [
      'Correção: evita chamadas duplicadas à API de dados ao vivo entre abas, economizando cota',
    ],
  },
  {
    version: '1.44.0',
    date: '2026-06-14',
    changes: [
      'Relógio ao vivo sincronizado minuto a minuto: exibe apenas os minutos sem segundos (ex: AO VIVO - 55\u0027)',
      'Removido o tick local do relógio ao vivo que fazia o tempo adiantar',
      'Simplificada a exibição do placar ao vivo: removido o temporizador central abaixo dos gols',
    ],
  },
  {
    version: '1.43.0',
    date: '2026-06-14',
    changes: [
      'Ajuste nos palpites especiais para contabilizar maior diferença de gols por fase automaticamente (Regulamento 2)',
    ],
  },
  {
    version: '1.42.0',
    date: '2026-06-14',
    changes: [
      'O minuto a minuto agora pode ser recolhido ou expandido por um botão no card do jogo: abre sozinho durante a partida ao vivo, recolhe ao terminar e pode ser reaberto para rever os lances de jogos finalizados',
      'A lista de lances do minuto a minuto ganhou rolagem própria e não estica mais o card em jogos com muitos gols e cartões',
    ],
  },
  {
    version: '1.41.0',
    date: '2026-06-14',
    changes: [
      'Barra de navegação inferior agora respeita a área segura do aparelho: em celulares com tela curva, os rótulos "Jogos" e "Stats" não ficam mais cortados na borda',
    ],
  },
  {
    version: '1.40.0',
    date: '2026-06-14',
    changes: [
      'Header mobile: Pontos e Rank exibidos com ícones em duas linhas para economizar espaço',
      'Header desktop: mantém labels "Rank" e "Pontos" junto com os ícones',
    ],
  },
  {
    version: '1.39.0',
    date: '2026-06-14',
    changes: [
      'Ajustes de layout para mostrar Pontos e Rank no header em dispositivos móveis',
      'Botão "Sair da Conta" movido para dentro do modal de Configurações (clicar no avatar)',
    ],
  },
  {
    version: '1.38.0',
    date: '2026-06-14',
    changes: [
      'A artilharia agora mostra todos os goleadores da competição, e não apenas os 10 primeiros',
      'Corrigidas as bandeiras de alguns times que não apareciam na lista de artilheiros',
    ],
  },
  {
    version: '1.37.0',
    date: '2026-06-14',
    changes: [
      'Card "O que a galera acha" abre automaticamente quando jogo está ao vivo',
      'Ordenação por pontos (maior para menor) no card "O que a galera acha" durante jogos ao vivo',
    ],
  },
  {
    version: '1.36.0',
    date: '2026-06-14',
    changes: ['Implementação de minuto a minuto com detalhes dos gols marcados e stats de cartões'],
  },
  {
    version: '1.35.4',
    date: '2026-06-13',
    changes: [
      'Melhoria do Rank conforme solicitação dos usuários: agora o ranking usa standard competition ranking (1,1,3,4...) em vez de dense ranking (1,1,2,3...), garantindo consistência entre a lista de ranking, a aba de detalhes e o badge do header',
    ],
  },
  {
    version: '1.35.3',
    date: '2026-06-12',
    changes: [
      'No detalhamento dos seus pontos (auditoria), agora aparece quanto você ganhou de bônus de zebra em cada jogo, igual já aparecia no card da partida',
    ],
  },
  {
    version: '1.35.2',
    date: '2026-06-12',
    changes: ['Agora você pode ver a versão do app no topo da tela'],
  },
  {
    version: '1.35.1',
    date: '2026-06-12',
    changes: [
      "Corrigido o cálculo de pontos dos palpites dos amigos em 'O que a galera acha', que mostrava pontos a mais em jogos com zebra",
    ],
  },
  {
    version: '1.35.0',
    date: '2026-06-12',
    changes: [
      "Nova seção 'Jogos Ao Vivo' no topo da página de Jogos: as partidas em andamento aparecem juntas com um indicador pulsante, em destaque, não importa a data",
      "Corrigido o problema em que jogos que começavam à noite e passavam da meia-noite sumiam dos 'Jogos do Dia' e iam parar nos 'Jogos Anteriores'",
      'Classificação e Artilharia agora tratam empates de forma justa: quem está empatado divide a mesma posição e o próximo colocado vem logo em seguida (ex: 1º, 1º, 2º)',
    ],
  },
  {
    version: '1.34.0',
    date: '2026-06-11',
    changes: [
      'Modal de atualização obrigatória agora aparece automaticamente quando o background sync detecta versão desatualizada',
      'Background sync agora verifica versão do app antes de fazer sync com API externa, evitando operações problemáticas com código antigo',
      'Adicionado refetchSystemConfig no DatabaseContext para forçar atualização do config quando necessário',
    ],
  },
  {
    version: '1.33.0',
    date: '2026-06-11',
    changes: [
      'Artilharia: jogadores com o mesmo número de gols agora têm o mesmo rank (ex: dois jogadores com 1 gol ambos aparecem como 1º)',
      'Banner de palpites pendentes agora considera jogos nas próximas 24h em vez de apenas jogos de hoje',
      'Mensagem de palpites pendentes atualizada para mostrar apenas os jogos que faltam palpitar',
    ],
  },
  {
    version: '1.32.0',
    date: '2026-06-11',
    changes: [
      "Quando uma nova versão do app é publicada, aparece um aviso 'Nova versão disponível' com um botão para atualizar — assim você não fica preso numa versão antiga sem perceber",
    ],
  },
  {
    version: '1.31.0',
    date: '2026-06-11',
    changes: [
      'Tabela de classificação das competições voltou a refletir os resultados atualizados — antes podia ficar travada com valores antigos ou zerados',
      'Atualização de pontos e resultados ficou bem mais rápida',
    ],
  },
  {
    version: '1.30.0',
    date: '2026-06-11',
    changes: ["Melhorada a responsividade do card 'O que a galera acha' em telas pequenas"],
  },
  {
    version: '1.29.0',
    date: '2026-06-10',
    changes: [
      'Quando o admin ajusta o placar de um jogo, a atualização automática agora aguarda só 2 minutos antes de seguir o resultado oficial — antes eram 5 minutos',
    ],
  },
  {
    version: '1.28.0',
    date: '2026-06-09',
    changes: [
      'Placar de mata-mata exibe Tempo Regular, Prorrogação e Pênaltis em seções separadas',
      "Pontuação do bônus 'Quem se classifica' agora concedida corretamente para vitórias na prorrogação",
      'Edição inline de placar (tempo regular, prorrogação e pênaltis) diretamente no card de partida admin',
      'Auditoria de palpites mostra sub-linhas detalhadas por fase do jogo (tempo regular, prorrogação, pênaltis)',
      "Estatísticas exibem sub-linhas 'Regular', 'Prorrog.' e 'Pên.' nos cards de previsão",
      'Chaveamento do torneio exibe placar regular como principal, com delta de prorrogação e placar agregado',
      'Colunas de placar em banco de dados separadas por fase do jogo para precisão no cálculo de pontos',
    ],
  },
  {
    version: '1.27.0',
    date: '2026-06-09',
    changes: [
      'Correção no carregamento de palpites em grandes bolões',
      'Agora todos os palpites são carregados corretamente, mesmo com muitos participantes',
      'Melhorias na sincronização de dados com o banco',
    ],
  },
  {
    version: '1.26.0',
    date: '2026-06-08',
    changes: [
      "Nova aba 'Artilharia' no menu inferior com artilheiros ordenados por gols e assistências",
      'Artilheiros sincronizados automaticamente a cada sync — sem chamadas extras à API',
      'Autocomplete de jogadores nos Palpites Especiais: busca por nome com dropdown e foto do escudo',
      'Palpites de artilheiro, melhor jogador e melhor goleiro agora identificam o jogador com precisão',
      'Catálogo completo dos elencos da Copa disponível para previsões e estatísticas',
    ],
  },
  {
    version: '1.25.0',
    date: '2026-06-08',
    changes: [
      'Pontuação de mata-mata no R1 agora considera apenas o Tempo Regular (90 min) — prorrogação não afeta a pontuação',
      'Correção na Regra 3 do R1: empate previsto corretamente dá 5 pts (resultado) e não mais 7 pts (diferença)',
      "Seletor 'Quem avança nas penalidades' renomeado para 'Quem se classifica?' em toda a interface",
      "Cards de partida no R1 exibem o placar do Tempo Regular como principal, com bloco 'Após Prorrogação' quando aplicável",
    ],
  },
  {
    version: '1.24.0',
    date: '2026-06-07',
    changes: ['Melhorias dos intervalos de sincronização'],
  },
  {
    version: '1.23.0',
    date: '2026-06-07',
    changes: [
      'Lock atômico no banco de dados para evitar race conditions entre múltiplas instâncias',
      'Sync agora usa PostgreSQL RPC para exclusão mútua garantida',
      "Toast azul 'SINCRONIZANDO' só aparece após lock adquirido com sucesso",
      'Sync bloqueado por outra instância agora é silencioso (sem toast de erro)',
      'Cooldown local usa valor configurado pelo admin (sync_interval_ms)',
      'Jitter inicial removido (não necessário com lock atômico)',
      'Correção: lock usa tabelas v2_ com prefixo correto',
      'Migrações 0025 e 0026 para sync_locked_at e função RPC acquire_sync_lock',
    ],
  },
  {
    version: '1.22.0',
    date: '2026-06-07',
    changes: [
      'Otimização do mecanismo de sync para respeitar rate limit da API (20 req/min)',
      'Jitter no boot: checagens se espalham entre abas para evitar corridas',
      'Cooldown local reduzido de 5min para 1min (mais responsivo)',
      'Intervalo de checagem dinâmico: proporcional ao tempo configurado pelo admin',
      'Default de sync_interval_ms atualizado para 20s (otimizado para versão premium)',
    ],
  },
  {
    version: '1.21.0',
    date: '2026-06-04',
    changes: [
      'Campos de penalties separados no modelo de Match',
      'Placar de penalties armazenado em colunas dedicadas',
      'Melhorias no sync de dados de mata-mata',
    ],
  },
  {
    version: '1.20.0',
    date: '2026-06-04',
    changes: [
      'Exibição de detalhes de pênaltis em jogos de mata-mata',
      'Placar de penalties e vencedor destacados',
      'Campo score JSON adicionado para dados completos',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-06-04',
    changes: [
      'Traduções de grupos e fases para português',
      'Email exibido no modal de perfil',
      'Ordenação melhorada de partidas passadas',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-06-03',
    changes: [
      'Correção: resultado de mata-mata agora ignora penalties',
      'Placar calculado como tempo regular + prorrogação',
      'Campos de penalties armazenados separadamente',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-06-02',
    changes: [
      'Banner agora mostra palpites especiais pendentes',
      'Alerta para campeão, artilheiro e classificações',
      'Janela de alerta para previsões de fases extras',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-06-01',
    changes: [
      'Banner de palpites pendentes na página de partidas',
      'Alerta de bloqueio de fase no Regulamento 2',
      'Contagem regressiva para fechamento de palpites',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-06-01',
    changes: [
      'Lock de fase no Regulamento 2',
      'Palpites bloqueados quando fase da competição inicia',
      'Melhorias nos testes de pontuação',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-06-01',
    changes: [
      'Breakdown detalhado de pontuação no leaderboard',
      'Visualização de placares exatos, diferença e resultado',
      'Contagem de bônus zebra e placar-sozinho',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-06-01',
    changes: [
      'Correção: login não sobrescreve mais nome e avatar editados',
      'Perfil do usuário agora preservado ao fazer login novamente',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-06-01',
    changes: [
      'Auto-sync configurável por competição (pausar Brasileirão sem afetar a Copa)',
      'Card dedicado para configuração do Bônus Zebra',
      'Painel administrativo reorganizado para melhor clareza',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-05-31',
    changes: [
      'Correção no cálculo de pontos do Regulamento 2',
      'Pontos agora calculados em tempo real para placar-sozinho',
      'Melhorias no sistema de polling de atualizações',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-05-31',
    changes: [
      'Seletor visual de avatares no modal de perfil',
      'Avatares gerados automaticamente com melhor qualidade',
      'Correções no cálculo de pontos de especiais',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-05-31',
    changes: [
      'Editar nome e foto de perfil no mesmo modal',
      'Avatar regenerado automaticamente ao mudar nome',
      'Validação de nome vazio ao salvar perfil',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-05-31',
    changes: [
      'Pontuação ao vivo atualizada em tempo real no leaderboard',
      'Leaderboard recarrega dados automaticamente ao abrir a aba',
      'Simplificação de políticas RLS para melhor performance',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-05-31',
    changes: [
      'Replicar palpites entre grupos com mesma competição e regulamento',
      "Botão 'Copiar Palpites' disponível na página de partidas",
      'Seleção de grupo de destino com validação automática',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-05-26',
    changes: [
      'Dados de artilheiro agora são buscados automaticamente da Football Data API',
      'Campeão da competição é detectado automaticamente via API quando disponível',
      'Time com mais gols em um jogo único calculado automaticamente',
      'Time com mais gols sofridos em um jogo único calculado automaticamente',
      'Regulamento atualizado com novas regras de blocos de fases',
      'Correções de layout em cards e modais',
      'Auditoria de pontos disponível clicando em cada usuário no menu RANK',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-05-16',
    changes: [
      'Palpites de outros participantes agora aparecem corretamente para todos os membros do grupo',
      'Pontuação dos grupos não é mais zerada durante a sincronização de resultados',
      'Pull-to-Refresh disponível em todas as abas (Partidas, Classificação, Torneio, Stats)',
      'Pontos dos palpites gravados corretamente no banco após sincronização — Histórico de Palpites exibe valores corretos',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-16',
    changes: [
      'Palpites dos outros participantes não exibem mais o próprio usuário na lista',
      'Badge colorido mostra quantos pontos cada palpite está rendendo em jogos ao vivo ou finalizados',
      'Modal do avatar exibe Pontos e Rank do usuário, visível também no mobile',
      'Pull-to-Refresh: puxe a tela para baixo para atualizar partidas e palpites direto do banco',
      'Palpites Especiais agora são por grupo — cada grupo tem sua própria Seleção Campeã, Artilheiro, etc.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-12',
    changes: [
      "Dropdown 'Seleção Campeã' exibe apenas os times da competição ativa, carregados do banco de dados",
      "Botão de palpites especiais exibe 'Salvar Palpites Especiais' quando já existem palpites guardados",
      "Badge 'Salvo' aparece no cabeçalho do card de palpites especiais quando há palpites registados",
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-11',
    changes: [
      'Bônus Zebra agora proporcional à diferença de ranking FIFA (sem threshold fixo)',
      'Tag ZEBRA nos cards exibe o bônus potencial em pontos (+1pt a +5pts)',
      'Fórmula revisada: bônus começa em diff ≥ 34, escala suave até +5pts',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-11',
    changes: [
      'Ranking FIFA exibido nos cards de partida',
      'Limite de ranking para bônus zebra agora reflete a configuração do grupo',
      "Modal 'O que há de novo' exibido após cada atualização",
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-11',
    changes: [
      'Cadastro e entrada em grupos corrigidos',
      'Pontuação agora sincroniza corretamente com o banco de dados',
    ],
  },
];

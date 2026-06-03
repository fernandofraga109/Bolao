export const CURRENT_VERSION = "1.18.0";

export interface Release {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASES: Release[] = [
  {
    version: "1.18.0",
    date: "2026-06-03",
    changes: [
      "Correção: resultado de mata-mata agora ignora penalties",
      "Placar calculado como tempo regular + prorrogação",
      "Campos de penalties armazenados separadamente",
    ],
  },
  {
    version: "1.17.0",
    date: "2026-06-02",
    changes: [
      "Banner agora mostra palpites especiais pendentes",
      "Alerta para campeão, artilheiro e classificações",
      "Janela de alerta para previsões de fases extras",
    ],
  },
  {
    version: "1.16.0",
    date: "2026-06-01",
    changes: [
      "Banner de palpites pendentes na página de partidas",
      "Alerta de bloqueio de fase no Regulamento 2",
      "Contagem regressiva para fechamento de palpites",
    ],
  },
  {
    version: "1.15.0",
    date: "2026-06-01",
    changes: [
      "Lock de fase no Regulamento 2",
      "Palpites bloqueados quando fase da competição inicia",
      "Melhorias nos testes de pontuação",
    ],
  },
  {
    version: "1.14.0",
    date: "2026-06-01",
    changes: [
      "Breakdown detalhado de pontuação no leaderboard",
      "Visualização de placares exatos, diferença e resultado",
      "Contagem de bônus zebra e placar-sozinho",
    ],
  },
  {
    version: "1.13.0",
    date: "2026-06-01",
    changes: [
      "Correção: login não sobrescreve mais nome e avatar editados",
      "Perfil do usuário agora preservado ao fazer login novamente",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-06-01",
    changes: [
      "Auto-sync configurável por competição (pausar Brasileirão sem afetar a Copa)",
      "Card dedicado para configuração do Bônus Zebra",
      "Painel administrativo reorganizado para melhor clareza",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-05-31",
    changes: [
      "Correção no cálculo de pontos do Regulamento 2",
      "Pontos agora calculados em tempo real para placar-sozinho",
      "Melhorias no sistema de polling de atualizações",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-05-31",
    changes: [
      "Seletor visual de avatares no modal de perfil",
      "Avatares gerados automaticamente com melhor qualidade",
      "Correções no cálculo de pontos de especiais",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-05-31",
    changes: [
      "Editar nome e foto de perfil no mesmo modal",
      "Avatar regenerado automaticamente ao mudar nome",
      "Validação de nome vazio ao salvar perfil",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-05-31",
    changes: [
      "Pontuação ao vivo atualizada em tempo real no leaderboard",
      "Leaderboard recarrega dados automaticamente ao abrir a aba",
      "Simplificação de políticas RLS para melhor performance",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-05-31",
    changes: [
      "Replicar palpites entre grupos com mesma competição e regulamento",
      "Botão 'Copiar Palpites' disponível na página de partidas",
      "Seleção de grupo de destino com validação automática",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-05-26",
    changes: [
      "Dados de artilheiro agora são buscados automaticamente da Football Data API",
      "Campeão da competição é detectado automaticamente via API quando disponível",
      "Time com mais gols em um jogo único calculado automaticamente",
      "Time com mais gols sofridos em um jogo único calculado automaticamente",
      "Regulamento atualizado com novas regras de blocos de fases",
      "Correções de layout em cards e modais",
      "Auditoria de pontos disponível clicando em cada usuário no menu RANK",
    ],
  },
  {
    version: "1.5.1",
    date: "2026-05-16",
    changes: [
      "Palpites de outros participantes agora aparecem corretamente para todos os membros do grupo",
      "Pontuação dos grupos não é mais zerada durante a sincronização de resultados",
      "Pull-to-Refresh disponível em todas as abas (Partidas, Classificação, Torneio, Stats)",
      "Pontos dos palpites gravados corretamente no banco após sincronização — Histórico de Palpites exibe valores corretos",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-05-16",
    changes: [
      "Palpites dos outros participantes não exibem mais o próprio usuário na lista",
      "Badge colorido mostra quantos pontos cada palpite está rendendo em jogos ao vivo ou finalizados",
      "Modal do avatar exibe Pontos e Rank do usuário, visível também no mobile",
      "Pull-to-Refresh: puxe a tela para baixo para atualizar partidas e palpites direto do banco",
      "Palpites Especiais agora são por grupo — cada grupo tem sua própria Seleção Campeã, Artilheiro, etc.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-05-12",
    changes: [
      "Dropdown 'Seleção Campeã' exibe apenas os times da competição ativa, carregados do banco de dados",
      "Botão de palpites especiais exibe 'Editar Palpites Especiais' quando já existem palpites guardados",
      "Badge 'Salvo' aparece no cabeçalho do card de palpites especiais quando há palpites registados",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-05-11",
    changes: [
      "Bônus Zebra agora proporcional à diferença de ranking FIFA (sem threshold fixo)",
      "Tag ZEBRA nos cards exibe o bônus potencial em pontos (+1pt a +5pts)",
      "Fórmula revisada: bônus começa em diff ≥ 34, escala suave até +5pts",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-05-11",
    changes: [
      "Ranking FIFA exibido nos cards de partida",
      "Limite de ranking para bônus zebra agora reflete a configuração do grupo",
      "Modal 'O que há de novo' exibido após cada atualização",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-05-11",
    changes: [
      "Cadastro e entrada em grupos corrigidos",
      "Pontuação agora sincroniza corretamente com o banco de dados",
    ],
  },
];

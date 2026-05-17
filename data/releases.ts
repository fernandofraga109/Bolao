export const CURRENT_VERSION = "1.5.1";

export interface Release {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASES: Release[] = [
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

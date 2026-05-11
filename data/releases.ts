export const CURRENT_VERSION = "1.2.0";

export interface Release {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASES: Release[] = [
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

/**
 * Traduções de fases da competição para português brasileiro
 */

export type CompetitionStage = 
  | 'FINAL'
  | 'SEMI_FINALS'
  | 'QUARTER_FINALS'
  | 'PLAYOFFS'
  | 'LAST_16'
  | 'LAST_32'
  | 'ROUND_OF_16'
  | 'ROUND_OF_32'
  | 'THIRD_PLACE'
  | 'LEAGUE_STAGE'
  | 'REGULAR_SEASON'
  | string;

const STAGE_TRANSLATIONS: Record<string, string> = {
  'FINAL': 'FINAL',
  'SEMI_FINALS': 'SEMI FINAL',
  'SEMI_FINAL': 'SEMI FINAL',
  'QUARTER_FINALS': 'QUARTAS DE FINAL',
  'QUARTER_FINAL': 'QUARTAS DE FINAL',
  'PLAYOFFS': 'PLAYOFFS',
  'PLAY_OFF': 'PLAYOFFS',
  'LAST_16': 'OITAVAS DE FINAL',
  'ROUND_OF_16': 'DEZESSEIS AVOS',
  'LAST_32': 'TRINTA E DOIS AVOS',
  'ROUND_OF_32': 'TRINTA E DOIS AVOS',
  'THIRD_PLACE': 'TERCEIRO LUGAR',
  'LEAGUE_STAGE': 'FASE DE GRUPOS',
  'REGULAR_SEASON': 'TEMPORADA REGULAR',
};

/**
 * Peso de ordenação descendente para fases da competição.
 * Quanto maior o peso, mais recente/avancada a fase.
 */
/**
 * Traduz o nome de uma fase da competição para português
 */
export const translateStage = (stage: CompetitionStage): string => {
  const normalized = stage.toUpperCase().replace(/\s+/g, '_');
  return STAGE_TRANSLATIONS[normalized] || stage;
};

/**
 * Traduz o nome de um grupo/fase, incluindo padronização de grupos (Group A -> Grupo A)
 */
export const translateGroupName = (groupName: string): string => {
  // Primeiro verifica se é um grupo padrão (Group A, GROUP_B, etc)
  const groupMatch = /^(?:Group|GROUP)[_\s]+([A-Z])$/i.exec(groupName.trim());
  if (groupMatch) {
    return `Grupo ${groupMatch[1]}`;
  }

  // Tenta traduzir como fase da competição
  const translated = translateStage(groupName);

  // Se não houver tradução, retorna o original capitalizado
  if (translated === groupName) {
    return groupName
      .split(/[_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  return translated;
};


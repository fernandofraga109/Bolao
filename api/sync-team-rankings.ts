import { supabase } from '../services/supabase';

/**
 * Sincroniza os rankings da tabela 'teams' no Supabase 
 * a partir do arquivo team-ranking.json
 */
export const syncTeamRankings = async (): Promise<{
  success: boolean;
  message: string;
  updated: number;
  failed: number;
  errors: string[];
}> => {
  try {
    if (!supabase) {
      return {
        success: false,
        message: 'Supabase não está configurado',
        updated: 0,
        failed: 0,
        errors: ['Supabase não inicializado']
      };
    }

    // Fetch team-ranking.json
    const response = await fetch('/data/team-ranking.json');
    if (!response.ok) {
      return {
        success: false,
        message: 'Erro ao carregar team-ranking.json',
        updated: 0,
        failed: 0,
        errors: [`HTTP ${response.status}`]
      };
    }

    const rankingData = await response.json();

    // Criar mapa de código de país para ranking
    const rankingMap: Record<string, number> = {};
    rankingData.Results?.forEach((team: any) => {
      if (team.IdCountry && team.Rank) {
        rankingMap[team.IdCountry] = team.Rank;
      }
    });

    if (Object.keys(rankingMap).length === 0) {
      return {
        success: false,
        message: 'Nenhum ranking encontrado no JSON',
        updated: 0,
        failed: 0,
        errors: ['JSON vazio ou formato inválido']
      };
    }

    // Fetch teams atuais do Supabase
    const { data: teams, error: fetchError } = await supabase
      .from('teams')
      .select('id, code');

    if (fetchError || !teams) {
      return {
        success: false,
        message: 'Erro ao buscar times do Supabase',
        updated: 0,
        failed: 0,
        errors: [fetchError?.message || 'Erro desconhecido']
      };
    }

    // Preparar updates
    const updates: any[] = [];
    const errors: string[] = [];

    teams.forEach((team: any) => {
      const ranking = rankingMap[team.code];
      if (ranking !== undefined) {
        updates.push({
          id: team.id,
          ranking: ranking
        });
      } else {
        errors.push(`Time ${team.code} não encontrado no ranking JSON`);
      }
    });

    if (updates.length === 0) {
      return {
        success: false,
        message: 'Nenhum time para atualizar',
        updated: 0,
        failed: 0,
        errors: errors
      };
    }

    // Fazer updates em batch
    let updated = 0;
    let failed = 0;

    for (const update of updates) {
      const { error } = await supabase
        .from('teams')
        .update({ ranking: update.ranking })
        .eq('id', update.id);

      if (error) {
        failed++;
        console.error(`Erro atualizando time ${update.id}:`, error);
        const errorMsg = error.message || 'Erro desconhecido';
        
        // Adicionar contexto ao erro 403 (RLS)
        if (error.code === '42501') {
          errors.push(`Erro de Permissão (RLS) - Verifique as políticas da tabela 'teams' no Supabase`);
        } else {
          errors.push(`Erro atualizando time ${update.id}: ${errorMsg}`);
        }
      } else {
        updated++;
      }
    }

    return {
      success: failed === 0,
      message: `Sincronização concluída: ${updated} times atualizados${failed > 0 ? `, ${failed} erros` : ''}`,
      updated,
      failed,
      errors: errors
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Erro ao sincronizar rankings',
      updated: 0,
      failed: 0,
      errors: [err?.message || 'Erro desconhecido']
    };
  }
};

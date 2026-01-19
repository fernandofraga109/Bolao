
import { supabase } from './supabase';
import { INITIAL_DB } from '../data/initialData';

export const seedDatabase = async () => {
    if (!supabase) {
        throw new Error('Supabase não está configurado. Verifique services/supabase.ts');
    }

    const report: string[] = [];
    const addLog = (msg: string) => {
        console.log(msg);
        report.push(msg);
    };

    try {
        addLog('🚀 Iniciando Seed (População de Dados)...');

        // 1. Teams
        const { error: teamsErr } = await supabase.from('teams').upsert(INITIAL_DB.teams);
        if (teamsErr) throw teamsErr;
        addLog(`✅ Times inseridos: ${INITIAL_DB.teams.length}`);

        // 2. Stadiums
        const { error: stadErr } = await supabase.from('stadiums').upsert(INITIAL_DB.stadiums);
        if (stadErr) throw stadErr;
        addLog(`✅ Estádios inseridos: ${INITIAL_DB.stadiums.length}`);

        // 3. Users
        const { error: userErr } = await supabase.from('users').upsert(INITIAL_DB.users);
        if (userErr) throw userErr;
        addLog(`✅ Usuários inseridos: ${INITIAL_DB.users.length}`);

        // 4. Groups
        const { error: groupErr } = await supabase.from('groups').upsert(INITIAL_DB.groups);
        if (groupErr) throw groupErr;
        addLog(`✅ Grupos inseridos: ${INITIAL_DB.groups.length}`);

        // 5. User Groups Relations
        const { error: ugErr } = await supabase.from('user_groups').upsert(INITIAL_DB.userGroups);
        if (ugErr) throw ugErr;
        addLog(`✅ Relações Usuário-Grupo inseridas: ${INITIAL_DB.userGroups.length}`);

        // 6. Matches
        // Supabase pode reclamar de lotes grandes, mas para ~100 jogos deve ser ok.
        const { error: matchErr } = await supabase.from('matches').upsert(INITIAL_DB.matches);
        if (matchErr) throw matchErr;
        addLog(`✅ Jogos inseridos: ${INITIAL_DB.matches.length}`);

        // 7. Predictions
        const { error: predErr } = await supabase.from('predictions').upsert(INITIAL_DB.predictions);
        if (predErr) throw predErr;
        addLog(`✅ Palpites de exemplo inseridos: ${INITIAL_DB.predictions.length}`);

        // 8. Tournament Predictions
        const { error: tpErr } = await supabase.from('tournament_predictions').upsert(INITIAL_DB.tournamentPredictions);
        if (tpErr) throw tpErr;
        addLog(`✅ Palpites do torneio inseridos: ${INITIAL_DB.tournamentPredictions.length}`);

        addLog('🏁 Seed concluído com sucesso!');
        return { success: true, logs: report };
    } catch (error: any) {
        console.error('Seed Error:', error);
        addLog(`❌ Erro: ${error.message || JSON.stringify(error)}`);
        return { success: false, logs: report };
    }
};

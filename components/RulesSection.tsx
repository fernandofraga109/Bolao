import React, { useState } from 'react';
import { Info, ChevronUp, ChevronDown } from 'lucide-react';

interface RulesSectionProps {
  minRankDiff?: number;
  ruleset?: "regulamento_1" | "regulamento_2";
}

const RulesSection: React.FC<RulesSectionProps> = ({ minRankDiff = 10, ruleset = "regulamento_1" }) => {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-lg overflow-hidden mb-4">
        <button 
        onClick={() => setShowRules(!showRules)}
        className="w-full px-4 py-3 flex items-center justify-between text-indigo-300 hover:bg-indigo-500/10 transition-colors"
        >
        <div className="flex items-center gap-2 text-sm font-semibold">
            <Info size={16} />
            <span>Regras de Pontuação ({ruleset === "regulamento_2" ? "Regulamento 2" : "Regulamento 1"})</span>
        </div>
        {showRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {showRules && (
        <div className="px-4 pb-4 bg-indigo-900/10 border-t border-indigo-500/20">
            {ruleset === "regulamento_2" ? (
              <ul className="text-xs text-indigo-200/80 space-y-2 pt-2">
                  <li className="flex items-start gap-2">
                      <span className="bg-yellow-500 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">15-22</span>
                      <span><b>Placar Exato:</b> Acertou o resultado (15pts grupos, 17pts 3º lugar, 22pts final).</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-teal-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">13-19</span>
                      <span><b>Saldo de Gols:</b> Acertou vencedor e saldo (13pts grupos, 15pts 3º lugar, 19pts final).</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-blue-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">10-16</span>
                      <span><b>Vencedor:</b> Acertou vencedor ou empate (10pts grupos, 12pts 3º lugar, 16pts final).</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-yellow-400 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">+5pts</span>
                      <span><b>Placar Sozinho:</b> Bônus caso você seja o único do grupo a acertar o Placar Exato do jogo!</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-pink-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">x2 pts</span>
                      <span><b>Aposta Especial por Fase:</b> Seu palpite eleito de maior diferença de gols por fase (oitavas, quartas, semi, final) vale pontos em dobro!</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-red-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">-3pts</span>
                      <span><b>Penalidade por Atraso:</b> Apostas salvas após o início do jogo recebem punição de -3pts sobre os pontos ganhos.</span>
                  </li>

                  <li className="pt-2 font-bold text-indigo-300">Bônus Especiais de Torneio (100pts cada):</li>
                  
                  <li className="grid grid-cols-2 gap-x-2 gap-y-1">
                      <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                           <span>Seleção Campeã</span>
                      </div>
                      <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                           <span>Seleção que Mais Faz Gols</span>
                      </div>
                      <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                           <span>Seleção que Mais Sofre Gols</span>
                      </div>
                  </li>
              </ul>
            ) : (
              <ul className="text-xs text-indigo-200/80 space-y-2 pt-2">
                  <li className="flex items-start gap-2">
                      <span className="bg-yellow-500 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">10pts</span>
                      <span><b>Placar Exato:</b> Acertou em cheio o resultado (Ex: chutou 2x1, foi 2x1).</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-teal-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">7pts</span>
                      <span><b>Saldo de Gols:</b> Acertou o vencedor e a diferença de gols (Ex: chutou 2x0, foi 4x2).</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-blue-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">5pts</span>
                      <span><b>Vencedor:</b> Acertou apenas quem ganhou ou que deu empate.</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="bg-yellow-400/80 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[36px] text-center">+1-5</span>
                      <span><b>Bônus Zebra:</b> Bônus extra quando um time zebra vence. Quanto maior a diferença de ranking FIFA entre os times, maior o bônus (+1pt a +5pts).</span>
                  </li>

                  <li className="pt-2 font-bold text-indigo-300">Bônus Especiais (100pts cada):</li>
                  
                  <li className="grid grid-cols-2 gap-x-2 gap-y-1">
                      <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                           <span>Seleção Campeã</span>
                      </div>
                      <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                           <span>Artilheiro (Nome)</span>
                      </div>
                      <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                           <span>Artilheiro (Gols)</span>
                      </div>
                      <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                           <span>Melhor Jogador</span>
                      </div>
                       <div className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                           <span>Melhor Goleiro</span>
                      </div>
                  </li>
              </ul>
            )}
        </div>
        )}
    </div>
  );
};

export default RulesSection;
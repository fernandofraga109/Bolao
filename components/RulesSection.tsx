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
            <span>Regras de Pontuação dos Jogos</span>
        </div>
        {showRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {showRules && (
        <div className="px-4 pb-4 bg-indigo-900/10 border-t border-indigo-500/20">
            {ruleset === "regulamento_2" ? (
              <div className="text-xs text-indigo-200/80 space-y-4 pt-3">
                  {/* Fase de Grupos */}
                  <div>
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide mb-1.5">Fase de Grupos</h4>
                    <ul className="space-y-1.5 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-500 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">15</span>
                        <span><b>Placar Exato</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-teal-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">13</span>
                        <span><b>Resultado + Diferença de gols</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">10</span>
                        <span><b>Resultado</b> (vencedor ou empate)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-400 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">+5</span>
                        <span><b>Placar Sozinho</b> (único a acertar o placar)</span>
                      </li>
                    </ul>
                    <p className="text-[10px] text-slate-500 mt-1 italic pl-1">Em caso de empate, não há bônus por diferença de gols.</p>
                  </div>

                  {/* Segunda Fase */}
                  <div>
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide mb-1.5">Segunda Fase (Oitavas, Quartas, Semi)</h4>
                    <ul className="space-y-1.5 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-500 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">15</span>
                        <span><b>Placar Exato</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-teal-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">13</span>
                        <span><b>Resultado + Diferença de gols</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">10</span>
                        <span><b>Resultado</b> (vencedor ou empate)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-400 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">+5</span>
                        <span><b>Placar Sozinho</b> (único a acertar o placar)</span>
                      </li>
                    </ul>
                    <p className="text-[10px] text-slate-500 mt-1 italic pl-1">Prorrogação é considerada no placar final.</p>
                  </div>

                  {/* Disputa de 3º Lugar */}
                  <div>
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide mb-1.5">Disputa de 3º Lugar</h4>
                    <ul className="space-y-1.5 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-500 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">17</span>
                        <span><b>Placar Exato</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-teal-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">15</span>
                        <span><b>Resultado + Diferença de gols</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">12</span>
                        <span><b>Resultado</b> (vencedor ou empate)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-400 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">+5</span>
                        <span><b>Placar Sozinho</b></span>
                      </li>
                    </ul>
                  </div>

                  {/* Final */}
                  <div>
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide mb-1.5">Final</h4>
                    <ul className="space-y-1.5 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-500 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">22</span>
                        <span><b>Placar Exato</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-teal-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">19</span>
                        <span><b>Resultado + Diferença de gols</b></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">16</span>
                        <span><b>Resultado</b> (vencedor ou empate)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-yellow-400 text-black font-bold px-1.5 rounded text-[10px] mt-0.5 min-w-[32px] text-center">+5</span>
                        <span><b>Placar Sozinho</b></span>
                      </li>
                    </ul>
                  </div>
              </div>
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
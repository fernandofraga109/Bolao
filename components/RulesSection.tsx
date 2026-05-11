import React, { useState } from 'react';
import { Info, ChevronUp, ChevronDown } from 'lucide-react';

const RulesSection: React.FC = () => {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-lg overflow-hidden mb-4">
        <button 
        onClick={() => setShowRules(!showRules)}
        className="w-full px-4 py-3 flex items-center justify-between text-indigo-300 hover:bg-indigo-500/10 transition-colors"
        >
        <div className="flex items-center gap-2 text-sm font-semibold">
            <Info size={16} />
            <span>Regras de Pontuação</span>
        </div>
        {showRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {showRules && (
        <div className="px-4 pb-4 bg-indigo-900/10 border-t border-indigo-500/20">
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
                    <span><b>Bônus Zebra:</b> Bônus extra quando um time zebra vence. Aplicado apenas quando a diferença de ranking FIFA for maior que 10 posições (+1pt a +5pts).</span>
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
        </div>
        )}
    </div>
  );
};

export default RulesSection;
import React from "react";
import { X, ScrollText } from "lucide-react";

const REGULAMENTO_TEXT = `Regulamento do Bolão do Mesa 2026 

14 inscritos 
2.800,00 a serem distribuídos  , conforme regras estabelecidas neste Regulamento .

1) Critérios de pontuação:

A) Campeão - 100 pontos para quem acertar sozinho ( palpite somente antes da copa ). 
No caso de dois acertarem o mesmo campeão , valerá 70 pontos para cada um.
Se três acertarem o mesmo campeão , valerá 50 pontos para cada um.
Se quatro ou mais acertarem o mesmo campeão , valerá 40 pontos para cada um.

B) Artilheiro - 60 pontos para quem acertar sozinho ( palpite somente antes da copa ).
No caso de dois acertarem o mesmo artilheiro, cada um receberá 40 pontos.
Se três acertarem, cada um receberá 30 pontos.
Se quatro ou mais acertarem, cada um receberá 25 pontos.

C) Fase de grupos :
Resultado - 10
Resultado + diferença de gols - 13
Placar - 15 ( não cumulativo com os anteriores )
Placar sozinho - mais 5 pontos extras.

Cada classificado - 10 ( apenas os dois primeiros do grupo, embora o terceiro possa classificar )

D) Segunda fase, Oitavas, Quartas, Semi -
Resultado - 10
Resultado + diferença de gols - 13
Placar - 15 ( não cumulativo com os anteriores )
Placar sozinho - mais 5 pontos extras 
Pontuação por classificado - 5

E) Disputa de terceiro lugar -
Resultado - 12
Resultado + diferença de gols - 15
Placar - 17 ( não cumulativo com os anteriores )
Placar sozinho - mais 5 pontos extras .

F) Final - 
Resultado - 16
Resultado + diferença de gols - 19
Placar - 22 (não cumulativo com os anteriores ).
Placar sozinho - 5 pontos extras.

G) Acertar previamente ( antes da copa ) qual a seleção que fará o maior número de gols em um único jogo - 20  ( não precisa dizer o número de gols e nem o jogo )

H) Acertar previamente ( antes da copa )qual a seleção que tomará o maior número de gols em uma única partida - 20
( Não precisa dizer o número de gols e nem o jogo ).

I)  Acertar  qual o jogo de cada uma das fases ( antes de cada fase ) que terá a maior diferença de gols - 20 ( não precisa dizer qual a diferença ).

2) O eventual tempo da prorrogação  será considerado para todos os efeitos e critérios de pontuação .  

3) Não haverá , em caso de empate , pontuação extra por (resultado + diferença de gols) .

4) As apostas serão feitas por "blocos de fases ", quais sejam: 
- fase de grupos 
- segunda fase
- oitavas de final
- quartas de final
- semifinal
- disputa de terceiro lugar
- final

5) Não haverá , em qualquer hipótese, qualquer tipo de flexibilização para aquele que perder o prazo das apostas, independentemente do motivo alegado.  O bolão será fechado tão logo se inicie o jogo ou o primeiro jogo referente àquela fase ou bloco de apostas, conforme  item anterior.

6) Quem apostar errado não poderá alegar erro material / engano.  Dane-se.

7) Não se requer coerência nas apostas dos jogos e apostas dos classificados na fase de grupos.   Nas demais fases , é necessário coerência da aposta dos jogos e classificados .
O palpite de campeão não precisa qualquer coerência  com as demais apostas .

8) Considerações finais :

A) A premiação de 2.800 será distribuída para o G3, conforme abaixo :

Campeão - 1700,00
Vice-campeão - 700,00
Terceiro lugar - 400,00

B) Valor da inscrição : 200,00.
Eventual saldo a pagar, será adimplido até 04/06/26.
Em caso de não cumprimento deste prazo final, poderá ser pago até antes do início do jogo de abertura da Copa , mediante multa de 50,00, que será revertida ao campeão do bolão .
Depósito no Pix do Gabriel.

C) O churrasco de comemoração do Bolão do Mesa  será realizado até dezembro de 2027, e será pago pelo Z4 ( carne, suco, refri, água, aluguel de salão  e facultado demais alimentos a serem oferecidos no  churrasco ).

D) Ninguém , em nenhum momento, poderá alegar desconhecimento das regras previstas neste Regulamento.`;

interface RegulamentoModalProps {
  onClose: () => void;
}

const RegulamentoModal: React.FC<RegulamentoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/30">
              <ScrollText size={18} className="text-indigo-300" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">REGULAMENTO</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
            {REGULAMENTO_TEXT}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegulamentoModal;

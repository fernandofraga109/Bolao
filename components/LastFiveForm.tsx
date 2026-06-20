import React from "react";
import { Check, X, Minus } from "lucide-react";
import { TeamFormEntry, FormOutcome } from "../utils/teamForm";

interface LastFiveFormProps {
  entries: TeamFormEntry[];
  onClick?: () => void;
  align?: "start" | "center" | "end";
}

const OUTCOME_STYLES: Record<FormOutcome, { bg: string; Icon: typeof Check }> = {
  W: { bg: "bg-brand-green text-brand-dark", Icon: Check },
  D: { bg: "bg-slate-600 text-slate-200", Icon: Minus },
  L: { bg: "bg-brand-red text-white", Icon: X },
};

const ALIGN_CLASS: Record<NonNullable<LastFiveFormProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

/**
 * Faixa de forma recente: até 5 bolinhas (V/E/D), mais recente à direita.
 * Verde = vitória, cinza = empate, vermelho = derrota. Não renderiza nada
 * quando não há histórico, evitando ruído visual em times sem jogos.
 */
const LastFiveForm: React.FC<LastFiveFormProps> = ({ entries, onClick, align = "center" }) => {
  if (!entries.length) return null;

  // entries vem do mais recente para o mais antigo; invertemos para exibir o
  // mais recente à direita (padrão de "form guide").
  const ordered = [...entries].reverse();

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      title={onClick ? "Ver últimos jogos" : undefined}
      className={`flex items-center gap-1 ${ALIGN_CLASS[align]} ${
        onClick ? "cursor-pointer transition-opacity hover:opacity-80" : ""
      }`}
    >
      {ordered.map(({ outcome }, i) => {
        const { bg, Icon } = OUTCOME_STYLES[outcome];
        return (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${bg}`}
          >
            <Icon size={9} strokeWidth={3.5} />
          </span>
        );
      })}
    </div>
  );
};

export default LastFiveForm;

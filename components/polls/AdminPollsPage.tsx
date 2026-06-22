import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X, Lock, Unlock, Users } from "lucide-react";
import { Poll, PollResults, PollTargetRuleset } from "../../types";

interface AdminPollsPageProps {
  fetchAllPolls: () => Promise<Poll[]>;
  getPollResults: (poll: Poll) => Promise<PollResults | null>;
  createPoll: (input: {
    question: string;
    options: string[];
    allowMultiple: boolean;
    targetRuleset: PollTargetRuleset;
  }) => Promise<boolean>;
  setPollStatus: (pollId: string, status: "active" | "closed") => Promise<boolean>;
  deletePoll: (pollId: string) => Promise<boolean>;
}

const TARGET_LABELS: Record<string, string> = {
  todos: "Todos os usuários",
  regulamento_1: "Quem tem grupo do Regulamento 1",
  regulamento_2: "Quem tem grupo do Regulamento 2",
  both: "Quem tem grupo (Reg. 1 ou 2)",
};

const targetToLabel = (t: PollTargetRuleset): string =>
  TARGET_LABELS[t ?? "todos"] ?? "Todos os usuários";

/**
 * Aba admin "Enquetes": cadastra perguntas e mostra os resultados ANÔNIMOS
 * (% por opção + total de respondentes). Os resultados vêm da RPC get_poll_results
 * — o admin nunca acessa quem votou o quê.
 */
const AdminPollsPage: React.FC<AdminPollsPageProps> = ({
  fetchAllPolls,
  getPollResults,
  createPoll,
  setPollStatus,
  deletePoll,
}) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [resultsById, setResultsById] = useState<Record<string, PollResults>>({});
  const [loading, setLoading] = useState(false);

  // Form
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [targetRuleset, setTargetRuleset] = useState<PollTargetRuleset>(null);
  const [saving, setSaving] = useState(false);

  // Filtro da lista
  const [statusFilter, setStatusFilter] = useState<"active" | "closed" | "all">("all");

  const reload = useCallback(async () => {
    setLoading(true);
    const all = await fetchAllPolls();
    setPolls(all);
    const entries = await Promise.all(
      all.map(async (p) => [p.id, await getPollResults(p)] as const),
    );
    const map: Record<string, PollResults> = {};
    for (const [id, res] of entries) if (res) map[id] = res;
    setResultsById(map);
    setLoading(false);
  }, [fetchAllPolls, getPollResults]);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateOption = (idx: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (idx: number) =>
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)));

  const filteredPolls =
    statusFilter === "all" ? polls : polls.filter((p) => p.status === statusFilter);

  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSave = question.trim().length > 0 && trimmedOptions.length >= 2 && !saving;

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await createPoll({
      question: question.trim(),
      options: trimmedOptions,
      allowMultiple,
      targetRuleset,
    });
    setSaving(false);
    if (ok) {
      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
      setTargetRuleset(null);
      await reload();
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-wide">Enquetes</h2>
        <p className="text-xs text-slate-400 mt-1">
          Cadastre perguntas que aparecem para os usuários ao abrir o app. Os resultados são{" "}
          <strong className="text-slate-300">anônimos</strong> — você vê só o percentual e o total.
        </p>
      </div>

      {/* ---- Form de criação ---- */}
      <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-3">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Nova pergunta</h3>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex.: Você concorda com a mudança na pontuação do Regulamento 1?"
          rows={2}
          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:border-brand-green outline-none resize-none"
        />

        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`Opção ${idx + 1}`}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:border-brand-green outline-none"
              />
              <button
                onClick={() => removeOption(idx)}
                disabled={options.length <= 2}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remover opção"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={addOption}
            className="flex items-center gap-1.5 text-xs font-bold text-brand-green hover:text-brand-green/80"
          >
            <Plus size={14} /> Adicionar opção
          </button>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="w-4 h-4 accent-brand-green"
            />
            Permitir múltiplas escolhas
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Público-alvo
            <select
              value={targetRuleset ?? "todos"}
              onChange={(e) =>
                setTargetRuleset(
                  e.target.value === "todos" ? null : (e.target.value as PollTargetRuleset),
                )
              }
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-brand-green outline-none"
            >
              <option value="todos">Todos os usuários</option>
              <option value="regulamento_1">Quem tem grupo do Regulamento 1</option>
              <option value="regulamento_2">Quem tem grupo do Regulamento 2</option>
              <option value="both">Quem tem grupo (Reg. 1 ou 2)</option>
            </select>
          </label>
        </div>

        <button
          onClick={handleCreate}
          disabled={!canSave}
          className="w-full py-2.5 rounded-xl bg-brand-green text-brand-dark font-bold text-sm hover:bg-brand-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Salvando..." : "Criar enquete"}
        </button>
      </div>

      {/* ---- Lista de enquetes + resultados ---- */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Enquetes criadas</h3>

        {/* Seletor de status */}
        <div className="flex gap-1.5">
          {([
            { key: "all", label: "Todas" },
            { key: "active", label: "Ativas" },
            { key: "closed", label: "Encerradas" },
          ] as const).map((opt) => {
            const isOn = statusFilter === opt.key;
            const count =
              opt.key === "all"
                ? polls.length
                : polls.filter((p) => p.status === opt.key).length;
            return (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-colors ${
                  isOn
                    ? "bg-brand-green/15 border-brand-green/40 text-brand-green"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>

        {loading && <p className="text-xs text-slate-500">Carregando...</p>}
        {!loading && filteredPolls.length === 0 && (
          <p className="text-xs text-slate-500">
            {polls.length === 0
              ? "Nenhuma enquete cadastrada ainda."
              : "Nenhuma enquete neste filtro."}
          </p>
        )}

        {filteredPolls.map((poll) => {
          const results = resultsById[poll.id];
          const total = results?.totalRespondents ?? 0;
          const isActive = poll.status === "active";
          return (
            <div
              key={poll.id}
              className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-white flex-1">{poll.question}</p>
                <span
                  className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? "bg-brand-green/15 text-brand-green"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {isActive ? "Ativa" : "Encerrada"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Users size={11} /> {total} {total === 1 ? "resposta" : "respostas"}
                </span>
                <span>· {poll.allow_multiple ? "Múltipla escolha" : "Escolha única"}</span>
                <span>· {targetToLabel(poll.target_ruleset)}</span>
              </div>

              {/* Participação geral (respondentes / usuários elegíveis) */}
              {results && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">
                      Participação
                    </span>
                    <span className="text-slate-300 font-mono">
                      {Math.round(results.participationRate * 100)}% ({results.totalRespondents}/
                      {results.eligibleUsers})
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round(results.participationRate * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-slate-700/60" />

              <div className="space-y-2">
                {poll.options.map((label, idx) => {
                  const opt = results?.options.find((o) => o.optionIndex === idx);
                  const pct = opt ? Math.round(opt.percentage * 100) : 0;
                  const votes = opt?.votes ?? 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{label}</span>
                        <span className="text-slate-400 font-mono">
                          {pct}% ({votes})
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-brand-green rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {poll.allow_multiple && (
                <p className="text-[10px] text-slate-500">
                  Múltipla escolha: a soma dos percentuais pode passar de 100%.
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setPollStatus(poll.id, isActive ? "closed" : "active").then(reload)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-200 hover:bg-slate-600"
                >
                  {isActive ? <Lock size={12} /> : <Unlock size={12} />}
                  {isActive ? "Encerrar" : "Reabrir"}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Excluir esta enquete e todas as respostas?")) {
                      deletePoll(poll.id).then(reload);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-400 hover:text-red-400"
                >
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminPollsPage;

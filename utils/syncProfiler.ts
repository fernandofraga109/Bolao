/**
 * SyncProfiler — instrumentação leve de tempo por fase do pipeline de sync.
 *
 * Mede o intervalo entre marcações sucessivas (`performance.now`) e emite, ao
 * final, um resumo no console: uma tabela **por fase** e um agregado **por
 * categoria** (api / db_write / db_read / cpu / lock).
 *
 * Objetivo: diagnosticar a variação de duração do sync (observada entre ~30s e
 * ~40s) identificando qual fase domina o tempo — chamada externa, escrita no
 * banco, recálculo de pontos, etc. Ver `.claude/plans/sync-performance-investigation.md`.
 *
 * Custo: desprezível (apenas `performance.now()` + push num array). Não faz I/O.
 */

export type SyncPhaseCategory = "api" | "db_write" | "db_read" | "cpu" | "lock";

export interface SyncPhaseMark {
  phase: string;
  category: SyncPhaseCategory;
  ms: number;
}

const nowMs = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export class SyncProfiler {
  private readonly startedAt: number;
  private lastAt: number;
  private readonly marks: SyncPhaseMark[] = [];

  constructor(private readonly label: string) {
    this.startedAt = nowMs();
    this.lastAt = this.startedAt;
  }

  /** Registra o tempo decorrido desde a marcação anterior (ou do início). */
  mark(phase: string, category: SyncPhaseCategory): void {
    const t = nowMs();
    this.marks.push({ phase, category, ms: t - this.lastAt });
    this.lastAt = t;
  }

  /** Reinicia o cronômetro do próximo intervalo sem registrar marca (pula trechos não medidos). */
  reset(): void {
    this.lastAt = nowMs();
  }

  getMarks(): SyncPhaseMark[] {
    return [...this.marks];
  }

  totalMs(): number {
    return nowMs() - this.startedAt;
  }

  /** Agrega o tempo total por categoria. */
  byCategory(): Record<SyncPhaseCategory, number> {
    const acc: Record<SyncPhaseCategory, number> = {
      api: 0,
      db_write: 0,
      db_read: 0,
      cpu: 0,
      lock: 0,
    };
    for (const m of this.marks) acc[m.category] += m.ms;
    return acc;
  }

  /**
   * Emite o resumo no console (tabela por fase + agregado por categoria) e
   * retorna os dados brutos para eventual telemetria futura.
   */
  log(): {
    total: number;
    marks: SyncPhaseMark[];
    byCategory: Record<SyncPhaseCategory, number>;
  } {
    const total = this.totalMs();
    const cats = this.byCategory();
    const round = (n: number) => Math.round(n);
    const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "0%");

    console.log(`[SYNC PERF] ${this.label} — total ${round(total)}ms`);

    if (typeof console.table === "function") {
      console.table(
        this.marks.map((m) => ({
          fase: m.phase,
          categoria: m.category,
          ms: round(m.ms),
          "%": pct(m.ms),
        })),
      );
      console.table(
        (Object.keys(cats) as SyncPhaseCategory[])
          .filter((c) => cats[c] > 0)
          .map((c) => ({ categoria: c, ms: round(cats[c]), "%": pct(cats[c]) })),
      );
    } else {
      for (const m of this.marks) {
        console.log(`  ${m.phase} [${m.category}]: ${round(m.ms)}ms (${pct(m.ms)})`);
      }
    }

    return { total, marks: this.marks, byCategory: cats };
  }
}

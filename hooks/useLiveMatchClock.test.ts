import { describe, it, expect } from "vitest";
import { getLiveClock } from "./useLiveMatchClock";
import { LiveMatchDetails } from "../types";

const base = (over: Partial<LiveMatchDetails>): LiveMatchDetails => ({
  apiSportsFixtureId: 1,
  statusShort: "1H",
  statusLong: null,
  elapsed: null,
  extra: null,
  periods: { first: null, second: null },
  referee: null,
  venue: null,
  events: [],
  syncedAt: new Date().toISOString(),
  ...over,
});

describe("getLiveClock", () => {
  it("retorna null sem detalhes", () => {
    expect(getLiveClock(null)).toBeNull();
    expect(getLiveClock(undefined)).toBeNull();
  });

  it("estados finais", () => {
    expect(getLiveClock(base({ statusShort: "FT" }))?.label).toBe("Encerrado");
    expect(getLiveClock(base({ statusShort: "AET" }))?.label).toBe("Encerrado");
    expect(getLiveClock(base({ statusShort: "PEN" }))?.label).toBe("Encerrado");
  });

  it("intervalo (HT)", () => {
    const c = getLiveClock(base({ statusShort: "HT" }));
    expect(c?.label).toBe("Intervalo");
    expect(c?.running).toBe(false);
  });

  it("ticka a partir de elapsed + tempo desde o syncedAt", () => {
    const syncedAt = "2026-06-14T03:00:00.000Z";
    const now = Date.parse(syncedAt) + 65 * 1000; // 1min05s após o fetch
    const c = getLiveClock(base({ statusShort: "2H", elapsed: 90, syncedAt }), now);
    expect(c?.running).toBe(true);
    expect(c?.label).toBe("91:05"); // 90:00 + 1:05
  });

  it("no instante do fetch mostra o elapsed cheio (MM:00)", () => {
    const syncedAt = "2026-06-14T03:00:00.000Z";
    const c = getLiveClock(
      base({ statusShort: "1H", elapsed: 45, syncedAt }),
      Date.parse(syncedAt),
    );
    expect(c?.label).toBe("45:00");
  });

  it("mostra acréscimos (+extra)", () => {
    const syncedAt = "2026-06-14T03:00:00.000Z";
    const c = getLiveClock(
      base({ statusShort: "2H", elapsed: 90, extra: 4, syncedAt }),
      Date.parse(syncedAt),
    );
    expect(c?.label).toBe("90:00 (+4)");
  });

  it("pênaltis em andamento", () => {
    const c = getLiveClock(base({ statusShort: "P", elapsed: 120 }));
    expect(c?.label).toBe("Pênaltis");
    expect(c?.running).toBe(false);
  });

  it("não deixa o relógio voltar (clamp em now < syncedAt)", () => {
    const syncedAt = "2026-06-14T03:00:00.000Z";
    const now = Date.parse(syncedAt) - 10_000; // skew negativo
    const c = getLiveClock(base({ statusShort: "2H", elapsed: 90, syncedAt }), now);
    expect(c?.label).toBe("90:00");
  });
});

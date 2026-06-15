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

  it("mostra o minuto autoritativo (elapsed), sem tick local", () => {
    const c = getLiveClock(base({ statusShort: "2H", elapsed: 90 }));
    expect(c?.running).toBe(false);
    expect(c?.label).toBe("90'");
  });

  it("mostra o elapsed exato", () => {
    const c = getLiveClock(base({ statusShort: "1H", elapsed: 45 }));
    expect(c?.label).toBe("45'");
  });

  it("mostra acréscimos (+extra)", () => {
    const c = getLiveClock(base({ statusShort: "2H", elapsed: 90, extra: 4 }));
    expect(c?.label).toBe("90' (+4)");
  });

  it("pênaltis em andamento", () => {
    const c = getLiveClock(base({ statusShort: "P", elapsed: 120 }));
    expect(c?.label).toBe("Pênaltis");
    expect(c?.running).toBe(false);
  });
});

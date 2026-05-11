export interface CompetitionOption {
  code: string;
  name: string;
  emblem: string;
  type: "CUP" | "LEAGUE";
}

const makeEmblem = (code: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(code)}&size=64&background=0f172a&color=22c55e&rounded=true&bold=true`;

export const COMPETITION_OPTIONS: CompetitionOption[] = [
  { code: "WC",  name: "Copa do Mundo",        emblem: makeEmblem("WC"),  type: "CUP"    },
  { code: "CL",  name: "Champions League",      emblem: makeEmblem("CL"),  type: "CUP"    },
  { code: "PL",  name: "Premier League",         emblem: makeEmblem("PL"),  type: "LEAGUE" },
  { code: "PD",  name: "La Liga",               emblem: makeEmblem("PD"),  type: "LEAGUE" },
  { code: "SA",  name: "Serie A",               emblem: makeEmblem("SA"),  type: "LEAGUE" },
  { code: "BL1", name: "Bundesliga",            emblem: makeEmblem("BL1"), type: "LEAGUE" },
  { code: "FL1", name: "Ligue 1",               emblem: makeEmblem("FL1"), type: "LEAGUE" },
  { code: "BSA", name: "Brasileirao Serie A",   emblem: makeEmblem("BSA"), type: "LEAGUE" },
];

export const DEFAULT_COMPETITION_CODE = "WC";

export const getCompetitionByCode = (code?: string): CompetitionOption => {
  const normalized = (code || DEFAULT_COMPETITION_CODE).toUpperCase();
  return (
    COMPETITION_OPTIONS.find((option) => option.code === normalized) || {
      code: normalized,
      name: normalized,
      emblem: makeEmblem(normalized),
      type: "CUP" as const,
    }
  );
};

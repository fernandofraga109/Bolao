export interface CompetitionOption {
  code: string;
  name: string;
  emblem: string;
}

const makeEmblem = (code: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(code)}&size=64&background=0f172a&color=22c55e&rounded=true&bold=true`;

export const COMPETITION_OPTIONS: CompetitionOption[] = [
  { code: "WC", name: "Copa do Mundo", emblem: makeEmblem("WC") },
  { code: "CL", name: "Champions League", emblem: makeEmblem("CL") },
  { code: "PL", name: "Premier League", emblem: makeEmblem("PL") },
  { code: "PD", name: "La Liga", emblem: makeEmblem("PD") },
  { code: "SA", name: "Serie A", emblem: makeEmblem("SA") },
  { code: "BL1", name: "Bundesliga", emblem: makeEmblem("BL1") },
  { code: "FL1", name: "Ligue 1", emblem: makeEmblem("FL1") },
  { code: "BSA", name: "Brasileirao Serie A", emblem: makeEmblem("BSA") },
];

export const DEFAULT_COMPETITION_CODE = "WC";

export const getCompetitionByCode = (code?: string): CompetitionOption => {
  const normalized = (code || DEFAULT_COMPETITION_CODE).toUpperCase();
  return (
    COMPETITION_OPTIONS.find((option) => option.code === normalized) || {
      code: normalized,
      name: normalized,
      emblem: makeEmblem(normalized),
    }
  );
};

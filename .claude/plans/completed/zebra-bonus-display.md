# Plano: Mostrar bônus zebra na tag + reformular cálculo

_Status: DONE — 2026-05-11_
_Last updated: 2026-05-11_

---

## Contexto

A tag ZEBRA no MatchCard exibe o time azarão, mas não informa quanto de bônus o usuário vai ganhar se acertar.
Além disso, a fórmula atual (`ceil(diff × 0.25)` com threshold rígido de 10) é grosseira — qualquer zebra com diff > 10 começa direto em 3 pts e chega a 5 pts muito rápido.

A nova abordagem usa fator `0.030` com `floor`, tornando o bônus proporcional e gradual:
- Bônus começa naturalmente em diff ≥ 34 (sem threshold rígido)
- Escala suave: +1 pt ao redor de diff ~53, +5 pts ao redor de diff ≥ 167
- `minRankDiff` default passa a 0 — o próprio cálculo descarta diffs pequenas

---

## Tabela de referência

| rankDiff | bônus (`floor(diff × 0.030)`) |
|----------|-------------------------------|
| < 34     | 0 pts                         |
| 34–66    | 1 pt                          |
| 67–99    | 2 pts                         |
| 100–133  | 3 pts                         |
| 134–166  | 4 pts                         |
| ≥ 167    | 5 pts (cap)                   |

---

## Mudanças

### 1. `utils/scoring.ts`

Alterar as três constantes internas:

```ts
// antes:
const UNDERDOG_BONUS_FACTOR = 0.25;
const MAX_UNDERDOG_BONUS = 5;
const FALLBACK_MIN_RANK_DIFF = 10;

// depois:
const UNDERDOG_BONUS_FACTOR = 0.03;
const MAX_UNDERDOG_BONUS = 5;
const FALLBACK_MIN_RANK_DIFF = 0;
```

Alterar `Math.ceil` para `Math.floor` em `calculateUnderdogBonus`:

```ts
// antes:
const calculatedBonus = Math.ceil(diff * UNDERDOG_BONUS_FACTOR);

// depois:
const calculatedBonus = Math.floor(diff * UNDERDOG_BONUS_FACTOR);
```

---

### 2. `contexts/DatabaseContext.tsx` — linha 143

Atualizar o default de `systemConfig` para ser consistente:

```ts
// antes:
underdog_min_rank_diff: 10,

// depois:
underdog_min_rank_diff: 0,
```

---

### 3. `components/MatchCard.tsx`

**A. Reestruturar as variáveis de zebra (linhas 122–126)**

Substituir o bloco atual por:

```ts
const underdogTeam = (match.homeTeam?.ranking ?? 0) > (match.awayTeam?.ranking ?? 0)
  ? match.homeTeam
  : match.awayTeam;
const favoriteTeam = underdogTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
const zebraBonus = calculateUnderdogBonus(
  underdogTeam?.ranking,
  favoriteTeam?.ranking,
  minRankDiff ?? 0,
);
const isZebraCandidate = match.status === MatchStatus.SCHEDULED && zebraBonus > 0;
```

`rankDiff` pode ser removido (não é mais usado diretamente).
`calculateUnderdogBonus` já está importado — nenhuma nova importação necessária.

**B. Atualizar a tag ZEBRA (linhas 193–201)**

```tsx
{isZebraCandidate && (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
    <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">ZEBRA</span>
    {underdogTeam?.flag && (
      <img src={underdogTeam.flag} alt={underdogTeam.name} className="w-3.5 h-3.5 rounded-sm object-cover" />
    )}
    <span className="text-[10px] text-amber-400 truncate max-w-[60px]">{underdogTeam?.name}</span>
    <span className="text-[10px] font-black text-amber-300">+{zebraBonus}pts</span>
  </div>
)}
```

**C. Fix bug: passar `minRankDiff` em `getScoringDetails` (linha ~145)**

```ts
// antes:
bonus = calculateUnderdogBonus(winnerRank, loserRank);

// depois:
bonus = calculateUnderdogBonus(winnerRank, loserRank, minRankDiff ?? 0);
```

---

### 4. `components/RulesSection.tsx`

O texto "maior que {minRankDiff} posições" fica sem sentido com default 0.
Substituir pela descrição proporcional:

```tsx
// antes:
<b>Bônus Zebra:</b> Bônus extra quando um time zebra vence. Aplicado apenas quando a diferença de ranking FIFA for maior que {minRankDiff} posições (+1pt a +5pts).

// depois:
<b>Bônus Zebra:</b> Bônus extra quando um time zebra vence. Quanto maior a diferença de ranking FIFA entre os times, maior o bônus (+1pt a +5pts).
```

`minRankDiff` prop continua existindo (útil se admin quiser threshold customizado), mas não aparece mais no texto estático.

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `utils/scoring.ts` | `FACTOR 0.25→0.03`, `FALLBACK 10→0`, `ceil→floor` |
| `contexts/DatabaseContext.tsx` | `underdog_min_rank_diff: 10 → 0` |
| `components/MatchCard.tsx` | Reestrutura variáveis, exibe `+{zebraBonus}pts`, fix bug getScoringDetails |
| `components/RulesSection.tsx` | Texto proporcional, remove referência ao threshold numérico |

---

## Verificação

1. Jogo SCHEDULED com dois times com rankings próximos (diff < 34) → tag ZEBRA **não** aparece
2. Jogo SCHEDULED com diff ~53 → tag ZEBRA aparece com **+1pt**
3. Jogo SCHEDULED com diff ~100 → tag mostra **+3pts**
4. Jogo encerrado com vitória da zebra → bônus no card bate com o que estava na tag antes do jogo
5. Build limpo: `npm run build`

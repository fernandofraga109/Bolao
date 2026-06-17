# MatchCard — comportamento de palpite

`components/MatchCard.tsx` é o card de uma partida: exibe times, placar/resultado,
entrada de palpite (steppers + inputs) e o painel "O que a galera acha".

## Sincronização de inputs com o palpite do servidor (anti-revert do realtime)

O card guarda o palpite do usuário em estado local (`homeInput` / `awayInput` /
`whoClassifiesTeamId`) e recebe o palpite salvo via prop `userPrediction`, que é
atualizada pelo realtime do Supabase.

**Problema corrigido:** o realtime reemite `userPrediction` periodicamente, mesmo
sem mudança de valor (nova identidade de objeto a cada update). O `useEffect` de
inicialização reescrevia os inputs a cada reemissão, então uma **edição local
ainda não salva era revertida** — ex.: usuário tem 3x1 salvo, muda para 3x2, e
após ~15s (sem clicar em Salvar) o card voltava para 3x1. Para o usuário parece
bug: o placar que ele queria some.

**Solução:** um `lastSyncedRef` guarda os últimos valores efetivamente vindos do
servidor. O `useEffect` só sobrescreve os inputs quando o palpite do servidor
**realmente muda** (`matchId`/`home`/`away`/`who` diferentes do último aplicado):

- Reemissão do realtime com os mesmos valores → `serverChanged === false` →
  inputs preservados (edição local intacta).
- Palpite novo, edição salva, ou alteração vinda de outro dispositivo →
  `serverChanged === true` → inputs re-sincronizados.

Trade-off aceito: se o mesmo palpite for alterado **em outro dispositivo**
enquanto há uma edição local não salva, a mudança remota prevalece e sobrescreve
o input local (cenário raro).

## Badge do grupo do jogo

O header do card exibe um badge com o grupo/fase da partida ao lado da data/hora,
para o usuário saber a que grupo a partida pertence enquanto palpita. Renderizado
apenas quando `match.group` existe.

O valor cru vem da API em formatos como `GROUP_I` / `GROUP_J`, então é
normalizado por `translateGroupName` (`utils/translations.ts`) antes de exibir
(ex.: `GROUP_I` → "Grupo I", `ROUND_OF_16` → "Oitavas"). Sempre usar esse helper
para rótulos de grupo/fase em vez do valor cru.


import { TEAMS } from './teams';
import { Team } from '../types';

export const TOURNAMENT_GROUPS: Record<string, Team[]> = {
  'A': [TEAMS.mex, TEAMS.rsa, TEAMS.kor, TEAMS.uefa_d],
  'B': [TEAMS.can, TEAMS.uefa_a, TEAMS.qat, TEAMS.sui],
  'C': [TEAMS.bra, TEAMS.mar, TEAMS.hai, TEAMS.sco],
  'D': [TEAMS.usa, TEAMS.par, TEAMS.aus, TEAMS.uefa_c],
  'E': [TEAMS.ger, TEAMS.cuw, TEAMS.civ, TEAMS.ecu],
  'F': [TEAMS.ned, TEAMS.jpn, TEAMS.uefa_b, TEAMS.tun],
  'G': [TEAMS.bel, TEAMS.egy, TEAMS.irn, TEAMS.nzl],
  'H': [TEAMS.esp, TEAMS.cpv, TEAMS.ksa, TEAMS.uru],
  'I': [TEAMS.fra, TEAMS.sen, TEAMS.ic_2, TEAMS.nor],
  'J': [TEAMS.arg, TEAMS.alg, TEAMS.aut, TEAMS.jor],
  'K': [TEAMS.por, TEAMS.ic_1, TEAMS.uzb, TEAMS.col],
  'L': [TEAMS.eng, TEAMS.cro, TEAMS.gha, TEAMS.pan],
};

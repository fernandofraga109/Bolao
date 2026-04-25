
import { Team } from '../types';

export const TEAMS: Record<string, Team> = {
  // --- POT 1 (Hosts + Top 9) ---
  usa: { id: 'usa', name: 'Estados Unidos', code: 'USA', flag: 'https://flagcdn.com/w160/us.png', ranking: 16, pot: 1 },
  mex: { id: 'mex', name: 'México', code: 'MEX', flag: 'https://flagcdn.com/w160/mx.png', ranking: 15, pot: 1 },
  can: { id: 'can', name: 'Canadá', code: 'CAN', flag: 'https://flagcdn.com/w160/ca.png', ranking: 30, pot: 1 },
  esp: { id: 'esp', name: 'Espanha', code: 'ESP', flag: 'https://flagcdn.com/w160/es.png', ranking: 2, pot: 1 },
  arg: { id: 'arg', name: 'Argentina', code: 'ARG', flag: 'https://flagcdn.com/w160/ar.png', ranking: 3, pot: 1 },
  fra: { id: 'fra', name: 'França', code: 'FRA', flag: 'https://flagcdn.com/w160/fr.png', ranking: 1, pot: 1 },
  eng: { id: 'eng', name: 'Inglaterra', code: 'ENG', flag: 'https://flagcdn.com/w160/gb-eng.png', ranking: 4, pot: 1 },
  bra: { id: 'bra', name: 'Brasil', code: 'BRA', flag: 'https://flagcdn.com/w160/br.png', ranking: 6, pot: 1 },
  por: { id: 'por', name: 'Portugal', code: 'POR', flag: 'https://flagcdn.com/w160/pt.png', ranking: 5, pot: 1 },
  ned: { id: 'ned', name: 'Holanda', code: 'NED', flag: 'https://flagcdn.com/w160/nl.png', ranking: 7, pot: 1 },
  bel: { id: 'bel', name: 'Bélgica', code: 'BEL', flag: 'https://flagcdn.com/w160/be.png', ranking: 9, pot: 1 },
  ger: { id: 'ger', name: 'Alemanha', code: 'GER', flag: 'https://flagcdn.com/w160/de.png', ranking: 10, pot: 1 },

  // --- POT 2 ---
  cro: { id: 'cro', name: 'Croácia', code: 'CRO', flag: 'https://flagcdn.com/w160/hr.png', ranking: 11, pot: 2 },
  mar: { id: 'mar', name: 'Marrocos', code: 'MAR', flag: 'https://flagcdn.com/w160/ma.png', ranking: 8, pot: 2 },
  col: { id: 'col', name: 'Colômbia', code: 'COL', flag: 'https://flagcdn.com/w160/co.png', ranking: 13, pot: 2 },
  uru: { id: 'uru', name: 'Uruguai', code: 'URU', flag: 'https://flagcdn.com/w160/uy.png', ranking: 17, pot: 2 },
  sui: { id: 'sui', name: 'Suíça', code: 'SUI', flag: 'https://flagcdn.com/w160/ch.png', ranking: 19, pot: 2 },
  jpn: { id: 'jpn', name: 'Japão', code: 'JPN', flag: 'https://flagcdn.com/w160/jp.png', ranking: 18, pot: 2 },
  sen: { id: 'sen', name: 'Senegal', code: 'SEN', flag: 'https://flagcdn.com/w160/sn.png', ranking: 14, pot: 2 },
  irn: { id: 'irn', name: 'Irã', code: 'IRN', flag: 'https://flagcdn.com/w160/ir.png', ranking: 21, pot: 2 },
  kor: { id: 'kor', name: 'Coreia do Sul', code: 'KOR', flag: 'https://flagcdn.com/w160/kr.png', ranking: 25, pot: 2 },
  ecu: { id: 'ecu', name: 'Equador', code: 'ECU', flag: 'https://flagcdn.com/w160/ec.png', ranking: 23, pot: 2 },
  aut: { id: 'aut', name: 'Áustria', code: 'AUT', flag: 'https://flagcdn.com/w160/at.png', ranking: 24, pot: 2 },
  aus: { id: 'aus', name: 'Austrália', code: 'AUS', flag: 'https://flagcdn.com/w160/au.png', ranking: 27, pot: 2 },

  // --- POT 3 ---
  nor: { id: 'nor', name: 'Noruega', code: 'NOR', flag: 'https://flagcdn.com/w160/no.png', ranking: 31, pot: 3 },
  pan: { id: 'pan', name: 'Panamá', code: 'PAN', flag: 'https://flagcdn.com/w160/pa.png', ranking: 33, pot: 3 },
  egy: { id: 'egy', name: 'Egito', code: 'EGY', flag: 'https://flagcdn.com/w160/eg.png', ranking: 29, pot: 3 },
  alg: { id: 'alg', name: 'Argélia', code: 'ALG', flag: 'https://flagcdn.com/w160/dz.png', ranking: 28, pot: 3 },
  sco: { id: 'sco', name: 'Escócia', code: 'SCO', flag: 'https://flagcdn.com/w160/gb-sct.png', ranking: 43, pot: 3 },
  par: { id: 'par', name: 'Paraguai', code: 'PAR', flag: 'https://flagcdn.com/w160/py.png', ranking: 40, pot: 3 },
  tun: { id: 'tun', name: 'Tunísia', code: 'TUN', flag: 'https://flagcdn.com/w160/tn.png', ranking: 44, pot: 3 },
  civ: { id: 'civ', name: 'C. do Marfim', code: 'CIV', flag: 'https://flagcdn.com/w160/ci.png', ranking: 34, pot: 3 },
  uzb: { id: 'uzb', name: 'Uzbequistão', code: 'UZB', flag: 'https://flagcdn.com/w160/uz.png', ranking: 50, pot: 3 },
  qat: { id: 'qat', name: 'Catar', code: 'QAT', flag: 'https://flagcdn.com/w160/qa.png', ranking: 55, pot: 3 },
  ksa: { id: 'ksa', name: 'Arábia Saudita', code: 'KSA', flag: 'https://flagcdn.com/w160/sa.png', ranking: 61, pot: 3 },
  rsa: { id: 'rsa', name: 'África do Sul', code: 'RSA', flag: 'https://flagcdn.com/w160/za.png', ranking: 60, pot: 3 },

  // --- POT 4 ---
  jor: { id: 'jor', name: 'Jordânia', code: 'JOR', flag: 'https://flagcdn.com/w160/jo.png', ranking: 63, pot: 4 },
  cpv: { id: 'cpv', name: 'Cabo Verde', code: 'CPV', flag: 'https://flagcdn.com/w160/cv.png', ranking: 69, pot: 4 },
  gha: { id: 'gha', name: 'Gana', code: 'GHA', flag: 'https://flagcdn.com/w160/gh.png', ranking: 74, pot: 4 },
  cuw: { id: 'cuw', name: 'Curaçao', code: 'CUW', flag: 'https://flagcdn.com/w160/cw.png', ranking: 82, pot: 4 },
  hai: { id: 'hai', name: 'Haiti', code: 'HAI', flag: 'https://flagcdn.com/w160/ht.png', ranking: 83, pot: 4 },
  nzl: { id: 'nzl', name: 'Nova Zelândia', code: 'NZL', flag: 'https://flagcdn.com/w160/nz.png', ranking: 85, pot: 4 },
  
  // Playoff Winners (Pot 4)
  uefa_a: { id: 'uefa_a', name: 'Repescagem UEFA A', code: 'EUA', flag: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', ranking: 43, pot: 4 },
  uefa_b: { id: 'uefa_b', name: 'Repescagem UEFA B', code: 'EUB', flag: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', ranking: 44, pot: 4 },
  uefa_c: { id: 'uefa_c', name: 'Repescagem UEFA C', code: 'EUC', flag: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', ranking: 45, pot: 4 },
  uefa_d: { id: 'uefa_d', name: 'Repescagem UEFA D', code: 'EUD', flag: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', ranking: 46, pot: 4 },
  ic_1: { id: 'ic_1', name: 'Repescagem IC 1', code: 'IC1', flag: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/FIFA_logo_without_slogan.svg', ranking: 47, pot: 4 },
  ic_2: { id: 'ic_2', name: 'Repescagem IC 2', code: 'IC2', flag: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/FIFA_logo_without_slogan.svg', ranking: 48, pot: 4 },
};

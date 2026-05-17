UPDATE matches
SET minute = 45
WHERE status = 'LIVE';

UPDATE v2_matches
SET minute = 45
WHERE status = 'LIVE';

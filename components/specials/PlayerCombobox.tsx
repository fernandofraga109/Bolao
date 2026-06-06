import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PlayerWithContextDB } from '../../types';
import { useDatabase } from '../../contexts/DatabaseContext';

export interface PlayerComboboxProps {
    value: string;           // current UUID (may be empty)
    displayName: string;     // current display name (may be empty)
    placeholder: string;
    disabled: boolean;
    accentClass: string;     // border color when a value is selected (e.g. correctness highlight)
    onSelect: (id: string, name: string) => void;
    onClear: () => void;
    filterPosition?: string;  // if set, only show players with this position (e.g. "Goalkeeper")
    competitionCode?: string; // if set, scope the search to a single competition
}

// API squad positions can be coarse ("Goalkeeper") or detailed; match defensively.
const isGoalkeeper = (position?: string) =>
    (position || '').toLowerCase().includes('goalkeeper');

const matchesPosition = (position: string | undefined, filterPosition: string) =>
    filterPosition === 'Goalkeeper' ? isGoalkeeper(position) : position === filterPosition;

/**
 * Autocomplete combobox backed by `db.searchPlayers`.
 *
 * Display rule: while the field is being edited (focused), it shows the live
 * `query`; otherwise it shows the selected player's `displayName`. Focus seeds
 * the query with the current name so the selection never visually disappears.
 */
export const PlayerCombobox: React.FC<PlayerComboboxProps> = ({
    value,
    displayName,
    placeholder,
    disabled,
    accentClass,
    onSelect,
    onClear,
    filterPosition,
    competitionCode,
}) => {
    const db = useDatabase();
    const [query, setQuery] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [results, setResults] = useState<PlayerWithContextDB[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reqIdRef = useRef(0); // guards against out-of-order async responses

    // Close + reset on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsEditing(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const runSearch = (val: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (val.trim().length < 2) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const reqId = ++reqIdRef.current;
        debounceRef.current = setTimeout(async () => {
            try {
                let found = await db.searchPlayers(val.trim(), competitionCode);
                if (filterPosition) {
                    found = found.filter((p) => matchesPosition(p.position, filterPosition));
                }
                if (reqId === reqIdRef.current) setResults(found);
            } catch {
                if (reqId === reqIdRef.current) setResults([]);
            } finally {
                if (reqId === reqIdRef.current) setIsLoading(false);
            }
        }, 300);
    };

    const handleFocus = () => {
        if (disabled) return;
        setIsEditing(true);
        setQuery(displayName); // keep the current name visible & editable
        setIsOpen(true);
        if (displayName.trim().length >= 2) runSearch(displayName);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setIsEditing(true);
        setIsOpen(true);
        runSearch(val);
    };

    const handleSelect = (player: PlayerWithContextDB) => {
        onSelect(player.id, player.name);
        setIsEditing(false);
        setIsOpen(false);
        setQuery('');
        setResults([]);
        inputRef.current?.blur();
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClear();
        setIsEditing(false);
        setIsOpen(false);
        setQuery('');
        setResults([]);
    };

    const playersNotSynced = db.players.length === 0;
    const inputValue = isEditing ? query : displayName;
    const borderClass = value && !isEditing ? accentClass : 'border-slate-600';

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative flex items-center">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    disabled={disabled}
                    className={`w-full bg-slate-800 border ${borderClass} rounded px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 pr-8 transition-colors focus:border-amber-500`}
                />
                {value && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 text-slate-400 hover:text-white transition-colors"
                        tabIndex={-1}
                        aria-label="Limpar seleção"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {playersNotSynced && !disabled && (
                <p className="text-[10px] text-slate-500 mt-1">
                    Sincronize os elencos no Painel Admin
                </p>
            )}

            {isOpen && isEditing && !disabled && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-56 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="px-3 py-2 text-xs text-slate-400">Buscando...</div>
                    ) : query.trim().length < 2 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">Digite pelo menos 2 caracteres</div>
                    ) : results.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400">Nenhum jogador encontrado</div>
                    ) : (
                        results.map((player) => (
                            <button
                                key={player.id}
                                type="button"
                                onClick={() => handleSelect(player)}
                                className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-colors border-b border-slate-700/50 last:border-0"
                            >
                                {player.tournamentEntry?.teamCrest && (
                                    <img
                                        src={player.tournamentEntry.teamCrest}
                                        alt=""
                                        className="w-4 h-3 object-cover rounded-sm flex-shrink-0"
                                    />
                                )}
                                <span className="font-medium truncate">{player.name}</span>
                                <span className="text-slate-400 text-xs ml-auto flex-shrink-0">
                                    {player.tournamentEntry?.teamName || ''}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default PlayerCombobox;

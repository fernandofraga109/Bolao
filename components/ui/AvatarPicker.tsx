import React, { useMemo } from "react";

interface AvatarOption {
  id: string;
  label: string;
  url: string;
}

interface AvatarPickerProps {
  name: string;
  selectedUrl: string;
  onSelect: (url: string) => void;
}

interface DiceBearEntry {
  style: string;
  label: string;
  seedSuffix?: string;
  bg?: string;
}

function normalizeSeed(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_") || "user";
}

const dicebearList: DiceBearEntry[] = [
  // Base styles (25)
  { style: "adventurer", label: "Aventureiro" },
  { style: "adventurer-neutral", label: "Avent. 2" },
  { style: "avataaars", label: "Cartoon" },
  { style: "avataaars-neutral", label: "Cartoon 2" },
  { style: "big-ears", label: "Orelhas" },
  { style: "big-ears-neutral", label: "Orelhas 2" },
  { style: "big-smile", label: "Sorriso" },
  { style: "bottts", label: "Robo" },
  { style: "bottts-neutral", label: "Robo 2" },
  { style: "croodles", label: "Croodles" },
  { style: "croodles-neutral", label: "Crood. 2" },
  { style: "fun-emoji", label: "Emoji" },
  { style: "identicon", label: "Geometrico" },
  { style: "initials", label: "Iniciais" },
  { style: "lorelei", label: "Lorelei" },
  { style: "lorelei-neutral", label: "Lorelei 2" },
  { style: "micah", label: "Micah" },
  { style: "miniavs", label: "Mini" },
  { style: "notionists", label: "Notion" },
  { style: "notionists-neutral", label: "Notion 2" },
  { style: "open-peeps", label: "Peeps" },
  { style: "pixel-art", label: "Pixel" },
  { style: "pixel-art-neutral", label: "Pixel 2" },
  { style: "rings", label: "Aneis" },
  { style: "shapes", label: "Formas" },
  { style: "thumbs", label: "Polegar" },
  // Seed variations (different avatar from same style)
  { style: "avataaars", label: "Cartoon 3", seedSuffix: "_alt" },
  { style: "bottts", label: "Robo 3", seedSuffix: "_alt" },
  { style: "adventurer", label: "Avent. 3", seedSuffix: "_alt" },
  { style: "lorelei", label: "Lorelei 3", seedSuffix: "_alt" },
  { style: "open-peeps", label: "Peeps 2", seedSuffix: "_alt" },
  { style: "micah", label: "Micah 2", seedSuffix: "_alt" },
  { style: "croodles", label: "Crood. 3", seedSuffix: "_alt" },
  { style: "fun-emoji", label: "Emoji 2", seedSuffix: "_alt" },
  { style: "miniavs", label: "Mini 2", seedSuffix: "_alt" },
  { style: "notionists", label: "Notion 3", seedSuffix: "_alt" },
  { style: "big-smile", label: "Sorriso 2", seedSuffix: "_alt" },
  { style: "pixel-art", label: "Pixel 3", seedSuffix: "_alt" },
  // Extra seed variations (different characters)
  { style: "bottts", label: "Robo 4", seedSuffix: "_v2" },
  { style: "avataaars", label: "Cartoon 4", seedSuffix: "_v2" },
  { style: "adventurer", label: "Avent. 4", seedSuffix: "_v2" },
  { style: "croodles", label: "Crood. 4", seedSuffix: "_v2" },
  { style: "lorelei", label: "Lorelei 4", seedSuffix: "_v2" },
  { style: "open-peeps", label: "Peeps 3", seedSuffix: "_v2" },
  { style: "micah", label: "Micah 3", seedSuffix: "_v2" },
  { style: "miniavs", label: "Mini 3", seedSuffix: "_v2" },
  { style: "notionists", label: "Notion 4", seedSuffix: "_v2" },
  { style: "pixel-art", label: "Pixel 4", seedSuffix: "_v2" },
  { style: "fun-emoji", label: "Emoji 3", seedSuffix: "_v2" },
];

const AvatarPicker: React.FC<AvatarPickerProps> = ({ name, selectedUrl, onSelect }) => {
  const seed = useMemo(() => normalizeSeed(name), [name]);

  const options: AvatarOption[] = useMemo(() => {
    const opts: AvatarOption[] = [
      {
        id: "ui-avatars",
        label: "Letras",
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`,
      },
    ];

    dicebearList.forEach(({ style, label, seedSuffix, bg }) => {
      const s = seed + (seedSuffix || "");
      const id = seedSuffix
        ? `dicebear-${style}-${seedSuffix}${bg ? `-${bg}` : ""}`
        : bg
          ? `dicebear-${style}-bg-${bg}`
          : `dicebear-${style}`;
      const url = bg
        ? `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(s)}&backgroundColor=${bg}`
        : `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(s)}&backgroundColor=transparent`;
      opts.push({ id, label, url });
    });

    return opts;
  }, [seed, name]);

  const isSelected = (url: string) => selectedUrl === url;

  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
        Escolher Avatar ({options.length})
      </label>
      <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.url)}
            className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
              isSelected(opt.url)
                ? "border-brand-green bg-brand-green/10"
                : "border-slate-800 bg-slate-950 hover:border-slate-600"
            }`}
          >
            <img
              src={opt.url}
              alt={opt.label}
              className="w-10 h-10 rounded-full object-cover"
              loading="lazy"
            />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
              {opt.label}
            </span>
            {isSelected(opt.url) && (
              <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-brand-green ring-2 ring-slate-900" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AvatarPicker;

/**
 * Procedural product artwork. The platform ships without licensed imagery, so every SKU renders a glossy,
 * deterministic tile derived from its name and accent. Replace with real photography via `imageKey` + storage adapter.
 */
const ACCENTS: Record<string, [string, string, string]> = {
  violet: ["#7c3aed", "#a78bfa", "#22d3ee"],
  cyan: ["#0891b2", "#22d3ee", "#a78bfa"],
  amber: ["#b45309", "#fbbf24", "#f472b6"],
  rose: ["#be123c", "#fb7185", "#a78bfa"],
  emerald: ["#047857", "#34d399", "#22d3ee"],
  slate: ["#334155", "#94a3b8", "#c4b5fd"],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function ItemArt({ name, accent = "violet", imageKey, className, size = "md", label }: { name: string; accent?: string; imageKey?: string | null; className?: string; size?: "sm" | "md" | "lg" | "xl"; label?: string }) {
  const [a, b, c] = ACCENTS[accent] ?? ACCENTS.violet;
  const h = hash(name);
  const rot = h % 360;
  const initials = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const id = `g${h.toString(36)}`;
  const dims = size === "sm" ? "h-14 w-14" : size === "md" ? "h-24 w-24" : size === "lg" ? "h-40 w-40" : "h-56 w-56";
  if (imageKey) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/v1/media/${encodeURIComponent(imageKey)}`} alt={name} className={`${dims} rounded-2xl object-cover ${className ?? ""}`} />;
  }
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label ?? name} className={`${dims} shrink-0 rounded-2xl ${className ?? ""}`} style={{ boxShadow: "0 12px 30px -12px rgba(0,0,0,.8)" }}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${rot % 60} .5 .5)`}>
          <stop offset="0%" stopColor={a} />
          <stop offset="60%" stopColor={b} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}r`} cx="0.3" cy="0.2" r="0.9">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="16" fill="#0b0d15" />
      <rect x="4" y="4" width="92" height="92" rx="13" fill={`url(#${id}a)`} />
      <rect x="4" y="4" width="92" height="92" rx="13" fill={`url(#${id}r)`} />
      <g opacity="0.9">
        <circle cx={30 + (h % 40)} cy={28 + ((h >> 4) % 30)} r={18 + ((h >> 8) % 10)} fill="#fff" opacity="0.10" />
        <circle cx={70 - (h % 30)} cy={72 - ((h >> 6) % 20)} r={10 + ((h >> 10) % 8)} fill="#000" opacity="0.15" />
      </g>
      <rect x="4" y="4" width="92" height="46" rx="13" fill={`url(#${id}s)`} />
      <text x="50" y="58" textAnchor="middle" fontFamily="Syne, Inter, sans-serif" fontWeight="800" fontSize="30" fill="#fff" opacity="0.95" style={{ letterSpacing: "-0.03em" }}>
        {initials}
      </text>
      <rect x="4" y="4" width="92" height="92" rx="13" fill="none" stroke="#fff" strokeOpacity="0.25" />
    </svg>
  );
}

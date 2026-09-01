export function mmss(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function parseDuracion(d?: string): number | null {
  if (!d) return null;
  const m = d.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function fechaLegible(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Resolve the shared CSS color tokens for canvas APIs. CSS remains the source of truth. */
export function colorToken(name: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`).trim();
  if (!value) throw new Error(`Missing design color token: ${name}`);
  return value;
}

/** Derive chart transparency from a palette color instead of another independent swatch. */
export function colorWithAlpha(name: string, alpha: number): string {
  const hex = colorToken(name).replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Expected hex palette token: ${name}`);
  return `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${alpha})`;
}

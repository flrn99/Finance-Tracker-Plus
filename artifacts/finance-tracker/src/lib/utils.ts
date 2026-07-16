import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Paleta de categorías fija (16 colores en categories.tsx) — algunos son muy claros
// (amarillos, limas), así que el texto sobre el color sólido se decide por contraste real,
// no se asume blanco. Usado en cualquier pill/chip que se rellena con el color real de una categoría.
export function readableTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrastWhite = 1.05 / (luminance + 0.05);
  const contrastBlack = (luminance + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#f9f8f8" : "#020203";
}

// --- Variante "segura para texto plano" de un color de categoría --------------------
// A diferencia de readableTextColor (elige blanco/negro para texto SOBRE el color),
// esto genera una versión del mismo color (mismo hue/chroma en OKLCH) ajustando solo
// la luminosidad hasta pasar 4.5:1 contra el fondo de PÁGINA — para category.color
// usado directamente como color de texto (ej. nombre de categoría en Transactions).
export const LIGHT_PAGE_BG = "#f5f3ef"; // hsl(40 25% 95%) — fondo claro real (index.css)
export const DARK_PAGE_BG = "#141414"; // hsl(0 0% 8%) — fondo oscuro real (index.css)
export const LIGHT_CARD_BG = "#fdfdfc"; // hsl(40 30% 99%) — --card en index.css
export const DARK_CARD_BG = "#1c1c1c"; // hsl(0 0% 11%) — --card en index.css

function hexToRgb01(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function rgb01ToHex([r, g, b]: [number, number, number]): string {
  const clamp = (c: number) => Math.max(0, Math.min(1, c));
  const toHex = (c: number) => Math.round(clamp(c) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Composita fgHex con alpha sobre bgHex, tal cual lo hace el browser con un hex+alpha
// (`${color}1F`) — mezcla directa en sRGB, sin pasar por espacio lineal, porque así es
// como CSS realmente lo pinta. Sirve para saber cómo se ve un tinte antes de elegir
// qué color de texto sigue siendo legible encima.
export function compositeHex(fgHex: string, bgHex: string, alpha: number): string {
  const fg = hexToRgb01(fgHex);
  const bg = hexToRgb01(bgHex);
  const mixed: [number, number, number] = [
    alpha * fg[0] + (1 - alpha) * bg[0],
    alpha * fg[1] + (1 - alpha) * bg[1],
    alpha * fg[2] + (1 - alpha) * bg[2],
  ];
  return rgb01ToHex(mixed);
}

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c: number) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb01(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function wcagContrast(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb01(hex).map(srgbToLinear) as [number, number, number];
  const [L, a, b2] = linearRgbToOklab(r, g, b);
  const C = Math.sqrt(a * a + b2 * b2);
  const H = Math.atan2(b2, a);
  return [L, C, H];
}

function oklchToRgb(L: number, C: number, H: number) {
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const [rl, gl, bl] = oklabToLinearRgb(L, a, b);
  const inGamut = [rl, gl, bl].every((c) => c >= -1e-4 && c <= 1 + 1e-4);
  const hex = rgb01ToHex([linearToSrgb(rl), linearToSrgb(gl), linearToSrgb(bl)]);
  return { hex, inGamut };
}

const textVariantCache = new Map<string, string>();

// Busca, en una sola dirección (hacia blanco o hacia negro desde L0), el L más
// cercano a L0 que todavía pase el contraste mínimo. Devuelve null si ni el extremo
// de esa dirección alcanza — o sea, no hay solución de ese lado.
function closestPassingL(
  L0: number,
  passes: (L: number) => boolean,
  direction: "up" | "down"
): number | null {
  const extreme = direction === "up" ? 1 : 0;
  if (!passes(extreme)) return null;

  let lo = direction === "up" ? L0 : extreme;
  let hi = direction === "up" ? extreme : L0;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const ok = passes(mid);
    if (direction === "up") {
      if (ok) hi = mid; else lo = mid;
    } else {
      if (ok) lo = mid; else hi = mid;
    }
  }
  return direction === "up" ? hi : lo;
}

// Ajusta la luminosidad de `hex` (mismo H/C, chroma recortado si hace falta para
// entrar en gamut) hasta que contraste >= minContrast contra bgHex, moviéndose lo
// menos posible desde el color original. A diferencia de un truco "oscurecer si el
// fondo es claro", prueba las DOS direcciones (más claro y más oscuro) y se queda con
// la que quede más cerca del original — necesario porque el color base puede empezar
// más claro O más oscuro que el fondo según el caso (un tono de categoría vs. blanco
// puro no se comportan igual).
export function categoryTextColor(hex: string, bgHex: string, minContrast = 4.5): string {
  const cacheKey = `${hex}|${bgHex}|${minContrast}`;
  const cached = textVariantCache.get(cacheKey);
  if (cached) return cached;

  const [L0, C0, H] = hexToOklch(hex);

  // Reduce el chroma en pasos hasta que el color entre en gamut sRGB a esa luminosidad —
  // necesario porque oscurecer/aclarar mucho un hue muy saturado puede quedar fuera de gamut.
  const safeChromaAt = (L: number) => {
    let C = C0;
    for (let i = 0; i < 20 && !oklchToRgb(L, C, H).inGamut; i++) C *= 0.9;
    return C;
  };

  const candidateAt = (L: number) => oklchToRgb(L, safeChromaAt(L), H).hex;
  const passes = (L: number) => wcagContrast(candidateAt(L), bgHex) >= minContrast;

  if (passes(L0)) {
    textVariantCache.set(cacheKey, hex);
    return hex; // ya pasa tal cual, no hace falta tocarlo
  }

  const Lup = closestPassingL(L0, passes, "up");
  const Ldown = closestPassingL(L0, passes, "down");

  let finalL: number;
  if (Lup === null && Ldown === null) {
    finalL = 0; // no debería ocurrir: negro puro siempre da contraste alto contra cualquier bg
  } else if (Lup === null) {
    finalL = Ldown as number;
  } else if (Ldown === null) {
    finalL = Lup;
  } else {
    finalL = Math.abs(Lup - L0) <= Math.abs(Ldown - L0) ? Lup : Ldown;
  }

  const result = candidateAt(finalL);
  textVariantCache.set(cacheKey, result);
  return result;
}

import { useEffect, useMemo, useState, type RefObject } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn, categoryTextColor } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import { Skeleton } from "@/components/ui/skeleton";

type SpendingEntry = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  total: number;
  percentage: number;
};

const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// Unidades abstractas del lienzo del treemap — solo importa que guarden la
// misma proporción que el aspect-ratio real del contenedor (ver className
// "aspect-[3/2]" más abajo), el squarify no necesita saber los px reales.
const CANVAS_W = 150;
const CANVAS_H = 100;
const MAX_TILES = 6;
// Los 16 colores reales de categoría (EXPENSE_COLORS/INCOME_COLORS en categories.tsx)
// resuelven TODOS a texto negro — este gris se elige a propósito para caer del
// mismo lado (zinc-500/#71717a quedaba justo en el punto de quiebre y elegía
// blanco, rompiendo la consistencia visual con el resto de los tiles).
const OTHER_COLOR = "#9ca3af";

type Rect = { x: number; y: number; w: number; h: number };

// Squarify (Bruls, Huizing, van Wijk 1999): reparte áreas proporcionales al
// valor de cada item intentando que cada rectángulo quede lo más cuadrado
// posible, en vez de tiras finitas — así el tamaño del tile SE LEE como el monto.
function worstAspectRatio(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

function squarify(values: number[], rect: Rect): Rect[] {
  const results: Rect[] = [];
  let items = values.slice();
  let cur = rect;

  while (items.length) {
    const side = Math.min(cur.w, cur.h);
    let row = [items[0]!];
    let rowWorst = worstAspectRatio(row, side);
    let i = 1;
    while (i < items.length) {
      const testRow = [...row, items[i]!];
      const testWorst = worstAspectRatio(testRow, side);
      if (testWorst <= rowWorst) {
        row = testRow;
        rowWorst = testWorst;
        i++;
      } else break;
    }
    items = items.slice(row.length);
    const rowSum = row.reduce((a, b) => a + b, 0);

    if (cur.w >= cur.h) {
      const colW = rowSum / cur.h;
      let cy = cur.y;
      for (const v of row) {
        const rh = v / colW;
        results.push({ x: cur.x, y: cy, w: colW, h: rh });
        cy += rh;
      }
      cur = { x: cur.x + colW, y: cur.y, w: cur.w - colW, h: cur.h };
    } else {
      const rowH = rowSum / cur.w;
      let cx = cur.x;
      for (const v of row) {
        const rw = v / rowH;
        results.push({ x: cx, y: cur.y, w: rw, h: rowH });
        cx += rw;
      }
      cur = { x: cur.x, y: cur.y + rowH, w: cur.w, h: cur.h - rowH };
    }
  }
  return results;
}

// Texto siempre blanco sobre el color puro de la categoría (sin degradé — el
// color se ve tal cual es). Una sombra suave de una sola dirección (no un
// contorno de 4 lados, que se leía como sticker) le da el empujón de legibilidad
// que hace falta en los tonos más claros — pareja en los 16 colores reales
// (expense + income), sin lista de excepciones: income de hecho la necesita
// más (5 de 8 fallan 3:1 con blanco plano, contra 3 de 8 en expense).
const WHITE_TEXT_SHADOW = "0 1px 4px rgba(0,0,0,.45)";

export function SpendingBreakdown({
  type,
  onTypeChange,
  periodLabel,
  data,
  isLoading,
  chartInView,
  chartRef,
}: {
  type: "expense" | "income";
  onTypeChange: (type: "expense" | "income") => void;
  periodLabel: string;
  data: SpendingEntry[] | undefined;
  isLoading: boolean;
  chartInView: boolean;
  chartRef: RefObject<HTMLDivElement>;
}) {
  const { formatAmount } = useCurrency();
  const isExpense = type === "expense";

  const total = data ? data.reduce((sum, d) => sum + d.total, 0) : 0;

  const tiles = useMemo(() => {
    if (!data || total <= 0) return [];
    const sorted = [...data].sort((a, b) => b.total - a.total);

    // Con muchas categorías chicas, squarify termina dejando tiras casi invisibles
    // al final del reparto (el área es real, pero ilegible) — se acota el treemap
    // a un puñado de tiles y el resto se agrupa en un bucket genérico. La leyenda
    // de abajo sigue mostrando cada categoría real por separado.
    // El label es "+N more", nunca "Other": si el usuario ya tiene una categoría
    // real llamada así, un nombre igual acá se pisaba con la de la leyenda y
    // parecía una categoría duplicada/mezclada.
    let display: (SpendingEntry & { isOther?: boolean })[] = sorted;
    if (sorted.length > MAX_TILES) {
      const head = sorted.slice(0, MAX_TILES - 1);
      const tail = sorted.slice(MAX_TILES - 1);
      display = [
        ...head,
        {
          categoryId: -1,
          categoryName: `+${tail.length} more`,
          categoryColor: OTHER_COLOR,
          total: tail.reduce((s, d) => s + d.total, 0),
          percentage: tail.reduce((s, d) => s + d.percentage, 0),
          isOther: true,
        },
      ];
    }

    const area = CANVAS_W * CANVAS_H;
    const values = display.map((d) => Math.max((d.total / total) * area, 0.001));
    const rects = squarify(values, { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });
    // Font-size proporcional al tamaño real del tile — calculado acá en vez de con
    // container query units (cqmin): en el WebView de Android real no escalaban
    // (todo quedaba en el mínimo del clamp), así que esto se resuelve en JS, sin
    // depender de soporte de features CSS nuevas en el dispositivo.
    return display.map((entry, i) => {
      const rect = rects[i]!;
      // minSide (no sqrt(w*h)) — un tile angosto-pero-alto puede tener área
      // decente y aun así muy poca altura real; el lado más chico es la
      // restricción de verdad para que el texto entre sin desbordar.
      const minSide = Math.min(rect.w, rect.h);
      return {
        ...entry,
        rect,
        // El % es el número hero (hasta 68px en el tile dominante), el nombre queda
        // como etiqueta chica arriba — jerarquía invertida a propósito, inspirada en
        // el "Sales Report" que trajo el usuario. Piso bajado (antes 16px mínimo
        // incluso en tiles casi del tamaño del padding) para que los tiles chicos
        // de verdad achiquen el número en vez de desbordar el tile.
        nameFontSize: Math.min(Math.max(minSide * 0.13, 7), 13),
        pctFontSize: Math.min(Math.max(minSide * 0.95, 10), 68),
      };
    });
  }, [data, total]);

  // Retrigger el grow-in cada vez que cambia el dataset (toggle de tipo o fetch nuevo)
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    if (!chartInView || !data || data.length === 0) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [type, data, chartInView]);

  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{periodLabel}</p>
          <p className="font-entry-amount text-2xl text-foreground leading-tight">{formatAmount(total)}</p>
        </div>

        {/* Toggle — flat, el color es indicador de estado (product register) */}
        <div className="relative flex items-center rounded-full bg-muted p-1 shrink-0">
          <div
            className="absolute top-1 left-1 rounded-full transition-transform duration-300 ease-out"
            style={{
              bottom: "4px",
              width: "calc(50% - 4px)",
              transform: isExpense ? "translateX(0%)" : "translateX(100%)",
              background: isExpense ? "#FF4D4D" : "#00A870",
            }}
          />
          <button
            type="button"
            onClick={() => onTypeChange("expense")}
            aria-pressed={isExpense}
            className={cn(
              "relative z-10 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
              "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']", // hit area ~44px sin agrandar el pill visual ni pisar al botón de al lado
              isExpense ? "text-white" : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            <TrendingDown className="h-3 w-3 shrink-0" />
            Expense
          </button>
          <button
            type="button"
            onClick={() => onTypeChange("income")}
            aria-pressed={!isExpense}
            className={cn(
              "relative z-10 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
              "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
              !isExpense ? "text-white" : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            <TrendingUp className="h-3 w-3 shrink-0" />
            Income
          </button>
        </div>
      </div>

      <div ref={chartRef}>
        {isLoading ? (
          <div className="flex flex-col items-center gap-5">
            <Skeleton className="aspect-[3/2] w-full rounded-2xl" />
            <div className="w-full space-y-2.5">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full rounded-full" />)}
            </div>
          </div>
        ) : data && data.length > 0 ? (
          <div className="flex flex-col">
            {/* Decorativo: la leyenda de abajo ya expone cada categoría como texto real */}
            <div aria-hidden="true" className="relative w-full overflow-hidden" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
              {tiles.map((t, i) => {
                // El texto escala con el tamaño real del tile (calculado en JS a partir
                // del rect de squarify) — así cada tile queda legible a su propia escala,
                // como un mapa de países: el gigante grita, el chico susurra.
                // Umbral subido de 8 a 14: con el padding fijo de 8px por lado, un tile
                // de 8 unidades apenas tenía lugar para el padding solo — el número
                // quedaba desbordando. Debajo de 14, el tile queda como bloque de color
                // sin texto en vez de forzar un número ilegible adentro.
                const tooSmall = t.rect.w < 14 || t.rect.h < 14;
                // Padding fijo, no escalado con el tile — el que sí escalaba dejaba
                // el % pegado a la esquina en tiles chicos (4px de aire y una letra
                // de 7px se leía como si se estuviera saliendo del tile).
                const padding = 8;
                // Mismo truco que categoryTextColor en transactions.tsx, pero arrancando
                // desde blanco: ajusta luminosidad (mismo H/C) hasta pasar 4.5:1 contra
                // el color real del tile. El shadow solo tiene sentido si el resultado
                // sigue siendo blanco — sobre un gris oscuro no aporta nada.
                const tileTextColor = categoryTextColor("#f9f8f8", t.categoryColor);
                const tileTextShadow = tileTextColor === "#f9f8f8" ? WHITE_TEXT_SHADOW : undefined;
                return (
                  <div
                    key={t.categoryId}
                    className="absolute"
                    style={{
                      left: `${(t.rect.x / CANVAS_W) * 100}%`,
                      top: `${(t.rect.y / CANVAS_H) * 100}%`,
                      width: `${(t.rect.w / CANVAS_W) * 100}%`,
                      height: `${(t.rect.h / CANVAS_H) * 100}%`,
                    }}
                  >
                    <div
                      className="absolute flex flex-col justify-between overflow-hidden"
                      style={{
                        inset: 2,
                        borderRadius: 14,
                        background: t.categoryColor,
                        color: tileTextColor,
                        padding,
                        opacity: grown ? 1 : 0,
                        transform: grown ? "scale(1)" : "scale(0.85)",
                        transition: reducedMotion
                          ? "none"
                          : `opacity 450ms ${SPRING_EASE} ${i * 40}ms, transform 450ms ${SPRING_EASE} ${i * 40}ms`,
                      }}
                    >
                      {!tooSmall && (
                        <>
                          <div
                            className="line-clamp-3 font-extrabold uppercase tracking-wide leading-[1.15] opacity-90"
                            style={{ fontSize: t.nameFontSize, overflowWrap: "anywhere", textShadow: tileTextShadow }}
                          >
                            {t.categoryName}
                          </div>
                          <span
                            className="font-entry-amount leading-[0.9] tracking-tight"
                            style={{ fontSize: t.pctFontSize, textShadow: tileTextShadow }}
                          >
                            {Math.round(t.percentage)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 w-full space-y-2.5">
              {data.map((entry) => (
                <div key={entry.categoryId} className="flex items-center text-sm font-semibold text-foreground">
                  <span className="mr-2.5 h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: entry.categoryColor }} />
                  <span className="truncate">{entry.categoryName}</span>
                  <span className="ml-auto shrink-0 tabular-nums font-bold text-muted-foreground">{formatAmount(entry.total)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[200px] flex-col items-center justify-center text-sm text-muted-foreground">
            <p>No {isExpense ? "spending" : "income"} data yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

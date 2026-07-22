import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Modal flotante compartido — antes había dos copias casi idénticas (una acá,
 * una duplicada dentro de goals.tsx) que ya causaron un bug real: un fix de
 * animación se aplicó a una y no a la otra. maxWidth/headerPaddingTop quedan
 * configurables porque las dos copias originales no usaban exactamente el
 * mismo tamaño (category-form-modal era max-w-xs/pt-4, goals era max-w-sm/pt-5)
 * — unificar el componente no debía cambiar el tamaño visual de ninguno de los dos. */
export function FloatingModal({
  open, onClose, title, children, maxWidth = "max-w-sm", headerPaddingTop = "pt-5",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  headerPaddingTop?: string;
}) {
  // open controla la intención del padre; mounted/closing quedan un beat más
  // para poder jugar la animación de salida antes de desmontar de un salto
  // (antes "if (!open) return null" lo sacaba instantáneo, sin exit).
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    // Fallback por si animationend no dispara (interrupción rara) — en el caso
    // normal, onAnimationEnd del card de abajo desmonta antes de que esto corra.
    const t = setTimeout(() => setMounted(false), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Bloquea el swipe de página del nav mientras el modal está abierto o cerrándose
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  if (!mounted) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || undefined}
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
      }}
      onClick={onClose}
    >
      <div
        className={cn("bg-black/80 duration-180", closing ? "animate-out fade-out" : "animate-in fade-in")}
        style={{
          position: "fixed",
          top: "-10vh", left: "-10vw", right: "-10vw", bottom: "-10vh",
          width: "120vw", height: "120dvh",
          animationFillMode: closing ? "forwards" : undefined,
        }}
      />
      <div
        className={cn(
          "relative w-full bg-card rounded-[36px] shadow-2xl duration-180 max-h-full overflow-y-auto",
          maxWidth,
          closing ? "animate-out fade-out slide-out-to-bottom-4" : "animate-in fade-in slide-in-from-bottom-4"
        )}
        style={{
          willChange: "transform, opacity",
          transform: "translate3d(0,0,0)",
          animationFillMode: closing ? "forwards" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => { if (closing) setMounted(false); }}
      >
        <div className={cn("flex items-center justify-between px-5 pb-3", headerPaddingTop)}>
          <p className="font-bold text-base">{title}</p>
          <button onClick={onClose} aria-label="Close" className="relative w-7 h-7 rounded-lg bg-muted flex items-center justify-center before:absolute before:-inset-2 before:content-['']">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

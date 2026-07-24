import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { App } from "@capacitor/app";
import { cn } from "@/lib/utils";

/** Modal flotante compartido — antes había dos copias casi idénticas (una acá,
 * una duplicada dentro de goals.tsx) que ya causaron un bug real: un fix de
 * animación se aplicó a una y no a la otra. maxWidth/headerPaddingTop quedan
 * configurables porque las dos copias originales no usaban exactamente el
 * mismo tamaño (category-form-modal era max-w-xs/pt-4, goals era max-w-sm/pt-5)
 * — unificar el componente no debía cambiar el tamaño visual de ninguno de los dos. */
export function FloatingModal({
  open, onClose, onBackButton, title, children, maxWidth = "max-w-sm", headerPaddingTop = "pt-5",
}: {
  open: boolean;
  onClose: () => void;
  /** Qué hace el back nativo de Android — por default es igual a onClose (cierra
   * directo, para los modales sin nada "atrás"). Los que sí tienen una vista
   * previa dentro del mismo sheet (ej. detalle → editar en Goals) pasan esto
   * para que el primer back vuelva a esa vista y recién el segundo cierre. El
   * X y el tap afuera siempre cierran directo, sin pasar por esta escala —
   * son "quiero salir ya", no "un paso atrás".*/
  onBackButton?: () => void;
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

  // onClose/onBackButton son closures nuevas en cada render del caller (ej. el
  // sheet unificado de Goals arma onBackButton leyendo `detailEditing` actual).
  // Si el efecto de abajo las tomara como dependencia directa, el listener
  // nativo se sacaría y volvería a poner en CADA render mientras el modal está
  // abierto (cada tecla tipeada en un form, por ejemplo) — con refs, el efecto
  // que arma/desarma el listener corre solo cuando `open` cambia, pero al
  // dispararse siempre lee la versión más reciente.
  const onCloseRef = useRef(onClose);
  const onBackButtonRef = useRef(onBackButton);
  useEffect(() => {
    onCloseRef.current = onClose;
    onBackButtonRef.current = onBackButton;
  });

  // Back nativo de Android: por default cierra el modal (mismo patrón que ya
  // usan entry-sheet.tsx y login.tsx), pero si el caller pasó onBackButton
  // (hay una vista "atrás" dentro del mismo sheet) usa eso en su lugar — así
  // el primer back retrocede un paso y recién un segundo back cierra de verdad.
  useEffect(() => {
    if (!open) return;
    const handler = App.addListener("backButton", () => (onBackButtonRef.current ?? onCloseRef.current)());
    return () => { handler.then((h) => h.remove()); };
  }, [open]);

  // Swipe-back de iOS: a diferencia del backButton de Android, esto NO es un
  // evento de Capacitor — es el gesto nativo de WKWebView (allowsBackForward
  // NavigationGestures en BridgeViewController.swift) navegando el MISMO
  // historial que usa wouter para las rutas. Sin esto, abrir un modal no deja
  // ningún rastro en ese historial, así que un swipe-back navegaba la página
  // de ATRÁS (ej. Goals → Dashboard) con el modal todavía flotando encima, en
  // vez de cerrarlo. El truco estándar: empujar una entrada "dummy" (misma URL,
  // no cambia la ruta) al abrir, y escuchar popstate — el swipe la consume y
  // dispara popstate en vez de navegar de verdad. Se vuelve a empujar una nueva
  // dummy en cada popstate (no solo al abrir) porque un back "parcial" (ej.
  // volver de editar a detalle dentro del mismo sheet) deja el modal abierto
  // pero sin protección para el próximo swipe si no se re-arma.
  useEffect(() => {
    if (!open) return;
    history.pushState({ floatingModal: true }, "", location.href);
    const onPopState = () => {
      (onBackButtonRef.current ?? onCloseRef.current)();
      history.pushState({ floatingModal: true }, "", location.href);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // Cierre programático (X, backdrop, back de Android) — nunca se consumió
      // la dummy vía un popstate real, hay que sacarla para que el próximo
      // swipe-back del usuario navegue de verdad en vez de "gastarse" en una
      // entrada idéntica a la actual.
      history.back();
    };
  }, [open]);

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
        className={cn(
          "bg-black/80",
          // Mismo largo que la card en la entrada para que backdrop+sheet lleguen
          // juntos — antes el backdrop (180ms) terminaba bastante antes que la
          // card, que ahora tarda más en asentarse.
          closing ? "animate-out fade-out duration-180" : "animate-in fade-in duration-[280ms]"
        )}
        style={{
          position: "fixed",
          top: "-10vh", left: "-10vw", right: "-10vw", bottom: "-10vh",
          width: "120vw", height: "120dvh",
          animationFillMode: closing ? "forwards" : undefined,
        }}
      />
      <div
        className={cn(
          "relative w-full bg-card rounded-[36px] shadow-2xl max-h-full overflow-y-auto",
          maxWidth,
          // Salida: rápida y simétrica como antes (180ms, easing default) — un
          // modal que se va no necesita desacelerar. Entrada: más lenta (280ms)
          // con easing decelerate real (sin rebote — un overshoot grande en una
          // hoja de este tamaño se siente gimmick, no premium) + más recorrido
          // de slide (-8 en vez de -4) + un scale-in sutil, para que se lea
          // como una hoja que sube y se asienta, no como un pop instantáneo.
          closing
            ? "animate-out fade-out zoom-out-95 slide-out-to-bottom-4 duration-180"
            : "animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
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

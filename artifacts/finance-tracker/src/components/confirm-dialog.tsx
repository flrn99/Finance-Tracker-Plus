import { useRef, useState, type ComponentType } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/** Confirmación de borrar/salir/etc en toda la app — reemplaza el AlertDialog
 * default de shadcn (que se veía igual en las 8 instancias del app: card blanca,
 * sin ícono, botones en fila) por la misma línea del modal de Bill: ícono en
 * círculo tintado, acción principal sólida y bold arriba, cancelar como pill
 * muted abajo. */
export function ConfirmDialog({
  trigger,
  icon: Icon,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  disabled,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "destructive" | "neutral";
  disabled?: boolean;
  /** Opcional — deja el dialog en modo controlado para callers que necesitan
   * abrirlo por su cuenta (ej. pointerup manual en vez del click nativo del
   * trigger, para toques rápidos/suaves poco confiables). Sin esto se
   * comporta como siempre (no controlado, abre por click del trigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const tint = variant === "destructive" ? "rgba(239,68,68,0.12)" : "hsl(var(--muted))";
  const iconColor = variant === "destructive" ? "hsl(var(--destructive))" : "hsl(var(--foreground))";

  // Blindaje anti-ghost-click: varios triggers de este dialog (ej. el swipe-delete
  // de Transactions) abren por onPointerUp en vez de click nativo — con toques
  // rápidos, el navegador puede sintetizar un click fantasma demorado en las
  // MISMAS coordenadas de pantalla. El dialog queda centrado ahí mismo, así que
  // ese click residual a veces cae justo sobre "Confirmar" y borra sin que el
  // usuario llegue a tocarlo de verdad. Se ignora cualquier tap en el botón de
  // confirmar durante un instante después de abrirse (mismo patrón que el
  // escudo del biometric lock).
  const [shielded, setShielded] = useState(false);
  const shieldTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next);
    if (next) {
      setShielded(true);
      if (shieldTimeout.current) clearTimeout(shieldTimeout.current);
      shieldTimeout.current = setTimeout(() => setShielded(false), 350);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-xs rounded-3xl border-0 p-6 gap-0">
        <div className="flex flex-col items-center text-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: tint }}>
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
          </div>
          <AlertDialogHeader className="items-center text-center space-y-1.5">
            <AlertDialogTitle className="text-base font-bold">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-center leading-relaxed">{description}</AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="flex-col-reverse gap-2 pt-3 sm:flex-col-reverse">
          <AlertDialogCancel className="w-full rounded-2xl border-0 bg-muted font-semibold hover:bg-muted/80">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              if (shielded) { e.preventDefault(); return; }
              onConfirm();
            }}
            disabled={disabled}
            className={cn(
              "w-full rounded-2xl font-bold border-0",
              variant === "destructive" ? "bg-destructive text-white hover:bg-destructive/90" : "bg-black text-white hover:bg-black/85"
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

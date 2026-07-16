import type { ComponentType } from "react";
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
}: {
  trigger: React.ReactNode;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "destructive" | "neutral";
  disabled?: boolean;
}) {
  const tint = variant === "destructive" ? "rgba(239,68,68,0.12)" : "hsl(var(--muted))";
  const iconColor = variant === "destructive" ? "hsl(var(--destructive))" : "hsl(var(--foreground))";

  return (
    <AlertDialog>
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
            onClick={onConfirm}
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

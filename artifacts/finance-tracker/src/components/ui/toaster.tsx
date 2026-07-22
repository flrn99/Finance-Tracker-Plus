import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        if (variant === "celebration") {
          return (
            <Toast key={id} variant={variant} {...props}>
              {/* Ícono fantasma gigante recortado en la esquina — mismo recurso que
                  el resto de las cards de la app, pero con trazo grueso: un check
                  fino se pierde al recortarse, uno grueso se sigue leyendo. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-[22px] -right-5 h-[118px] w-[118px] -rotate-6 opacity-[0.16]"
              >
                <Check className="h-full w-full" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
              </div>
              <div className="relative z-[1] grid gap-0.5">
                {title && (
                  <ToastTitle className="font-title text-[13px] uppercase tracking-tight text-[#0c1400]">
                    {title}
                  </ToastTitle>
                )}
                {description && (
                  <ToastDescription className="text-[#0c1400] opacity-70">
                    {description}
                  </ToastDescription>
                )}
              </div>
              {action}
              <ToastClose />
            </Toast>
          )
        }

        const isDestructive = variant === "destructive"
        return (
          <Toast key={id} variant={variant} {...props}>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                isDestructive ? "bg-[#FF4D4D]/20" : "bg-[#CAFA01]/20"
              )}
            >
              {isDestructive ? (
                <X className="h-3.5 w-3.5 text-[#FF4D4D]" strokeWidth={3} />
              ) : (
                <Check className="h-3.5 w-3.5 text-[#CAFA01]" strokeWidth={3} />
              )}
            </div>
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }} />
    </ToastProvider>
  )
}

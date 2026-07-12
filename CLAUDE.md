# Flow! — Finance Tracker

App Android de finanzas personales. Frontend web empaquetado con Capacitor.

## Design Context

`artifacts/finance-tracker/PRODUCT.md` (register, usuarios, positioning, principios estratégicos) y `artifacts/finance-tracker/DESIGN.md` (paleta por zona, tipografía, componentes — sistema "The Zoned Voltage System") documentan formalmente lo que este archivo ya resume en las secciones de diseño de abajo. Generados con `/impeccable init` + `/impeccable document`; re-correr `document` si el sistema visual cambia sustancialmente.

## Arquitectura

- **Monorepo pnpm.** Raíz: `/Users/flrn/Documents/PROJECTS/Finance-Tracker/Finance-Tracker-Plus`
- **Frontend**: `artifacts/finance-tracker` — React + Vite + Tailwind + wouter (router) + Capacitor (Android). shadcn/ui components en `src/components/ui/`.
- **Backend**: `artifacts/api-server` — Express + Drizzle ORM + TypeScript. Deployado en Render: `https://finance-tracker-api-087e.onrender.com` (se mantiene despierto 24/7 con ping externo).
- **DB**: Supabase (Postgres). Schema Drizzle en `lib/db/src/schema/`. Las tablas NO tienen RLS pero el acceso directo por REST está bloqueado (verificado); el único camino es el backend.
- **Auth**: Supabase Auth. `artifacts/api-server/src/middlewares/auth.ts` valida tokens con `supabase.auth.getUser(token)` — NO tocar este patrón.
- **AI**: Gemini `gemini-3.1-flash-lite-preview`. La key vive SOLO en Render como `GEMINI_API_KEY` (nunca en el frontend / nunca `VITE_`). Rutas: `/api/insights/analyze` y `/api/voice/parse`.
- **Data fetching frontend**: hooks generados de `@workspace/api-client-react` (Orval + TanStack Query) para la mayoría; goals/habits/voice/insights usan fetchers custom con el token de Supabase (`getApiUrl()` de `@/lib/api-config`).

## Comandos de trabajo

```bash
# Backend: deploy = push (Render auto-redeploya)
git add . && git commit -m "..." && git push

# Frontend web → Android
cd artifacts/finance-tracker
rm -rf dist && pnpm run build && npx cap sync android

# Solo si se tocó código NATIVO (AndroidManifest, MainActivity.java):
cd android && rm -rf app/build && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

**Regla de oro**: antes de dar por bueno cualquier `.tsx`, verificar sintaxis:
```bash
npx esbuild ARCHIVO.tsx --loader:.tsx=tsx --jsx=automatic --outfile=/dev/null
```

## Sistema de diseño (línea actual)

- **Estética**: cards pastel vivas con detalles: mesh gradient multicolor (2-3 radial-gradients), sheen glass superior (franja blanca degradada), ícono lucide "fantasma" gigante semi-transparente en esquina, `rounded-3xl`, blobs blancos decorativos.
- **Colores por zona**:
  - Balance / morado: `#B026FF` (hero negro `#020203` con glow morado en dashboard rediseñado)
  - Income: `#00FF9C` (texto oscuro `#00593C` encima — el blanco no contrasta)
  - Expense: `#FF4D4D` (texto blanco encima)
  - New Entry launcher: `#FF66D9` (rosa)
  - Insights (zona AI): celeste `#0EA5E9`, hero sky pastel
  - Brand Flow green: `#A8FF3E` (lock screen, botones primarios), nav activo `#7DD900`
  - Toggle period: fondo `#020203`, texto `#f9f8f8`
- **Tipografía**: Righteous para números/títulos display (`font-serif` en Tailwind). El usuario planea agregar Brunson.ttf SOLO para títulos de página (clase `.font-title`, pendiente de aplicar).
- **Categorías**: paletas separadas por tipo — 8 cálidos para expense (fuchsia→yellow), 8 fríos para income (lime→grape), en orden tonal. Definidas en `categories.tsx`.
- El usuario es MUY exigente con el diseño: iterar con él antes de asumir; preguntar dirección con opciones concretas; cambios de color deben ser NOTORIOS, no sutiles.

## Libertad creativa vs. restricciones (LEER ANTES DE REDISEÑAR)

El usuario BUSCA propuestas audaces que generen impacto real. No quiere que le devuelvan
lo mismo con otro nombre. Al auditar o rediseñar, la instrucción es: **proponé cambios
estructurales de verdad, no ajustes cosméticos.**

### Lo único intocable (identidad)
- **Temperatura semántica**: verde = income/positivo, rojo = expense/negativo. Se puede
  cambiar el tono exacto, pero NO invertir el significado ni volverlos neutros.
- **Familia tonal**: la app vive en tonos SATURADOS y luminosos (no corporativo apagado,
  no grises tristes). Cualquier paleta nueva debe sentirse viva y con energía.
- Flow green `#A8FF3E` como color de marca en momentos clave (lock screen, primary actions).
- Legibilidad: contraste real; texto oscuro sobre colores claros y viceversa.

### Totalmente abierto a rediseño radical
- Los hex exactos (`#B026FF`, `#00FF9C`, `#FF4D4D`, `#FF66D9`, `#0EA5E9`) son la iteración
  ACTUAL, no dogma. Si una propuesta mejor pide otros tonos dentro de la familia saturada, adelante.
- Layout, jerarquía, composición, tamaños, tipografía, densidad, forma de las cards.
- Motion, transiciones, micro-interacciones (hoy son básicas — hay mucho margen).
- Los "detalles de la casa" (mesh gradient + sheen + ícono fantasma) se repiten en todas las
  cards y **puede que ya estén cansados**: si hay un recurso visual mejor, proponerlo.
- El tipo de visualización de datos (el chart heredado del dashboard es el peor punto de la app).

### Cómo proponer
Cuando audites: nombrá los problemas reales sin diplomacia (jerarquía plana, ruido, falta de
foco, elementos genéricos). Proponé 2-3 direcciones DISTINTAS entre sí — no variaciones de
la misma idea — y explicá qué gana cada una. El usuario decide.

## Estado actual (jul 2026)

Rediseño del dashboard recién portado desde un prototipo v0/Next.js a Vite:
- `src/pages/dashboard.tsx` + `src/components/dashboard/`: `balance-hero.tsx`, `stat-tiles.tsx`, `range-switch.tsx`, `entry-launcher.tsx`, `entry-sheet.tsx`
- El EntrySheet reemplazó al viejo QuickEntry (form fullscreen con teclado numérico, picker de categorías reales, mutación real `useCreateTransaction`)
- Voice-to-transaction: `src/components/voice-capture.tsx` (overlay inmersivo con waveform canvas reactivo al mic) → `POST /api/voice/parse` → pre-llena el EntrySheet. Auto-stop tras 2.5s de silencio DESPUÉS de detectar voz. En Android requiere el `onPermissionRequest` del WebChromeClient en `MainActivity.java` (ya aplicado) + permisos RECORD_AUDIO/MODIFY_AUDIO_SETTINGS en el manifest.
- El chart de spending del dashboard quedó del diseño anterior (el usuario dijo que las gráficas quedan pendientes de rediseño).
- Fix reciente: constante `MEDALS` faltaba en dashboard.tsx (crasheaba All Time).

## Páginas ya rediseñadas (no revertir sin pedir)

- **Lock screen**: aurora mesh (4 blobs animados) + card flotante angosta + logo `/logo.png` abajo (fallback a texto).
- **Insights**: hero sky pastel con score gauge segmentado, análisis server-side.
- **Goals**: strip resumen (Total saved verde + Active streaks ámbar), cards tintadas por color, heatmaps estilo HabitKit. Queries prefetcheadas desde `layout.tsx` (`goalsQueryOptions`/`habitsQueryOptions` exportadas de `goals.tsx`).
- **Categories**: grid 2-col de swatches Pantone (bloque de color arriba h-9 con acciones glass encima, base solo nombre), modal con preview en vivo (nombre se escribe EN el preview) y picker de pills tintados.
- **Transactions**: cards flotantes limpias (círculo direccional tintado ↗/↙, descripción bold, "Categoría · fecha", monto verde/rojo), secciones por mes colapsables con chip de net. NO está en el nav — se entra por botón "All transactions" del dashboard.
- **Nav**: 4 items (Dashboard, Insights, Goals, Categories). Avatar del perfil: top-0 right-0 en páginas normales, top-4 right-4 en Insights.

## Seguridad (auditada — no romper)

- Gemini key: solo backend. PIN de respaldo: hasheado SHA-256 en localStorage con migración automática (`verifyPin` en `biometric-context.tsx`; `disable` es async — cualquier caller necesita await).
- `.env.local` / `.env.production` NO están en git (solo `.env.example`). Nunca poner secretos en variables `VITE_`.

## Preferencias del usuario

- Español. Respuestas CONCISAS (le preocupa el consumo de tokens).
- Cambios como archivos completos o ediciones directas, siempre verificados con esbuild antes de entregar.
- En diseño: proponerle 2 direcciones en palabras ANTES de codear cuando el cambio es grande; screenshots como fuente de verdad.
- No usa ADB; builds vía Android Studio o gradlew. Teléfono Samsung One UI.

## Pendientes conocidos

- **Rediseño de las gráficas del dashboard** — el chart es heredado y es el punto más débil
  de la app. Candidato #1 para un rediseño audaz.
- Motion/transiciones: prácticamente inexistentes más allá de fades básicos. Gran oportunidad.
- Aplicar fuente Brunson.ttf a títulos de página (`public/fonts/Brunson.ttf` + `@font-face` + clase `.font-title`).
- Verificar que `settings.tsx` haga `await disable(pin)` (disable pasó a async).
- Alinear naming de env: `.env.example` usa `VITE_API_BASE_URL`; verificar que `api-config.ts` use el mismo nombre.

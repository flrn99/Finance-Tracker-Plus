# Flow! — Finance Tracker

App Android de finanzas personales. Frontend web empaquetado con Capacitor.

## Design Context

`artifacts/finance-tracker/PRODUCT.md` (register, usuarios, positioning, principios estratégicos) y `artifacts/finance-tracker/DESIGN.md` (paleta por zona, tipografía, componentes — sistema "The Zoned Voltage System") documentan formalmente lo que este archivo ya resume en las secciones de diseño de abajo. Generados con `/impeccable init` + `/impeccable document`; re-correr `document` si el sistema visual cambia sustancialmente.

## Arquitectura

- **Monorepo pnpm.** Raíz: `/Users/flrn/Documents/PROJECTS/Finance-Tracker/Finance-Tracker-Plus`
- **Frontend**: `artifacts/finance-tracker` — React + Vite + Tailwind + wouter (router) + Capacitor (Android + iOS, ambas plataformas activas y verificadas en dispositivo físico). shadcn/ui components en `src/components/ui/`.
- **iOS nativo**: `ios/App/App/BridgeViewController.swift` subclasea `CAPBridgeViewController` (wireado en `Main.storyboard`) para apagar el rebote nativo del WKWebView (`scrollView.bounces = false`, si no la app se sentía como una página web suelta) y activar el gesto estándar de "swipe desde el borde para volver atrás" (`allowsBackForwardNavigationGestures = true`) — iOS no tiene botón físico de "atrás" como Android.
- **Backend**: `artifacts/api-server` — Express + Drizzle ORM + TypeScript. Deployado en Render: `https://finance-tracker-api-087e.onrender.com` (se mantiene despierto 24/7 con ping externo).
- **DB**: Supabase (Postgres). Schema Drizzle en `lib/db/src/schema/`. Las tablas NO tienen RLS pero el acceso directo por REST está bloqueado (verificado); el único camino es el backend.
- **Auth**: Supabase Auth. `artifacts/api-server/src/middlewares/auth.ts` valida tokens con `supabase.auth.getUser(token)` — NO tocar este patrón.
- **AI**: Gemini `gemini-3.1-flash-lite-preview`. La key vive SOLO en Render como `GEMINI_API_KEY` (nunca en el frontend / nunca `VITE_`). Rutas: `/api/insights/analyze` y `/api/voice/parse`.
- **Data fetching frontend**: hooks generados de `@workspace/api-client-react` (Orval + TanStack Query) para la mayoría; goals/habits/voice/insights usan fetchers custom con el token de Supabase (`getApiUrl()` de `@/lib/api-config`).

## Comandos de trabajo

```bash
# Backend: deploy = push (Render auto-redeploya)
git add . && git commit -m "..." && git push

# Frontend web → Android + iOS (sin argumento de plataforma sincroniza las dos)
cd artifacts/finance-tracker
rm -rf dist && pnpm run build && npx cap sync

# Solo si se tocó código NATIVO Android (AndroidManifest, MainActivity.java):
cd android && rm -rf app/build && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk

# Solo si se tocó código NATIVO iOS (Info.plist, BridgeViewController.swift, etc.):
# abrir ios/App/App.xcodeproj en Xcode y correr desde ahí — no hay CocoaPods
# (usa Swift Package Manager, Package.swift se regenera solo con cap sync)
```

**Preferencia del usuario**: cada vez que se commitea y pushea un cambio de frontend, correr el build + sync de arriba en el mismo momento sin que lo pida — no dejarlo para después.

**Regla de oro**: antes de dar por bueno cualquier `.tsx`, verificar sintaxis:
```bash
npx esbuild ARCHIVO.tsx --loader:.tsx=tsx --jsx=automatic --outfile=/dev/null
```

## Sistema de diseño (línea actual)

- **Estética**: cards pastel vivas con detalles: mesh gradient multicolor (2-3 radial-gradients), sheen glass superior (franja blanca degradada), ícono lucide "fantasma" gigante semi-transparente en esquina, `rounded-3xl`, blobs blancos decorativos.
- **Colores por zona**:
  - Balance / morado: `#B026FF` (hero negro `#020203` con glow morado en dashboard rediseñado)
  - Income: `#00A870` (usado en New Entry, treemap del dashboard, Insights, Settings, Onboarding, Voice Capture)
  - Expense: `#FF4D4D` (texto blanco encima)
  - New Entry launcher: `#FF66D9` (rosa)
  - Insights (zona AI): hero "Whisper" — lavado celeste plano casi blanco (`#EFF8FF` claro / `#0F1B24` oscuro, clase `.insights-hero` en `index.css`), no el gradiente pastel de 3 tonos de antes; texto/badge/botones siguen celeste (`#0369A1`/`#7DD3FC`), + un ghost icon de Sparkles bien tenue (`.insights-hero-ghost`). Las 4 cards de datos (Expense/Income lens) pasaron de rojo/verde `#FF4D4D`/`#00A870` sólido a "Gradient wash": degradé suave de 2 tonos con el color viviendo en el texto (tokens `expense-ink`/`income-ink` ya verificados de contraste, clases `insights-ink-*`/`insights-card-*` en `index.css`), no blanco sobre bloque saturado. `#0EA5E9` sigue vivo solo en el header del modal "Your Financial Report" (sin tocar, fuera de este rediseño).
  - Brand Flow green: `#CAFA01` (lock screen, botones primarios, status/nav bar Android, ícono de iOS)
  - Toggle period: fondo `#020203`, texto `#f9f8f8`
  - Flows (ex-Bills): "Flow! Red" `#FF4D4D` / "Flow! Green" `#00A870` (mismo Income de arriba, unificado — antes era `#00FF9C`, un verde que no coincidía con ningún otro lugar de la app) como color default por type, sumados a la paleta de 10 colores compartida (`COLOR_OPTIONS` en `goals.tsx`)
- **Tipografía**: 3 fuentes reales cargadas como `@font-face` en `index.css` (`public/fonts/*.woff2`) — `Unbounded` (900, `.font-title`, mayúsculas, títulos de página), `Space Grotesk` (700, `.font-number`, tabular-nums), `Big Shoulders Display` (900, `.font-entry-amount`, montos grandes tipo EntrySheet/stepper de día). Righteous (`font-serif`) sigue de una etapa anterior, verificar antes de asumir dónde se usa todavía.
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
- Flow green `#CAFA01` como color de marca en momentos clave (lock screen, primary actions).
- Legibilidad: contraste real; texto oscuro sobre colores claros y viceversa.

### Totalmente abierto a rediseño radical
- Los hex exactos (`#B026FF`, `#00A870`, `#FF4D4D`, `#FF66D9`, `#0EA5E9`) son la iteración
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
- **Insights**: hero "Whisper" (lavado celeste casi blanco, sin el gradiente pastel de 3 tonos de antes, + ghost icon de Sparkles tenue) con score gauge segmentado, análisis server-side. Cards del lens Expense/Income en "Gradient wash" (degradé suave rojo/verde con el color en el texto vía tokens ink, no un fondo sólido) — antes eran `bg-card` plano sin identidad, después pasaron brevemente por fondo sólido, y se asentaron acá tras iterar con el usuario.
- **Goals**: switcher de 3 pestañas, orden **Flows, Savings, Habits** (Flows es la default al abrir la página — no hay `?tab=` en la URL). Savings: strip resumen (Total saved verde + Active streaks ámbar), cards tintadas por color, heatmaps estilo HabitKit. Queries prefetcheadas desde `layout.tsx` (`goalsQueryOptions`/`habitsQueryOptions` exportadas de `goals.tsx`).
  - **Flows** (ex-"Bills", internamente el código sigue usando `bill`/`bills` — solo el label de UI cambió): pagos recurrentes con `type` (expense/income) y `day` (1-31, el mes se autodetecta). Lista dividida en secciones "Money Out"/"Money In", cada una ordenada por día, cards con tinte de color propio + heatmap mensual (el ícono de cada card se reemplazó por el número de día). Modal de creación: nombre escrito sobre el color → toggle Expense/Income → monto → día como **stepper** con flechas ‹ › + swipe horizontal (no una grilla de 31 casilleros, se sacó por ocupar mucho espacio) → categoría (filtrada por el type elegido) → auto-save → color (popup dropdown `ColorSelect`, paleta de 10 + "Flow! Red" `#FF4D4D` / "Flow! Green" `#00A870` como default según el type). Auto-save real: si el Flow tiene monto cargado y ya llegó/pasó el día elegido este mes sin marcarse pagado, se marca solo y crea la transacción al abrir la app (sin cron en el backend — se pone al día la próxima vez que la app esté abierta, no a medianoche exacta). El widget "Money Out" del dashboard (antes "Monthly bills") filtra solo Flows de type expense.
- **Categories**: grid 2-col de swatches Pantone (bloque de color arriba h-9 con acciones glass encima, base solo nombre), modal con preview en vivo (nombre se escribe EN el preview) y picker de pills tintados. El modal de creación (`CreateCategoryModal` en `src/components/category-form-modal.tsx`) es compartido con el picker de categorías del EntrySheet — crear una categoría desde "New Entry" no navega afuera ni pierde el monto ya tipeado, y si el type de la categoría nueva no coincide con el type del entry abierto, el entry cambia de type solo.
- **Transactions**: cards con swipe-to-delete (no un ícono de flecha direccional — cada fila tiene una barra de color de categoría a la izquierda, descripción bold, "Categoría · fecha", monto con prefijo +/− en verde/rojo), secciones por mes colapsables con chip de net. NO está en el nav — se entra por botón "All transactions" del dashboard.
- **Nav**: 5 items, orden **Dashboard, Goals, Insights, Categories, Settings**. El avatar de perfil ya NO flota arriba de las páginas (ese `ProfileAvatar` se eliminó) — ahora vive únicamente dentro del ítem "Settings" del nav (`AvatarGlyph` en `layout.tsx`), con foto/inicial real en vez de un ícono de gear genérico, sin el pill de fondo compartido con los demás ítems y más grande (34px vs 26px).

## Seguridad (auditada — no romper)

- Gemini key: solo backend. PIN de respaldo: hasheado SHA-256 en localStorage con migración automática (`verifyPin` en `biometric-context.tsx`; `disable` es async — cualquier caller necesita await).
- `.env.local` / `.env.production` NO están en git (solo `.env.example`). Nunca poner secretos en variables `VITE_`.

## Preferencias del usuario

- Español. Respuestas CONCISAS (le preocupa el consumo de tokens).
- Cambios como archivos completos o ediciones directas, siempre verificados con esbuild antes de entregar.
- En diseño: proponerle 2 direcciones en palabras ANTES de codear cuando el cambio es grande; screenshots como fuente de verdad.
- No usa ADB; builds vía Android Studio o gradlew. Teléfono Samsung One UI.

## Pendientes conocidos

- **Suscripción** — se evaluó reemplazar one-time payment por subscripción; pausado hasta
  decidir distribución (Play Store → obliga a Google Play Billing; directa/personal → Stripe
  es más simple). Sin implementar.
- **Motion fuera de las páginas rediseñadas** — Login, Settings, Onboarding, Voice Capture y
  ahora Flows (toggle, stepper, swipe) tienen motion real; Transactions, Categories y las
  pestañas Savings/Habits de Goals se quedaron con las transiciones básicas de siempre.
- **Fix del delete de Transactions sin confirmar en device** — el botón de delete revelado
  por swipe y la fila que se corre al costado no tenían z-index explícito; se hizo
  condicional a `dragX < 0` (ver `transactions.tsx`) para que el delete gane el toque solo
  cuando está revelado. Aplicado a partir de un reporte de "a veces no registra el toque",
  sin causa raíz 100% confirmada — pendiente de que el usuario lo pruebe en el teléfono.

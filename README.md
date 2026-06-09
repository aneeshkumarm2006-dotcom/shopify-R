# Offshelf

Multi-tenant, Shopify-style storefront platform for high-risk verticals (vape / cannabis / CBD).
One Next.js app + one shared MongoDB serves many stores; "publishing" is a status flag +
subdomain routing, not a build step. See [`../_ai_context/PRD.md`](../_ai_context/PRD.md) for scope
and [`../_ai_context/TODO.md`](../_ai_context/TODO.md) for the build plan.

## Stack

- **Next.js (App Router) + TypeScript** (strict), `@/*` absolute imports
- **Tailwind CSS** wired to the design-token layer (`styles/tokens.css` → CSS vars →
  `tailwind.config.ts`). Components reference semantic tokens only, never raw hex.
- Self-hosted fonts via `next/font/local`: **Geist** (`--font-ui`), **Geist Mono**
  (`--font-mono`), **Clash Display** (`--font-display`)
- **lucide-react** icons behind a single `Icon` wrapper (`components/ui/icon.tsx`)

## Getting started

```bash
npm install
cp .env.example .env.local   # nothing is required to run Part A
npm run dev                  # http://localhost:3000
```

- `/` — marketing apex placeholder (Stage 5)
- `/_kitchen-sink` — **Stage 0 foundation check**: tokens repaint on theme toggle, all three
  fonts load, the icon set renders, and data comes only from the stub seams
- `/dashboard`, `/products`, … — admin route stubs (Stage 2)

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (typecheck + lint) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next + prettier) |
| `npm run format` | Prettier write |

## Project structure (Stage 0 target)

```
site/
├─ app/
│  ├─ (marketing)/       # apex landing (Stage 5)
│  ├─ (admin)/           # merchant dashboard + _kitchen-sink (Stages 1–4)
│  └─ (store)/           # multi-tenant storefront, subdomain-served (Stages 3, 8)
├─ components/ui/        # primitives (Icon, ThemeToggle; expands in Stage 1)
├─ lib/data/            # stub data-access seams (storeId-first) → real in Stage 6
│  └─ mocks/            # typed PRD §5 fixtures (demo store "Northbound")
├─ types/               # interfaces mirroring all 10 PRD §5 collections
└─ styles/tokens.css    # token layer (raw ramps + light/dark semantic aliases)
```

### Data layer contract

Screens import **only** from `@/lib/data` (never from `lib/data/mocks/*`). Every store-scoped
function takes `storeId` as its first argument and returns typed PRD §5 shapes, so Stage 6 can
swap the stub bodies for real `storeId`-filtered MongoDB queries without touching any component.

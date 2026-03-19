# Penma

A production-grade web application that imports web URLs and presents them as editable designs, similar to Figma.

## Tech Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Zustand + Immer for state management with patch-based undo/redo
- Puppeteer for server-side URL import
- Custom HTML-based infinite canvas

## Development
```bash
pnpm dev      # Start dev server
pnpm build    # Production build
pnpm lint     # Run ESLint
```

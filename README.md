# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server (website template):

```bash
vp run dev
```

Training client and API: from the repo root run `vp run dev:backend` (port 3001) and `vp run dev:web` (port 3000). Both scripts build `@lhs-vsts/machine` first. The web app proxies `/api` to the backend.

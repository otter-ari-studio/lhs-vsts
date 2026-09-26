# AGENTS.md

## Commands

- `vp run frontend#dev` / `pnpm run dev` - Start the dev server
- `vp run frontend#build` / `pnpm run build` - Build the app for production
- `vp run frontend#preview` / `pnpm run preview` - Preview the production build locally
- `vp run frontend#test` / `pnpm run test` - Run Rstest
- From repo root: `vp run dev:frontend` (builds `@lhs-vsts/machine` first)

## Docs

- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt
- Rslint: https://rslint.rs/llms.txt
- Rstest: https://rstest.rs/llms.txt

## Tools

### Rslint

- Run `pnpm run lint` to lint your code

### Prettier

- Run `pnpm run format` to format your code

### Rstest

- Run `pnpm run test` to run tests
- Run `pnpm run test:watch` to run tests in watch mode
- Run `pnpm run test:cov` for coverage (lines ≥ 90 on gated sources)

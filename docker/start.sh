#! /bin/bash

# Platform / Docker SPA listen port (Nest reads process.env.PORT).
export PORT="${PORT:-3000}"

cd /home/ && pnpm run start:docker

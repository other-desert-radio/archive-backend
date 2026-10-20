FROM oven/bun:1.4.2

RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY vite.config.ts ./vite.config.ts
RUN bun run admin:build

ENV NODE_ENV=production
EXPOSE 43827

CMD ["bun", "run", "start"]

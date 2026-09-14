FROM oven/bun:1.3.8

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY vite.config.ts ./vite.config.ts
RUN bun run admin:build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]

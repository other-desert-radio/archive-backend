FROM oven/bun:1.3.8

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]

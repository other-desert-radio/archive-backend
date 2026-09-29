FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

RUN npm install --global bun@1.4.2

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY integration-tests ./integration-tests

CMD ["bunx", "playwright", "test", "integration-tests"]

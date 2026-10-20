FROM oven/bun:1.4.2

RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Match the dedicated checkout owner; OpenSSH also needs a passwd entry.
ARG ARCHIVE_RUNTIME_UID=1000
ARG ARCHIVE_RUNTIME_GID=1000
RUN test "$ARCHIVE_RUNTIME_UID" -gt 0 && test "$ARCHIVE_RUNTIME_GID" -gt 0 && groupmod -o -g "$ARCHIVE_RUNTIME_GID" bun \
    && usermod -o -u "$ARCHIVE_RUNTIME_UID" -g bun bun \
    && chown bun:bun /home/bun \
    && mkdir -p /run/archive-ssh \
    && printf '%s\n' 'Host *' '    IdentityFile /run/archive-ssh/id_ed25519' '    IdentitiesOnly yes' '    UserKnownHostsFile /run/archive-ssh/known_hosts' > /etc/ssh/ssh_config.d/archive.conf

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY vite.config.ts ./vite.config.ts
RUN bun run admin:build

USER bun
ENV HOME=/home/bun
ENV NODE_ENV=production
EXPOSE 43827

CMD ["bun", "run", "start"]

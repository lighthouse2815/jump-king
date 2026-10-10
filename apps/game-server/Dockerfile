FROM node:20-alpine
WORKDIR /app
# We would setup pnpm workspace build here
COPY . .
RUN npm i -g pnpm && pnpm install
RUN pnpm run build
EXPOSE 2567
CMD ["pnpm", "--filter", "game-server", "start"]

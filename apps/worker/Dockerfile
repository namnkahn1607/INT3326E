FROM node:22-bookworm-slim AS build
WORKDIR /app/apps/worker
# Context build ở gốc repo để dùng nguyên helper ETA trong packages/types.
COPY packages/types/package.json packages/types/tsconfig.json /app/packages/types/
COPY packages/types/src /app/packages/types/src
COPY apps/worker/package*.json ./
RUN npm ci --workspaces=false
COPY apps/worker/tsconfig.json ./
COPY apps/worker/src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/worker
COPY --from=build /app/packages/types/package.json /app/packages/types/
COPY --from=build /app/packages/types/dist /app/packages/types/dist
COPY apps/worker/package*.json ./
RUN npm ci --omit=dev --workspaces=false && npm cache clean --force
COPY --from=build /app/apps/worker/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]

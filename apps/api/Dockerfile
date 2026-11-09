FROM node:22-bookworm-slim AS build
WORKDIR /app/apps/api
# DTO mới tham chiếu kiểu dữ liệu chung; runtime không cần dependency này.
COPY packages/types/package.json /app/packages/types/
COPY packages/types/src /app/packages/types/src
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --workspaces=false
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --workspaces=false && npm cache clean --force
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json server.ts ./
COPY src ./src
RUN npm run build

FROM deps AS migrate
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/db ./src/db
CMD ["npm", "run", "db:migrate"]

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]

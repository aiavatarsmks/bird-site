FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json server-production.mjs directory-api.mjs ./
COPY server ./server
COPY data/projects-public.json ./data/projects-public.json
COPY public ./public
ENV NODE_ENV=production BIRD_DATA_DIR=/data BIRD_TRUST_PROXY=1
EXPOSE 8080
CMD ["bun","server-production.mjs"]

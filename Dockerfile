FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json server-production.mjs directory-api.mjs ./
COPY public ./public
ENV NODE_ENV=production BIRD_DATA_DIR=/data
EXPOSE 8080
CMD ["bun","server-production.mjs"]

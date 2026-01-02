# Étape 1 : construire le projet
FROM node:18-alpine AS build

# Installer OpenSSL pour Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Générer le client Prisma
RUN npx prisma generate

RUN npm run build

# Étape 2 : exécuter le projet
FROM node:18-alpine

# Installer OpenSSL pour Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Copier Prisma schema et migrations pour les migrations en prod
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# Script d'entrée pour migrations + démarrage
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]

EXPOSE 3001

# Usar la imagen ligera oficial de Node.js
FROM node:20-alpine

# Definir el directorio de trabajo
WORKDIR /app

# Instalar dependencias para compilar módulos nativos (sqlite3)
RUN apk add --no-cache python3 make g++

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias del proyecto
RUN npm install --omit=dev

# Copiar el resto de los archivos del proyecto
COPY . .

# Exponer el puerto del servidor (3000 por defecto)
EXPOSE 3000

# Definir variables de entorno por defecto
ENV PORT=3000
ENV NODE_ENV=production

# Ejecutar la aplicación
CMD ["npm", "start"]

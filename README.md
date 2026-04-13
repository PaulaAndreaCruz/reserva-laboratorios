# Reserva de Laboratorios

Sistema de reservas para Tech Lab Bachillerato, Maker Space y Tech Lab Primaria.

## Despliegue en la nube (Render + MongoDB Atlas)

### Paso 1 — MongoDB Atlas (base de datos gratuita)

1. Ve a https://www.mongodb.com/atlas
2. Clic en **"Try Free"** → crea cuenta con Google o email
3. Elige plan **FREE (M0)** → región más cercana → Create
4. En **"Security"** → **Database Access** → Add User:
   - Username: `admin`
   - Autogenerate password → **copia la contraseña**
5. En **"Security"** → **Network Access** → Add IP Address → **Allow Access from Anywhere**
6. En **"Deployment"** → **Database** → clic en **Connect** → **Drivers**
   - Copia la URI que aparece, similar a:
     `mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/`
   - Reemplaza `<password>` con tu contraseña real
   - Agrega `laboratorios` al final:
     `mongodb+srv://admin:tupassword@cluster0.xxxxx.mongodb.net/laboratorios`

### Paso 2 — GitHub

1. Ve a https://github.com → New repository
2. Nombre: `reserva-laboratorios` → Public → Create
3. Sube estos archivos:
   - `server.js`
   - `package.json`
   - `.gitignore`
   - `.env.example`
   - carpeta `public/` con `index.html`
4. **NO subas** `.env` ni `node_modules/`

### Paso 3 — Render.com

1. Ve a https://render.com → **"Get Started for Free"**
2. Regístrate con tu cuenta de GitHub
3. Dashboard → **New** → **Web Service**
4. Conecta tu repositorio `reserva-laboratorios`
5. Configura:
   - **Name**: reserva-laboratorios
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
6. Antes de Deploy → **Environment Variables** → agrega:
   - `MONGODB_URI` = tu URI de MongoDB Atlas
   - `NODE_ENV` = production
7. Clic en **Create Web Service**
8. Espera 2-3 minutos → Render te da una URL como:
   `https://reserva-laboratorios.onrender.com`

¡Listo! Esa URL la comparten con todos los profesores.

## Notas importantes

- **Plan gratuito de Render**: el servidor "duerme" después de 15 min sin uso.
  La primera visita puede tardar 30-60 segundos en cargar. Es normal.
- Para evitar esto, puedes contratar el plan Starter ($7/mes).
- Los datos en MongoDB Atlas (plan free) tienen límite de 512MB, suficiente para años de uso.

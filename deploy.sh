#!/bin/bash
# ============================================
# MURAL Scheduling SaaS - Vercel Deploy Script
# ============================================

set -e

echo "🚀 MURAL SaaS - Despliegue en Vercel"
echo "======================================"

# 1. Check Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "📦 Instalando Vercel CLI..."
    npm install -g vercel
fi

# 2. Login to Vercel
echo ""
echo "🔑 Iniciando sesión en Vercel..."
vercel login

# 3. Deploy (first time - will create project)
echo ""
echo "🚀 Desplegando en Vercel..."
vercel --yes

# 4. Create Postgres database
echo ""
echo "📊 Para crear la base de datos PostgreSQL en Vercel:"
echo "   1. Ve a https://vercel.com/dashboard -> Storage -> Create Database -> Postgres"
echo "   2. Conecta la base de datos al proyecto"
echo "   3. Las variables de entorno se configurarán automáticamente"

# 5. Set environment variables
echo ""
echo "⚙️  Configurando variables de entorno..."
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production

echo ""
echo "✅ Variables que necesitas configurar en Vercel:"
echo "   NEXTAUTH_URL = https://tu-app.vercel.app"
echo "   NEXTAUTH_SECRET = $(openssl rand -base64 32 2>/dev/null || echo 'genera-uno-con-openssl-rand-base64-32')"
echo ""
echo "   DATABASE_URL y DIRECT_URL se configuran automáticamente al conectar Postgres"

# 6. Push database schema
echo ""
echo "📊 Para inicializar la base de datos:"
echo "   npx prisma db push"
echo "   npx tsx prisma/seed.ts"

# 7. Final deploy
echo ""
echo "🔄 Para hacer el deploy final (después de configurar todo):"
echo "   vercel --prod"

echo ""
echo "✨ ¡Listo! Tu app estará en: https://tu-app.vercel.app"

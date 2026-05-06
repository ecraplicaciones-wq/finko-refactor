#!/bin/bash
# 🚀 RUTINA DE DESARROLLO FINKO PRO
# Script para desarrollo local rápido: test → commit → push
# Uso: ./dev-routine.sh "descripción del cambio"

set -e  # Exit on error

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones
log_step() {
    echo -e "${BLUE}▶${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Verificar que hay mensaje de commit
if [ -z "$1" ]; then
    echo -e "${RED}❌ Uso: ./dev-routine.sh \"descripción del cambio\"${NC}"
    echo ""
    echo "Ejemplos:"
    echo "  ./dev-routine.sh \"feat: agregar validador de inversiones\""
    echo "  ./dev-routine.sh \"fix: corregir bug en predictor de fin de quincena\""
    echo "  ./dev-routine.sh \"refactor: reorganizar módulos de dominio\""
    exit 1
fi

COMMIT_MSG="$1"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 RUTINA DE DESARROLLO FINKO PRO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# PASO 1: Estado actual
log_step "1️⃣  Verificando estado del repositorio..."
echo ""
git status

# PASO 2: Tests
echo ""
log_step "2️⃣  Corriendo tests..."
if npm test; then
    log_success "Todos los tests pasaron ✓"
else
    log_error "Tests fallaron ✗"
    exit 1
fi

# PASO 3: Cambios pendientes
echo ""
log_step "3️⃣  Revisando cambios..."
CHANGES=$(git status --porcelain | wc -l)
if [ "$CHANGES" -eq 0 ]; then
    log_warning "No hay cambios pendientes. ¿Olvidaste guardar?"
    read -p "¿Continuar de todas formas? (s/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 0
    fi
else
    echo "Cambios detectados: $CHANGES archivo(s)"
    git diff --stat
fi

# PASO 4: Commit
echo ""
log_step "4️⃣  Preparando commit..."
git add -A
echo ""
echo "📝 Mensaje: $COMMIT_MSG"
echo ""
read -p "¿Confirmar commit? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    log_warning "Commit cancelado"
    git reset
    exit 0
fi

git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

log_success "Commit realizado ✓"
git log --oneline -1

# PASO 5: Push a GitHub
echo ""
log_step "5️⃣  Haciendo push a GitHub..."
read -p "¿Push ahora? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    log_warning "Push cancelado. Ejecuta: git push"
    exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push -u origin "$BRANCH"

log_success "Push realizado ✓"

# PASO 6: Resumen
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ RUTINA COMPLETADA${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Resumen:"
echo "  • Rama: $BRANCH"
echo "  • Commit: $COMMIT_MSG"
echo "  • Tests: PASADOS ✓"
echo "  • Estado: SINCRONIZADO ✓"
echo ""
echo "🔗 Tu rama está en:"
echo "  GitHub: https://github.com/tu-usuario/finko-refactor/tree/$BRANCH"
echo "  Vercel: Monitorea el deployment en https://vercel.com/dashboard"
echo ""
# ⚡ Quick Start — Rutina de Desarrollo

**Versión TL;DR (2 minutos)**

## 1. Primero, una sola vez:

```bash
cd ~/Desktop/Finko-Refactor
chmod +x dev-routine.sh
```

## 2. Cada vez que tengas tokens:

```bash
# Edita lo que necesites en tu editor

# Luego ejecuta:
./dev-routine.sh "tu descripción del cambio"

# El script hace todo:
# ✅ Corre tests
# ✅ Hace commit
# ✅ Hace push a GitHub
# ✅ GitHub Actions despliega automáticamente a Vercel
```

## 3. Monitorea (opcional):

- **Tests en CI**: https://github.com/tu-usuario/finko-refactor/actions
- **Deploy en Vercel**: https://vercel.com/dashboard

## ¡Eso es todo! 🚀

---

## Si quieres más detalle:

Lee `DEVELOPMENT_ROUTINE.md` para:
- Flujos de trabajo detallados
- Cómo arreglar cuando algo falla
- Convenciones de commits
- Tips y trucos

---

## Duda rápida: ¿Qué hago si...?

**...los tests fallan?**
```bash
npm test  # Ver qué falla
# Edita el código
npm test  # Verifica que pasen
./dev-routine.sh "fix: descripción"
```

**...quiero ver qué cambios hay?**
```bash
git status
git diff
```

**...quiero deshacer algo?**
```bash
git reset HEAD~1  # Deshace último commit (mantiene cambios)
git reset --hard HEAD~1  # Deshace todo (CUIDADO)
```

**...GitHub Actions falla?**
Abre: https://github.com/tu-usuario/finko-refactor/actions
Lee el log y arregla localmente, luego push de nuevo.

---

## Automático cada mañana:

A las 8 AM, recibirás un reporte automático del estado del proyecto. Úsalo para saber si todo está bien cuando despiertes y tengas tokens.

---

**¡Listo! Comienza con:**
```bash
./dev-routine.sh "feat: descripción"
```

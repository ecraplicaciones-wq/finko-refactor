# 🚀 Rutina de Desarrollo Finko Pro

Guía para mantener un flujo de desarrollo consistente cuando tengas tokens disponibles.

## ⚡ Inicio Rápido (2 minutos)

Cuando tengas tokens y quieras iniciar una sesión de desarrollo:

```bash
# Asegúrate de estar en la raíz del proyecto
cd ~/Desktop/Finko-Refactor

# Hazlo ejecutable (primera vez)
chmod +x dev-routine.sh

# Ejecuta la rutina
./dev-routine.sh "feat: tu descripción aquí"
```

Eso es. El script:
1. ✅ Corre todos los tests
2. 📝 Hace commit automático
3. 🚀 Hace push a GitHub
4. 🔗 GitHub Actions automáticamente valida y despliega a Vercel

---

## 📋 Checklist de Sesión de Desarrollo

**Cada vez que inicies con tokens disponibles:**

- [ ] **Decide qué tarea hacer**
  - ¿Qué tanda/feature voy a implementar?
  - ¿Quiero refactor/bug fix/nueva funcionalidad?
  
- [ ] **Edita el código** en tu editor favorito
  - Guarda los cambios normalmente
  
- [ ] **Ejecuta la rutina**
  ```bash
  ./dev-routine.sh "feat: descripción breve del cambio"
  ```
  
- [ ] **El script te guía**
  - Te muestra qué cambios detectó
  - Corre tests automáticamente
  - Te pide confirmar antes de commit/push
  - Hace push a GitHub

- [ ] **GitHub Actions se ejecuta automáticamente**
  - Corre los tests nuevamente en el servidor
  - Valida el código
  - Despliega a Vercel si todo está bien

- [ ] **Listo** ✅
  - Tu cambio está en GitHub
  - Vercel está desplegando
  - Los tests están validados

---

## 📊 Flujo Visual

```
TÚ (local)          GITHUB          GITHUB ACTIONS      VERCEL
   │                  │                  │                 │
   │─ Editar código ──│                  │                 │
   │                  │                  │                 │
   │─ ./dev-routine.sh│                  │                 │
   │  ├─ npm test ✓   │                  │                 │
   │  ├─ git add      │                  │                 │
   │  ├─ git commit   │                  │                 │
   │  └─ git push ────┼─→ push recibido  │                 │
   │                  │                  │                 │
   │                  │         ┌─────────┤                 │
   │                  │         │ CI Iniciado              │
   │                  │         ├─ npm test                │
   │                  │         ├─ lint check              │
   │                  │         ├─ coverage                │
   │                  │         └─ resultado ✓             │
   │                  │                  │                 │
   │                  │                  └─────────→ Deploy │
   │                  │                              Preview│
   │                  │                                     │
   Listo para         Sincronizado      Tests OK       Desplegado
   siguiente tarea    en GitHub         Automático      en Vercel
```

---

## 🎯 Flujos de Trabajo Comunes

### Implementar una Tanda Nueva

```bash
# 1. Lee el plan de la tanda (en CLAUDE.md o Finko_Pro_Claude_Code_Plan.md)

# 2. Abre los archivos a editar en tu editor

# 3. Haz los cambios necesarios

# 4. Guarda todo

# 5. Ejecuta la rutina
./dev-routine.sh "feat(tanda-XX): descripción breve"

# ¡Listo! GitHub Actions validará todo
```

### Corregir un Bug

```bash
# 1. Identifica el bug (tests que fallan, comportamiento incorrecto)

# 2. Edita el código para arreglarlo

# 3. Verifica que los tests pasen localmente
npm test

# 4. Ejecuta la rutina
./dev-routine.sh "fix: descripción del bug corregido"
```

### Refactorizar Código

```bash
# 1. Identifica qué quieres refactorizar

# 2. Edita el código

# 3. Asegúrate que los tests siguen pasando
npm test

# 4. Ejecuta la rutina
./dev-routine.sh "refactor: descripción del cambio estructural"
```

---

## 🔧 Comandos Manuales (si quieres control total)

Si prefieres hacer pasos individuales:

```bash
# Ver cambios
git status
git diff

# Correr tests
npm test

# Ver coverage (opcional)
npm run coverage

# Hacer commit manualmente
git add -A
git commit -m "feat: descripción"

# Push manual
git push -u origin rama-actual

# Ver commits recientes
git log --oneline -5
```

---

## 📱 Monitoreo Remoto

Después de hacer push, puedes monitorear el progreso:

1. **GitHub Actions**: https://github.com/tu-usuario/finko-refactor/actions
   - Ve qué está pasando en CI
   - Verifica que los tests pasen
   - Mira logs detallados si algo falla

2. **Vercel Dashboard**: https://vercel.com/dashboard
   - Ve el status del deployment
   - Verifica URLs de preview
   - Mira logs de deployment

3. **GitHub**: https://github.com/tu-usuario/finko-refactor
   - Mira el historial de commits
   - Verifica que las ramas están sincronizadas

---

## 🚨 Si Algo Falla

### Tests fallan localmente

```bash
# Mira qué test falló
npm test

# Lee el error
# Edita el código para arreglarlo
# Corre tests nuevamente
npm test

# Una vez pasen, intenta la rutina de nuevo
./dev-routine.sh "fix: corregir test X"
```

### GitHub Actions falla

Vas a GitHub → Actions → Abre el workflow que falló:
- Lee el log detallado
- Identifica qué pasó (generalmente tests o sintaxis)
- Arregla localmente y haz push nuevamente

### Vercel falla

Vas a Vercel Dashboard → Tu proyecto:
- Ve el build log
- Generalmente es por configuración (ya debería estar ok)
- Si ves algo, coordina cambios y re-deploy

---

## 📚 Convenciones de Commits

Usa prefijos clara para que el historio sea legible:

```
feat:      Nueva funcionalidad
fix:       Corrección de bug
refactor:  Cambio estructural sin cambiar funcionalidad
style:     Formato, espacios, etc
docs:      Cambios en documentación
test:      Tests nuevos o actualización de tests
chore:     Cambios en configuración, deps, etc
```

Ejemplos buenos:
```
feat(predictor): agregar validador de fin de quincena
fix(inversiones): corregir cálculo de severidad
refactor(modules): reorganizar estructura de carpetas
test(analisis): agregar 15 tests para rangoPeriodo
```

---

## ⏱️ Timing Esperado

Cada sesión típicamente toma:

| Tarea | Tiempo Local | Tiempo CI/CD | Total |
|-------|--------------|--------------|-------|
| Feature pequeña | 5-15 min | 2 min | ~15 min |
| Feature mediana | 20-40 min | 2 min | ~40 min |
| Tanda completa | 1-3 horas | 2 min | ~3 horas |
| Refactor grande | 30-60 min | 2 min | ~60 min |

---

## 🎓 Tips

1. **Commits pequeños**: Es mejor hacer 3 commits de 10 líneas cada uno que 1 commit de 30 líneas

2. **Tests primero**: Asegúrate que `npm test` pase antes de usar `dev-routine.sh`

3. **Descripción clara**: El mensaje de commit debe ser específico:
   - ✅ `feat: agregar predictor de fin de quincena`
   - ❌ `cambios varios`

4. **Branch para features grandes**: Si es tanda grande, crea una branch:
   ```bash
   git checkout -b feature/tanda-XX-descripcion
   ```

5. **Verifica GitHub Actions**: Abre Actions después de push para ver que todo pasó

---

## 🔗 Enlaces Útiles

- **Tu Repo**: https://github.com/tu-usuario/finko-refactor
- **GitHub Actions**: https://github.com/tu-usuario/finko-refactor/actions
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Plan de Tandas**: Ver `Finko_Pro_Claude_Code_Plan.md`
- **Código Base**: Ver `CLAUDE.md`

---

**¿Listo? Ejecuta:**

```bash
chmod +x dev-routine.sh
./dev-routine.sh "feat: descripción del primer cambio"
```

¡Vamos! 🚀

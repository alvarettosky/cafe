# Café Mirador CRM

[![CI](https://github.com/alvarettosky/cafe/actions/workflows/ci.yml/badge.svg)](https://github.com/alvarettosky/cafe/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/alvarettosky/cafe/actions/workflows/e2e.yml/badge.svg)](https://github.com/alvarettosky/cafe/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/gh/alvarettosky/cafe/branch/main/graph/badge.svg)](https://codecov.io/gh/alvarettosky/cafe)
[![Deploy](https://img.shields.io/badge/deploy-vercel-black)](https://cafe-pi-steel.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Sistema de gestión de inventario, punto de venta (POS) y administración de clientes para Café Mirador.

## 🚀 Demo en Vivo

**URL de Producción:** https://cafe-pi-steel.vercel.app

La aplicación está desplegada en Vercel con actualizaciones automáticas en cada push a la rama `main`.

## Tecnologías
- **Frontend**: Next.js 16, TailwindCSS 4, Framer Motion.
- **Backend**: Supabase (PostgreSQL, Auth, RLS, RPCs).
- **Testing**: Vitest, Playwright, Stryker, k6 (Unit, Integration, E2E, Mutation, Load).

## Requisitos previos
1. **Node.js**: v20+ (o usar `./setup_env.sh`).
2. **Supabase**: Proyecto configurado (ver `SUPABASE_SETUP.md`).

## Cómo ejecutar localmente (Desarrollo)

1. **Activar Entorno Virtual (IMPORTANTE)**:
   Este proyecto usa una versión específica de Node.js. Ejecuta este comando en cada nueva terminal:
   ```bash
   source setup_env.sh # O añade export PATH=$(pwd)/.node_env/bin:$PATH manualmente
   export PATH=$(pwd)/.node_env/bin:$PATH
   ```

2. **Configurar variables**:
   Asegúrate de tener el archivo `.env.local` en la raíz del proyecto con tus credenciales de Supabase.

3. **Instalar dependencias**:
   ```bash
   npm install
   ```

4. **Iniciar servidor**:
   ```bash
   npm run dev
   ```

5. **Ver en navegador**:
   Abre [http://localhost:3000](http://localhost:3000).

6. **Ejecutar Pruebas**:
   ```bash
   # Unit & Integration Tests
   npm test                    # Ejecutar todos los tests
   npm run test:coverage       # Ver reporte de cobertura
   npm run test:watch          # Modo watch
   npm run test:ui             # Interfaz UI

   # E2E Tests
   npx playwright test         # Tests E2E en todos los navegadores
   npx playwright test --ui    # Modo UI interactivo

   # Advanced Testing
   npm run test:mutation       # Mutation testing (Stryker)
   npm run test:db             # Database integration tests
   npm run test:load           # Load testing (k6)
   ```

## Cómo desplegar en Producción (Vercel)
Este proyecto está optimizado para **Vercel**.

1. Sube este código a un repositorio GitHub.
2. Inicia sesión en [Vercel](https://vercel.com) e importa el proyecto.
3. En la configuración de "Environment Variables", añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Despliega.

## Testing

### Coverage Goals
- **Lines**: 80%+
- **Functions**: 80%+
- **Branches**: 80%+
- **Statements**: 80%+

### Testing Strategy
- **Unit Tests**: Component and utility function testing (Vitest + Testing Library)
- **Integration Tests**: Multi-component interactions with API mocking (MSW)
- **E2E Tests**: Full user flows - sales, analytics, inventory (Playwright)
- **Load Tests**: Performance under stress (k6)
- **Mutation Tests**: Test quality verification (Stryker)
- **Database Tests**: RPC functions and data integrity (Vitest + Supabase)

### CI/CD Pipeline
- **Pre-commit**: Lint, format, type-check, related tests (Husky + lint-staged)
- **On Push**: Full CI pipeline (lint, tests, type-check, build)
- **On PR**: Coverage reports and comments
- **Nightly**: Mutation and load tests

Ver documentación completa en `/docs/testing/`

## 📚 Documentación

- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - Resumen completo del deployment
- **[VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)** - Guía de deployment en Vercel
- **[MIGRATION_NOTES.md](MIGRATION_NOTES.md)** - Notas de migración frontend→root
- **[docs/testing/](docs/testing/)** - Documentación completa de testing
  - [TESTING_GUIDE.md](docs/testing/TESTING_GUIDE.md) - Guía de testing
  - [CI_CD.md](docs/testing/CI_CD.md) - Pipeline CI/CD
  - [WRITING_TESTS.md](docs/testing/WRITING_TESTS.md) - Cómo escribir tests

## Estructura del Proyecto
- `/app`: Páginas y rutas de Next.js (App Router).
- `/components`: Componentes reutilizables de React.
- `/lib`: Utilidades y configuraciones (Supabase, validaciones).
- `/types`: Definiciones de TypeScript.
- `/public`: Archivos estáticos.
- `/supabase`: Migraciones SQL y semillas de datos.
- `/tests`: Suite completa de tests (load, database).
- `/e2e`: Tests end-to-end con Playwright.
- `/docs`: Documentación del proyecto.

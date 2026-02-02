# Ficha Técnica del Proyecto

## Información General

| Campo                   | Valor                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nombre del Proyecto** | Café Mirador CRM                                                                                                                                          |
| **Descripción**         | Sistema de gestión para venta de café por libras y medias libras, con tienda online, programa de referidos (voz a voz), y gestión de clientes recurrentes |
| **Versión**             | 0.1.0                                                                                                                                                     |
| **Estado**              | En producción                                                                                                                                             |
| **Licencia**            | Privado                                                                                                                                                   |

## Fechas

| Evento                   | Fecha                |
| ------------------------ | -------------------- |
| **Inicio del proyecto**  | 16 de enero de 2026  |
| **Última actualización** | 2 de febrero de 2026 |

## Cuentas y Accesos

### GitHub

| Campo           | Valor                                 |
| --------------- | ------------------------------------- |
| **Usuario**     | alvarettosky                          |
| **Correo**      | alvaroangelm@iepedacitodecielo.edu.co |
| **Repositorio** | https://github.com/alvarettosky/cafe  |
| **Visibilidad** | Privado                               |

### Supabase

| Campo        | Valor                                    |
| ------------ | ---------------------------------------- |
| **Proyecto** | cafe-de-salento                          |
| **URL**      | https://inszvqzpxfqibkjsptsm.supabase.co |
| **Región**   | Por confirmar                            |
| **Plan**     | Free Tier                                |
| **Correo**   | alvaroangelm@iepedacitodecielo.edu.co    |

### Vercel (Deploy)

| Campo                   | Valor                            |
| ----------------------- | -------------------------------- |
| **URL Producción**      | https://cafe-pi-steel.vercel.app |
| **Dominio alternativo** | https://cafe-mirador.vercel.app  |
| **Branch de deploy**    | main                             |
| **Deploy automático**   | Sí (en cada push a main)         |

## Stack Tecnológico

### Frontend

| Tecnología    | Versión | Propósito                      |
| ------------- | ------- | ------------------------------ |
| Next.js       | 16      | Framework React con App Router |
| React         | 19      | Librería UI                    |
| TailwindCSS   | 4       | Estilos                        |
| Framer Motion | -       | Animaciones                    |
| Radix UI      | -       | Componentes accesibles         |
| Lucide Icons  | -       | Iconografía                    |
| Recharts      | -       | Gráficos y visualizaciones     |

### Backend

| Tecnología   | Propósito                                         |
| ------------ | ------------------------------------------------- |
| Supabase     | Base de datos PostgreSQL, Auth, RLS, Storage      |
| Supabase RPC | Funciones de servidor (process_coffee_sale, etc.) |

### Testing

| Herramienta     | Propósito                     |
| --------------- | ----------------------------- |
| Vitest          | Tests unitarios e integración |
| Testing Library | Tests de componentes React    |
| Playwright      | Tests E2E                     |
| Stryker         | Mutation testing              |
| k6              | Load testing                  |
| MSW             | Mock de APIs                  |

### CI/CD

| Servicio       | Propósito               |
| -------------- | ----------------------- |
| GitHub Actions | CI (lint, tests, build) |
| Vercel         | Deploy automático       |
| Husky          | Git hooks (pre-commit)  |

## Métricas del Proyecto

| Métrica                | Valor |
| ---------------------- | ----- |
| **Tests unitarios**    | 854+  |
| **Tests E2E**          | 7     |
| **Cobertura**          | 93%+  |
| **Tablas en BD**       | 20    |
| **RPCs implementadas** | 30+   |

## Fases de Desarrollo

| Fase | Nombre                         | Estado        |
| ---- | ------------------------------ | ------------- |
| 1    | Maximizar Recurrencia          | ✅ Completado |
| 2    | Portal de Cliente Self-Service | ✅ Completado |
| 3    | Crecimiento y Escalabilidad    | ✅ Completado |
| 4    | Arquitectura POS Profesional   | ✅ Completado |

## Funcionalidades Principales

- **Inventario**: Gestión de café con stock en kg, alertas de stock bajo, Kardex de movimientos
- **Ventas**: Venta por libras (453.6g) y medias libras (226.8g), múltiples métodos de pago, variantes (presentación, tipo de molido)
- **Clientes recurrentes**: Predicción de próxima compra basada en historial, segmentación RFM automática, contacto vía WhatsApp
- **Tienda Online (Portal)**: Acceso self-service con magic links, pedidos online, suscripciones automáticas de café
- **Voz a Voz (Referidos)**: Programa de referidos con códigos únicos, seguimiento y recompensas
- **Analytics**: Dashboard con KPIs, gráficos de ventas, métricas de profit
- **Precios diferenciados**: Listas de precios por tipo de cliente (retail, mayorista, cafetería)
- **Zonas de entrega**: Gestión de entregas a domicilio por zona y día
- **Exportación**: Backup a CSV/XLSX, backup automático diario

## Variables de Entorno Requeridas

### Desarrollo Local (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### GitHub Secrets (para CI/CD)

| Secret                          | Propósito                 | Requerido |
| ------------------------------- | ------------------------- | --------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL del proyecto Supabase | ✅        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Clave admin para backups  | ✅        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública             | Opcional  |
| `RESEND_API_KEY`                | Notificaciones por email  | Opcional  |
| `NOTIFICATION_EMAIL`            | Destinatario de alertas   | Opcional  |

## Workflows Automáticos

| Workflow           | Frecuencia      | Propósito                          |
| ------------------ | --------------- | ---------------------------------- |
| `ci.yml`           | En cada push    | Lint, tests, type-check, build     |
| `e2e.yml`          | En cada push    | Tests E2E con Playwright           |
| `daily-backup.yml` | Diario 2:00 UTC | Backup completo a Supabase Storage |
| `nightly.yml`      | Diario 3:00 UTC | Mutation y load testing            |
| `keep-alive.yml`   | Cada 5 días     | Ping a Supabase para evitar pausa  |

## Contacto y Soporte

| Canal             | Información                                 |
| ----------------- | ------------------------------------------- |
| **Desarrollador** | alvarettosky                                |
| **Email**         | alvaroangelm@iepedacitodecielo.edu.co       |
| **Issues**        | https://github.com/alvarettosky/cafe/issues |

## Documentación Relacionada

| Archivo                | Descripción                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `CLAUDE.md`            | Guía técnica para Claude Code (arquitectura, comandos, convenciones) |
| `INSTRUCCIONES.md`     | Guía de inicio rápido para desarrolladores                           |
| `SUPABASE_SETUP.md`    | Configuración y migraciones de base de datos                         |
| `VERCEL_DEPLOYMENT.md` | Configuración de deploy en Vercel                                    |
| `docs/plans/`          | Roadmap y planes de cada fase                                        |
| `docs/testing/`        | Guías de testing                                                     |

---

_Última actualización: 2 de febrero de 2026_

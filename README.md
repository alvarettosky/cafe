# Café Mirador CRM

Sistema de gestión de inventario, punto de venta (POS) y administración de clientes para Café Mirador.

## Tecnologías
- **Frontend**: Next.js 16, TailwindCSS 4, Framer Motion.
- **Backend**: Supabase (PostgreSQL, Auth, RLS, RPCs).
- **Testing**: Vitest (Unit & Integration).

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
   Asegúrate de tener el archivo `.env.local` en la carpeta `frontend` con tus credenciales de Supabase.
   
3. **Instalar dependencias**:
   ```bash
   cd frontend
   npm install
   ```

4. **Iniciar servidor**:
   ```bash
   npm run dev
   ```

5. **Ver en navegador**:
   Abre [http://localhost:3000](http://localhost:3000).

6. **Ejecutar Pruebas**:
   Puedes ejecutar suite completa de pruebas (Frontend + Backend) desde la raíz:
   ```bash
   npm test               # Ejecutar todos los tests
   npm run test:coverage  # Ver reporte de cobertura
   ```

## Cómo desplegar en Producción (Vercel)
Este proyecto está optimizado para **Vercel**.

1. Sube este código a un repositorio GitHub.
2. Inicia sesión en [Vercel](https://vercel.com) e importa el proyecto.
3. En la configuración de "Environment Variables", añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Despliega.

## Estructura del Proyecto
- `/frontend`: Código fuente de la aplicación web.
- `/supabase`: Migraciones SQL y semillas de datos.
- `/src/__tests__`: Pruebas de integración del backend.

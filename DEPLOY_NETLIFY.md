# Guía de Despliegue en Netlify

Es totalmente posible desplegar esta aplicación en Netlify. Sigue estos pasos:

## 1. Preparar el repositorio (GitHub)
Asegúrate de que tu código esté subido a GitHub (u otro proveedor git).
El proyecto tiene la siguiente estructura:
```
/ (raíz del repo)
  ├── frontend/       <-- Aquí está la App Next.js
  ├── supabase/       <-- Migraciones de BD
  ...
```

## 2. Configurar en Netlify
1. Inicia sesión en [Netlify](https://app.netlify.com/).
2. Haz clic en **"Add new site"** > **"Import an existing project"**.
3. Conecta con GitHub y selecciona tu repositorio.

## 3. Configuración del Build (IMPORTANTE)
Como tu aplicación está dentro de una carpeta llamada `frontend`, debes configurar esto con cuidado:

- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `.next` (o déjalo vacío, Netlify suele detectarlo automáticamente).

> **Nota**: Netlify detectará automáticamente que es un proyecto **Next.js** e instalará el "Next.js Runtime" necesario.

## 4. Variables de Entorno
Antes de darle a "Deploy", busca la sección **Environment variables** (o ve a "Site configuration" > "Environment variables" después).

Debes añadir las mismas que tienes en tu `.env.local`:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI...` (Tu llave pública) |

## 5. Finalizar
Haz clic en **"Deploy"**. Netlify construirá tu sitio y en unos minutos tendrás una URL pública (ej. `cafe-mirador.netlify.app`).

---

### Solución de Problemas Comunes

- **Error 404 / Pantalla Blanca**: Verifica que el *Base directory* esté configurado en `frontend`.
- **Error de Conexión (Failed to fetch)**: Verifica que las variables de entorno estén bien copiadas y **redespliega** el sitio (Trigger deploy) para que las tome.

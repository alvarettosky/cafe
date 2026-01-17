# Vercel Deployment Configuration

## Quick Fix for 404 Error

The 404 error occurs because Vercel is trying to deploy from the root directory, but our Next.js app is in the `frontend/` subdirectory.

### Solution 1: Configure Root Directory in Vercel Dashboard (Recommended)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project (cafe-mirador)
3. Go to **Settings** → **General**
4. Find **Root Directory** section
5. Click **Edit**
6. Set Root Directory to: `frontend`
7. Click **Save**
8. Trigger a new deployment

### Solution 2: Use vercel.json (Already configured)

The `vercel.json` file in the root has been configured to point to the `frontend/` directory.

If Solution 1 doesn't work, you may need to redeploy after the next push.

## Environment Variables

Make sure these are set in Vercel Dashboard → Settings → Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Build Settings (Vercel Dashboard)

If manually configuring:

- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

## Troubleshooting

### Still getting 404?

1. Check build logs in Vercel Dashboard
2. Verify Root Directory is set to `frontend`
3. Ensure environment variables are set
4. Try redeploying from Vercel Dashboard → Deployments → Redeploy

### Build fails?

Check that `frontend/package.json` has correct scripts:
- `build`: Should run `next build`
- `start`: Should run `next start`
- `dev`: Should run `next dev`

# $ANAL Website Deployment Guide

## Quick Start

The website is a single HTML file with embedded CSS - no build process needed!

## Option 1: GitHub Pages (Recommended - FREE)

### Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `anal-website`
3. Make it **Public**
4. Click "Create repository"

### Step 2: Push the Code
```bash
cd /data/workspace/anal-website
git remote add origin https://github.com/prismblanco/anal-website.git
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repo on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select:
   - Branch: `main`
   - Folder: `/ (root)`
4. Click **Save**

### Step 4: Access Your Site
- URL: `https://prismblanco.github.io/anal-website`
- Wait 2-5 minutes for deployment

## Option 2: Railway Deployment

```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## Option 3: Vercel (Drag & Drop)

1. Go to https://vercel.com/new
2. Drag the `anal-website` folder
3. Click Deploy
4. Done!

## Option 4: Netlify (Drag & Drop)

1. Go to https://app.netlify.com/drop
2. Drag the `anal-website` folder
3. Get instant URL

## Custom Domain (Optional)

Once deployed, you can add a custom domain like:
- `analbylana.com`
- `anal.ai`
- `getanal.xyz`

In the repo **Settings → Pages → Custom domain**, enter your domain (e.g. `analbylana.xyz`), save, then at your DNS provider add the records GitHub shows (often a **CNAME** from `www` to `prismblanco.github.io`, or **A**/`AAAA` apex records). Until DNS and the Pages custom domain are both set, the domain can show **404**.

## Features Included

- Mobile responsive
- Animated gradient background
- Links to Pump.fun, X, Solscan
- SEO optimized
- Fast loading (single file)

## Support

Need help deploying? Just ask!

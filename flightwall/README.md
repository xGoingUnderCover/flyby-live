# ✈ FlyBy.live

Live flight tracker — enter any US zip code and see real aircraft overhead in real time.

Built with React + Vite, deployed on Vercel (free), powered by adsb.lol ADS-B data.

---

## 🚀 Deploy to Vercel (free, ~5 minutes)

### Step 1 — Get the code on GitHub

1. Go to **github.com** and create a free account if you don't have one
2. Click the **+** button → **New repository**
3. Name it `flyby-live`, set it to Public, click **Create repository**
4. Upload all the files from this zip (drag & drop onto the GitHub page)

### Step 2 — Deploy on Vercel

1. Go to **vercel.com** and sign up with your GitHub account (free)
2. Click **Add New → Project**
3. Find your `flyby-live` repo and click **Import**
4. Vercel auto-detects Vite — just click **Deploy**
5. In about 60 seconds you'll have a live URL like `flyby-live.vercel.app`

### Step 3 — Add your custom domain (optional)

1. Buy `flyby.live` from Namecheap, GoDaddy, etc. (~$20/yr for .live domains)
2. In Vercel → your project → **Settings → Domains**
3. Add `flyby.live` and follow the DNS instructions (Vercel walks you through it)

---

## 📁 Project structure

```
flyby-live/
├── api/
│   ├── flights.js     ← Server proxy: fetches adsb.lol (no CORS for users)
│   └── zip.js         ← Converts zip code → lat/lon
├── src/
│   └── App.jsx        ← Full React frontend
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## 🛠 Run locally (optional)

```bash
npm install
npm run dev
```

Note: the `/api` routes only work when deployed to Vercel or running with `vercel dev`.
To test locally install the Vercel CLI: `npm i -g vercel` then run `vercel dev`.

---

## Data attribution

Flight data provided by [adsb.lol](https://adsb.lol) under ODbL 1.0 license.

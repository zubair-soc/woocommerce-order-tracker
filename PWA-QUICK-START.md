# PWA QUICK START - v11.0
**Program Registrations - Mobile Progressive Web App**

---

## 🎯 WHAT YOU GOT

✅ **Full PWA Implementation**
- Install on home screen (iOS + Android + Desktop)
- Offline caching (view cached rosters/orders)
- Mobile-responsive layouts (cards on phones, tables on desktop)
- Blue "P" icon in multiple sizes

✅ **Mobile Layouts**
- Orders page: Card view with product boxes
- Roster page: Card view with action buttons
- 2x2 button grid on mobile
- Scrollable date filters
- NO changes to desktop (tables still work)

✅ **PWA Features**
- Manifest.json configured
- Service worker with offline caching
- Installable on all platforms
- Standalone app mode (no browser UI)

---

## ⚡ DEPLOY IN 5 MINUTES

### 1. Create icons directory
```bash
mkdir -p public/icons
```

### 2. Copy 8 icon files
```bash
cp icon-*.png public/icons/
```

### 3. Copy PWA core files
```bash
cp manifest.json public/
cp sw.js public/
```

### 4. Replace 3 app files (BACKUP FIRST!)
```bash
# Backup
cp app/layout.tsx app/layout.backup.tsx
cp app/orders/page.tsx app/orders/page.backup.tsx
cp app/programs/[programName]/page.tsx app/programs/[programName]/page.backup.tsx

# Deploy
cp layout-PWA.tsx app/layout.tsx
cp orders-page-PWA-MOBILE.tsx app/orders/page.tsx
cp roster-page-PWA-MOBILE.tsx app/programs/[programName]/page.tsx
```

### 5. Commit & Deploy
```bash
git checkout -b feature/pwa-mobile-layouts
git add .
git commit -m "feat: PWA with mobile layouts"
git push origin feature/pwa-mobile-layouts
```

### 6. Test
- Desktop: Open app → Should look same as v10.5
- Mobile (F12 → Device toggle → iPhone 12 Pro): Should show cards
- PWA: Click install icon in browser → Install → Launch from home screen

---

## 📱 MOBILE BREAKPOINT

**768px and below = Mobile layout**

**What changes on mobile:**
- Tables → Cards
- "View All Rosters" → "Rosters"
- "Copy Emails" → "Emails"
- Horizontal buttons → 2x2 grid

**What stays the same:**
- All functionality
- All data
- All colors
- All features

---

## 🧪 QUICK TEST

**Desktop (>768px):**
1. Open /orders → See table ✅
2. Open /programs/[any] → See table ✅
3. Resize window to <768px → See cards ✅

**Mobile (<768px):**
1. F12 → Toggle device → iPhone 12 Pro
2. Open /orders → See cards ✅
3. Open /programs/[any] → See cards ✅
4. Tap buttons → All work ✅

**PWA:**
1. Look for install icon in address bar
2. Click "Install Program Registrations"
3. App opens in standalone window ✅
4. Icon on home screen/dock ✅

---

## 🎨 MOBILE DESIGN

**Card Layout:**
- White background
- Subtle shadow
- Rounded corners (8px)
- 15px padding
- Info in rows (label: value)
- Actions in 3-column grid at bottom

**Button Grid:**
- 2 columns on mobile
- 10px gap
- Full-width buttons

**Colors:**
- Same as v10.5 (no changes)
- Blue #007bff, Green #28a745, etc.

---

## ðŸ› IF SOMETHING BREAKS

```bash
# Restore from backups
cp app/layout.backup.tsx app/layout.tsx
cp app/orders/page.backup.tsx app/orders/page.tsx
cp app/programs/[programName]/page.backup.tsx app/programs/[programName]/page.tsx

# Remove PWA
rm public/manifest.json
rm public/sw.js
rm -rf public/icons

# Redeploy
git add .
git commit -m "revert: Remove PWA"
git push
```

---

## 📦 FILES IN THIS PACKAGE

**Icons (8 files):**
- icon-72x72.png through icon-512x512.png

**PWA Core:**
- manifest.json
- sw.js

**App Files:**
- layout-PWA.tsx
- orders-page-PWA-MOBILE.tsx
- roster-page-PWA-MOBILE.tsx

**Documentation:**
- PWA-DEPLOYMENT-GUIDE.md (detailed)
- PWA-QUICK-START.md (this file)

---

## ✅ SUCCESS = 3 CHECKS

1. **Desktop unchanged** → Tables visible, looks like v10.5
2. **Mobile cards** → Open on phone, see card layouts
3. **PWA installs** → Click install, app opens standalone

---

## 🚀 NEXT FEATURES (v11.1+)

After testing this for 1-2 weeks:
- Pull-to-refresh
- Swipe gestures on cards
- Offline edit queue
- Push notifications
- Background sync

---

**Ready to deploy? Follow the 5-minute guide above!**

**Need help? Read PWA-DEPLOYMENT-GUIDE.md for detailed instructions.**

**Questions? Test in incognito mode first, then check troubleshooting section.**

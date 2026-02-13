# PWA DEPLOYMENT GUIDE
## Program Registrations v11.0 - Mobile PWA

---

## 📦 FILES TO DEPLOY

### 1. **Icons** (8 files) → `public/icons/`
Create directory: `public/icons/`

Copy all 8 generated PNG files:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

### 2. **PWA Manifest** → `public/manifest.json`
Copy: `manifest.json` → `public/manifest.json`

### 3. **Service Worker** → `public/sw.js`
Copy: `sw.js` → `public/sw.js`

### 4. **Root Layout** → `app/layout.tsx`
**BACKUP FIRST:** `cp app/layout.tsx app/layout.backup.tsx`
Copy: `layout-PWA.tsx` → `app/layout.tsx`

### 5. **Orders Page** → `app/orders/page.tsx`
**BACKUP FIRST:** `cp app/orders/page.tsx app/orders/page.backup.tsx`
Copy: `orders-page-PWA-MOBILE.tsx` → `app/orders/page.tsx`

### 6. **Roster Page** → `app/programs/[programName]/page.tsx`
**BACKUP FIRST:** `cp app/programs/[programName]/page.tsx app/programs/[programName]/page.backup.tsx`
Copy: `roster-page-PWA-MOBILE.tsx` → `app/programs/[programName]/page.tsx`

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Create PWA Branch
```bash
git checkout -b feature/pwa-mobile-layouts
```

### Step 2: Create Icons Directory
```bash
mkdir -p public/icons
```

### Step 3: Copy All Files
```bash
# Copy icons
cp icon-*.png public/icons/

# Copy PWA files
cp manifest.json public/
cp sw.js public/

# Backup existing files
cp app/layout.tsx app/layout.backup.tsx
cp app/orders/page.tsx app/orders/page.backup.tsx
cp app/programs/[programName]/page.tsx app/programs/[programName]/page.backup.tsx

# Deploy new files
cp layout-PWA.tsx app/layout.tsx
cp orders-page-PWA-MOBILE.tsx app/orders/page.tsx
cp roster-page-PWA-MOBILE.tsx app/programs/[programName]/page.tsx
```

### Step 4: Commit Changes
```bash
git add .
git commit -m "feat: PWA implementation with mobile-responsive layouts"
```

### Step 5: Deploy to Vercel
```bash
git push origin feature/pwa-mobile-layouts
```

Then merge to main and deploy, OR deploy the branch directly in Vercel dashboard.

---

## 🧪 TESTING CHECKLIST

### Desktop Testing (Chrome/Firefox/Safari)
- [ ] Open app in browser
- [ ] Check: Does desktop layout still look correct?
- [ ] Orders page: Table view visible, cards hidden
- [ ] Roster page: Table view visible, cards hidden
- [ ] All buttons working
- [ ] No console errors

### Mobile Testing (Real Device or DevTools)
**Chrome DevTools Mobile Emulation:**
1. Press F12 → Click device toggle icon
2. Select iPhone 12 Pro (390x844)
3. Refresh page

**Checklist:**
- [ ] Orders page: Cards visible, table hidden
- [ ] Roster page: Cards visible, table hidden
- [ ] Date buttons scroll horizontally
- [ ] Action buttons in 2x2 grid
- [ ] Cards display all info correctly
- [ ] Touch targets feel good (not too small)
- [ ] No horizontal scrolling issues

### PWA Installation Testing

**On Desktop (Chrome):**
1. Open app in Chrome
2. Look for install icon in address bar (⊕ or computer icon)
3. Click "Install Program Registrations"
4. App should open in standalone window
5. Check: Icon appears in dock/taskbar
6. Check: No browser UI visible

**On Mobile (iOS Safari):**
1. Open app in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Tap "Add"
5. Icon should appear on home screen
6. Tap icon to launch
7. Check: Opens in fullscreen (no Safari UI)

**On Mobile (Android Chrome):**
1. Open app in Chrome
2. Look for "Add to Home Screen" banner
3. OR: Menu → "Install app"
4. Tap "Install"
5. Icon should appear on home screen
6. Tap icon to launch
7. Check: Opens in standalone mode

### Offline Testing

**Step 1: Load pages while online**
1. Visit /orders page
2. Visit /programs page
3. Visit a roster page
4. Visit /all-rosters page

**Step 2: Go offline**
- Chrome DevTools: Network tab → Select "Offline"
- OR: Turn off WiFi

**Step 3: Test cached pages**
- [ ] Refresh /orders → Should load from cache
- [ ] Refresh /programs → Should load from cache
- [ ] Refresh roster page → Should load from cache
- [ ] Click sync button → Should show offline message

**Step 4: Go back online**
- [ ] Sync button works again
- [ ] Fresh data loads

---

## ðŸ› TROUBLESHOOTING

### Issue: Install button doesn't appear
**Fix:**
- Ensure manifest.json is accessible at `/manifest.json`
- Check console for manifest errors
- Try incognito window (extensions can block PWA)
- Ensure HTTPS (localhost works too)

### Issue: Service worker not registering
**Fix:**
- Check console for errors
- Verify sw.js is at `/sw.js` (not `/public/sw.js`)
- Clear browser cache and reload
- Unregister old service workers: DevTools → Application → Service Workers → Unregister

### Issue: Mobile layout not showing
**Fix:**
- Verify screen width is ≤768px
- Check browser zoom is 100%
- Inspect element → Computed styles → Check media query active
- Clear cache and hard reload (Ctrl+Shift+R)

### Issue: Icons don't show on home screen
**Fix:**
- Verify icons exist at `/icons/icon-*.png`
- Check manifest.json paths are correct
- Try different icon size (iOS prefers 192, Android prefers 512)
- Clear cache and reinstall

### Issue: Offline mode doesn't work
**Fix:**
- Check service worker is active: DevTools → Application → Service Workers
- Verify cache storage: DevTools → Application → Cache Storage
- Reload page while online first (to populate cache)
- Check sw.js for syntax errors

---

## 🎯 WHAT WORKS OFFLINE

**✅ Works:**
- Viewing cached rosters
- Viewing cached orders
- Viewing cached programs
- Navigating between cached pages
- Reading cached data

**❌ Doesn't Work:**
- Syncing new orders
- Adding/editing players
- Copying emails (no API calls)
- Any database operations

**Why:** Service worker caches pages but not API responses. When offline, API calls fail gracefully with error messages.

---

## 📱 MOBILE BREAKPOINT

**Breakpoint:** 768px and below

**Desktop (>768px):**
- Table layouts
- Full button text ("+ Add Player")
- All filter options visible
- Horizontal action buttons

**Mobile (≤768px):**
- Card layouts
- Short button text ("+ Add")
- Scrollable date filters
- 2x2 button grid

---

## 🎨 MOBILE DESIGN NOTES

**Colors (from your HTML examples):**
- Primary Blue: #007bff
- Success Green: #28a745
- Grey: #6c757d
- Orange: #ff9800
- Purple (Edit): #6f42c1
- Red (Remove): #dc3545

**Card Design:**
- White background
- Subtle shadow: `0 2px 5px rgba(0,0,0,0.05)`
- Border: `1px solid #eee`
- Border radius: `8px`
- Padding: `15px`

**Button Grid:**
- 2 columns on mobile
- 10px gap between buttons
- Full-width buttons

**Typography:**
- Card headers: `1.1em` bold
- Meta text: `0.85em` grey
- Labels: `0.9em` bold grey

---

## 🔄 ROLLBACK PLAN

If something breaks:

```bash
# Restore backups
cp app/layout.backup.tsx app/layout.tsx
cp app/orders/page.backup.tsx app/orders/page.tsx
cp app/programs/[programName]/page.backup.tsx app/programs/[programName]/page.tsx

# Remove PWA files
rm public/manifest.json
rm public/sw.js
rm -rf public/icons

# Commit rollback
git add .
git commit -m "revert: Remove PWA implementation"
git push
```

---

## ✅ SUCCESS CRITERIA

**Desktop:**
- [ ] All pages look identical to v10.5
- [ ] No visual changes on desktop
- [ ] All features work

**Mobile:**
- [ ] Card layouts appear on phones
- [ ] All info readable without pinch-zoom
- [ ] Buttons easy to tap (not too small)
- [ ] No horizontal scrolling

**PWA:**
- [ ] Install prompt appears
- [ ] App installs successfully
- [ ] Launches in standalone mode
- [ ] Icon looks good on home screen
- [ ] Offline mode caches pages

---

## 📞 NEXT STEPS AFTER DEPLOYMENT

1. **Test on real device** (not just DevTools)
2. **Get feedback** from 2-3 users at the rink
3. **Monitor console** for errors in production
4. **Document issues** for v11.1 fixes

**Future Enhancements (v11.1+):**
- Pull-to-refresh gesture
- Swipe actions on cards
- Offline edit queue (sync when back online)
- Push notifications for new registrations
- Background sync for orders

---

**Questions? Issues? Check the troubleshooting section or test in incognito mode first.**

**Good luck! 🚀**

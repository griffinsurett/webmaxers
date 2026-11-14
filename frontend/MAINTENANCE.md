# MAINTENANCE.md

Comprehensive maintenance guide for Greastro template. Keep this updated as you learn from real-world updates.

---

## Maintenance Schedule

### Monthly (1st of each month)
- [ ] Check for security updates: `npm audit`
- [ ] Review GitHub Dependabot alerts
- [ ] Test build: `npm run build`

### Quarterly (Every 3 months)
- [ ] Check for outdated packages: `npm outdated`
- [ ] Review Astro changelog for upcoming changes
- [ ] Update patch versions: `npm update`
- [ ] Run full test suite (see Testing Checklist)

### Annually (January)
- [ ] Major dependency updates
- [ ] Review and update this maintenance guide
- [ ] Audit unused dependencies
- [ ] Performance audit with PageSpeed Insights
- [ ] Security header review

---

## Quick Health Check

Run this before and after any updates:
```bash
# 1. Clean install
rm -rf node_modules .astro dist
npm install

# 2. Build
npm run build

# 3. Preview
npm run preview

# 4. Manual tests (see Testing Checklist below)
```

---

## Dependency Risk Matrix

### 🟢 Low Risk (Update freely)
- **TypeScript** - Breaking changes rare, clear migration guides
- **Tailwind CSS** - Conservative versioning, additive changes
- **Zod** - Stable API, semantic versioning

**Update strategy:** Update to latest within major version
```bash
npm update typescript tailwindcss zod
```

### 🟡 Medium Risk (Review changelog first)
- **Astro** - Active development, occasional breaking changes
- **React** - Major versions can break, but Astro isolates impact
- **Vite** - Usually smooth, but check Astro compatibility

**Update strategy:** 
1. Read changelog
2. Update in dev branch
3. Test thoroughly
4. Deploy

### 🔴 High Risk (Proceed with caution)
- **Partytown** - Third-party, slower updates, could break
- **Content Collections API** - Core to template, changes require refactoring
- **Image optimization API** - Still evolving in Astro

**Update strategy:**
1. Read full migration guide
2. Create backup branch
3. Test extensively
4. Have rollback plan

---

## Common Breaking Changes & Fixes

### Astro Updates

#### Content Collections API Changes
**Symptom:** Build fails with "getEntryBySlug is not a function"

**Fix:**
```typescript
// Old (Astro 2.x)
const entry = await getEntryBySlug('blog', 'my-post');

// New (Astro 3.x+)
const entry = await getEntry('blog', 'my-post');
```

**Files to check:**
- `src/utils/collections/`
- `src/utils/query/`
- `src/pages/[collection]/[slug].astro`

#### Image Optimization Changes
**Symptom:** "getImage is not exported from astro:assets"

**Fix:**
```astro
// Check import path changed
import { getImage } from "astro:assets";

// If API changed, update in:
- src/components/BackgroundMedia.astro
```

**Centralized location:** Only `BackgroundMedia.astro` uses `getImage()` directly - update there first.

#### MDX Integration Changes
**Symptom:** MDX components not rendering

**Fix:**
```javascript
// Check astro.config.mjs
import mdx from '@astrojs/mdx';

export default defineConfig({
  integrations: [mdx()], // Ensure MDX integration present
});
```

### Tailwind CSS Updates

#### Tailwind 4.x → 5.x (Future)
**Likely changes:**
- Some utility classes renamed
- `@theme` directive changes
- JIT engine updates

**Preparation:**
```bash
# Before upgrading:
# 1. Audit custom classes
grep -r "class=" src/ | grep -v "node_modules"

# 2. Check for deprecated utilities
npm run build -- --verbose
```

**Files most affected:**
- `src/styles/globals.css`
- All `.astro` components with classes

### React Updates

#### React 18 → 19+ (Already done)
**Symptom:** Hydration warnings in console

**Fix:**
```astro
---
// Ensure client directives used correctly
---
<Component client:load />   <!-- For critical interactive components -->
<Component client:idle />   <!-- For non-critical -->
<Component client:visible /> <!-- For below-fold -->
```

### Partytown Issues

#### Service Worker Blocked
**Symptom:** "Refused to create a worker" CSP error

**Fix:**
```json
// vercel.json - Ensure worker-src includes blob:
{
  "key": "Content-Security-Policy",
  "value": "... worker-src 'self' blob: ..."
}
```

#### Partytown Not Loading
**Symptom:** Third-party scripts running on main thread

**Quick fix:** Remove Partytown temporarily
```javascript
// astro.config.mjs
export default defineConfig({
  integrations: [
    // partytown(), // Comment out temporarily
  ],
});
```

**Permanent fix:** Check Partytown GitHub for known issues, may need to wait for update.

---

## Update Procedures

### Patch Updates (x.x.X)
**Safe to update without testing**
```bash
npm update
npm run build
```

### Minor Updates (x.X.x)
**Review changelog, test in dev**
```bash
# 1. Check what will update
npm outdated

# 2. Update
npm update

# 3. Test
npm run build
npm run preview

# 4. Check for warnings
npm run build 2>&1 | grep -i "warn\|deprecated"
```

### Major Updates (X.x.x)
**Full testing required**
```bash
# 1. Create backup branch
git checkout -b update-astro-5

# 2. Review breaking changes
open https://docs.astro.build/en/guides/upgrade-to/v5/

# 3. Update one major dependency at a time
npm install astro@latest

# 4. Fix breaking changes (see migration guide)

# 5. Run full test suite (see below)

# 6. Test in preview environment
vercel --prod=false

# 7. If successful, merge
git checkout main
git merge update-astro-5
```

---

## Testing Checklist

### Automated Tests
```bash
# Build succeeds
npm run build

# TypeScript checks pass
npm run astro check

# No console errors
npm run preview
# Open DevTools → Console → No errors
```

### Manual Testing

#### 🏠 Homepage
- [ ] Hero image loads (check 3 viewport sizes)
- [ ] CTA buttons work
- [ ] Navigation menu opens/closes
- [ ] Dark mode toggle works
- [ ] Google Translate widget appears

#### 📄 Collection Index Pages
- [ ] `/blog` - Lists all posts
- [ ] `/services` - Shows service cards
- [ ] Hero image optimized (check Network tab)
- [ ] Grid layout responsive

#### 📝 Individual Item Pages
- [ ] `/blog/first-post` - Renders correctly
- [ ] Banner image loads
- [ ] Metadata displayed (date, author, reading time)
- [ ] MDX content renders
- [ ] Table of contents works (if present)

#### 🔍 SEO & Meta
```bash
# Open any page and check:
- <title> tag present
- <meta description> present
- Open Graph tags correct
- No console errors
```

#### 📱 Mobile Testing
```bash
# Chrome DevTools → Toggle device toolbar
- iPhone SE (375px)
- iPad (768px)
- Desktop (1920px)

# Check:
- Images load at correct sizes
- Menu works
- Text readable
- No horizontal scroll
```

#### ⚡ Performance
```bash
# Run PageSpeed Insights
open https://pagespeedinsights.web.dev/

# Should score:
- Performance: 95-100
- Accessibility: 90-100
- Best Practices: 95-100
- SEO: 90-100
```

#### 🔒 Security Headers
```bash
# Check headers deployed correctly
curl -I https://greastro.vercel.app | grep -i "content-security-policy\|strict-transport"

# Or use: https://securityheaders.com
```

---

## Warning Signs

### Build Warnings
**⚠️ Pay attention to:**
```
[build] The package "X" is deprecated
[build] Warning: ...
```

**Action:** Research the warning, plan replacement if needed.

### Performance Degradation
**🐌 Signs:**
- PageSpeed score drops below 90
- Build time increases significantly
- Image optimization failing

**Action:** 
1. Check for large unoptimized images
2. Review recent dependency updates
3. Profile build: `npm run build -- --verbose`

### Security Alerts
**🚨 Immediate action required:**
```bash
npm audit
# 
# X vulnerabilities (Y high, Z critical)
```

**Action:**
```bash
# Try automatic fix first
npm audit fix

# If that doesn't work
npm audit fix --force

# If still broken, manual update needed
npm install package-name@latest
```

### Deployment Failures
**❌ Vercel build fails**

**Common causes:**
1. **Node version mismatch**
```json
   // package.json - Specify Node version
   {
     "engines": {
       "node": ">=18.0.0"
     }
   }
```

2. **Missing environment variables**
   - Check Vercel dashboard → Settings → Environment Variables

3. **Build command changed**
```json
   // vercel.json
   {
     "buildCommand": "npm run build"
   }
```

---

## Rollback Procedures

### Quick Rollback (Vercel)
```bash
# In Vercel dashboard:
# Deployments → Find last working deployment → Promote to Production
```

### Code Rollback (Git)
```bash
# Find last working commit
git log --oneline

# Revert to that commit
git reset --hard <commit-hash>

# Force push (if already deployed)
git push --force
```

### Dependency Rollback
```bash
# package.json - Change version back
{
  "dependencies": {
    "astro": "4.15.0"  // Downgrade to working version
  }
}

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Astro Version Migration Guides

### Astro 4.x → 5.x (When released)
**Expected breaking changes:**
- Content Collections API refinements
- Image optimization API updates
- Possible middleware changes

**Migration path:**
1. Read official guide: https://docs.astro.build/en/guides/upgrade-to/v5/
2. Update `astro.config.mjs` first
3. Update `src/content/config.ts`
4. Test content collections
5. Update image components

**Estimated time:** 4-8 hours

### Astro 5.x → 6.x (Future)
**Will update when available**

---

## Monitoring & Alerts

### Set Up Monitoring

**1. Vercel Deployment Notifications**
- Vercel Dashboard → Project Settings → Git → Enable email alerts

**2. GitHub Dependabot**
- Already enabled automatically
- Review weekly digest

**3. PageSpeed Monitoring**
```bash
# Add to calendar: Monthly PageSpeed check
# URL: https://pagespeedinsights.web.dev/?url=https://greastro.vercel.app
```

**4. Security Headers Check**
```bash
# Add to calendar: Quarterly security check
# URL: https://securityheaders.com/?q=https://greastro.vercel.app
```

---

## Emergency Contacts & Resources

### When Things Break

**Astro Discord:** https://astro.build/chat  
**Astro Docs:** https://docs.astro.build  
**Tailwind Docs:** https://tailwindcss.com/docs  
**Vercel Support:** https://vercel.com/support

### Useful Commands
```bash
# Clear all caches (nuclear option)
rm -rf node_modules .astro dist .vercel package-lock.json
npm install
npm run build

# Check for circular dependencies
npm ls

# Analyze bundle size
npm run build -- --analyze

# Verbose build output
npm run build -- --verbose

# Check TypeScript
npm run astro check
```

---

## Version History

Keep track of major updates:

### 2024-11-11
- Initial Greastro template setup
- Astro 5.0
- React 19
- Tailwind CSS 4
- BackgroundMedia component with AVIF support
- Security headers configured

### [Add date here]
- [Document major changes]
- [Updated dependencies]
- [Breaking changes handled]

---

## Future Deprecation Watch List

**Monitor these for potential removal:**

- [ ] **Partytown** - Active development slowing?
- [ ] **Google Translate Widget** - Any Google announcements?
- [ ] **'unsafe-inline' CSP** - Can we eliminate it?

**Check quarterly:** Does the benefit still outweigh the maintenance cost?

---

## Performance Budget

**Maintain these metrics:**

| Metric | Target | Alert If |
|--------|--------|----------|
| **LCP** | < 2.5s | > 3.0s |
| **FID** | < 100ms | > 150ms |
| **CLS** | < 0.1 | > 0.15 |
| **Bundle Size** | < 200KB | > 300KB |
| **Build Time** | < 60s | > 120s |
| **PageSpeed** | > 95 | < 90 |

**Check monthly in production.**

---

## Notes & Learnings

Keep this section updated with real-world learnings:

### Lessons Learned

**[Date]:** [What happened, what broke, how fixed]

**Example:**
**2024-11-11:** Partytown CSP issues - Required `worker-src 'self' blob:` and special headers for `/~partytown/` routes. Solution documented in vercel.json.

---

## Quick Reference

### Most Common Tasks
```bash
# Update dependencies (safe)
npm update && npm run build

# Check for outdated packages
npm outdated

# Security audit
npm audit

# Full clean rebuild
rm -rf node_modules .astro dist && npm install && npm run build

# Deploy to Vercel
git push origin main

# Test locally with production build
npm run build && npm run preview
```

### Key Files to Watch

When updating dependencies, check these first:
- `src/components/BackgroundMedia.astro` - Image optimization
- `src/content/config.ts` - Content collections
- `src/utils/query/` - Query system
- `vercel.json` - Security headers
- `astro.config.mjs` - Core configuration

---

## Success Metrics

**Greastro template is healthy when:**

✅ Build completes in < 60 seconds  
✅ PageSpeed scores 95+ across all metrics  
✅ No console errors on any page  
✅ All images load optimized  
✅ Security headers pass securityheaders.com  
✅ No critical npm audit vulnerabilities  
✅ Zero layout shift (CLS = 0)  

**Check monthly. If any fail, investigate immediately.**

---

*Last updated: 2024-11-11*  
*Next review: 2025-02-11*
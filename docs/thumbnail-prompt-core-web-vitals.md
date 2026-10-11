# Thumbnail brief: "Core Web Vitals Explained" blog post

You're creating the cover image for a Webmaxxers blog post using ChatGPT image
generation. Don't jump straight to generating. First study the brand and the
post, then write the image prompt yourself, then generate, judge the result
against the checklist below, and iterate until it passes.

The post: `src/content/blog/core-web-vitals.mdx`, "Core Web Vitals Explained:
LCP, INP and CLS in Plain English". It explains Google's three page-experience
scores (loading speed, responsiveness, visual stability) to business owners,
not developers.

## Step 1: Study the brand before writing anything

Look at the real site, not just this brief. Build it (`npm run build`), serve
`dist/client` with a static server, and screenshot the homepage hero, the
homepage "Latest Articles" cards and a blog post page. Don't use `astro dev`;
its background sync can write to Supabase (see `AGENTS.md`).

Also read:

- `src/styles/global.css`: the colour tokens (the background, heading, text and
  accent values).
- `src/components/HeroLogo3D/metalLook.ts`: how the signature 3D logo is lit and
  textured.
- `src/components/HeroBackdrop/`: the starfield the hero and blog pages sit on.
- `src/content/blog/core-web-vitals.mdx`: the post, so the image fits what it
  actually says.

Summarise what you find in a few lines (palette, materials, lighting, mood)
before writing the prompt. Your prompt should come from that summary, not from
generic "tech blog" imagery.

**Ignore the two existing thumbnails** (`src/assets/blog/speed-thumbnail.jpg`,
`src/assets/blog/llms-blog.png`) for style. They're off-brand and will be
replaced. Use them for one thing only: their size.

## Step 2: Propose, then commit

Sketch three distinct concepts in a sentence or two each. Each should express
the post's idea (three scores, explained simply), fit the brand, and work as a
small card. Pick the strongest, say why in one line, and write the full image
prompt for it.

## Requirements (non-negotiable)

**Format**

- 1536 × 1024 px (3:2 landscape), the same size as the existing thumbnails.
- The site crops the same image two ways, so the subject has to survive both:
  - the blog card crops to **16:10 anchored to the top** (cuts about the bottom
    6%);
  - the post page crops to **16:9 centred** (cuts about 8% from the top and from
    the bottom).
  - Keep everything important in the middle ~70% of the height.
- Save as `src/assets/blog/core-web-vitals-thumbnail.jpg`.

**Brand**

- It has to look like it belongs on webmaxxers.com: the same dark background,
  the same materials and lighting as the 3D logo, and the accent colour used
  as sparingly as the site uses it.
- Premium, calm, editorial. It sits next to the post title on a dark card and
  should feel like part of the site, not a stock image.

**Content**

- No text, letters, numbers, logos or fake UI. Image models garble them, and
  the card prints the title anyway.
- Nothing that repeats other posts' visuals (the speed post uses a
  speedometer).
- One clear focal point that still reads at about 400 px wide.

## Step 3: Judge each result against this checklist

Generate, then check honestly. If any answer is no, revise the prompt (say what
you're changing and why) and generate again.

1. Would someone who knows the site recognise this as Webmaxxers? Compare it
   side by side with your homepage screenshot.
2. Is the palette right: no stray colours or colour casts beyond what the site
   uses?
3. Is there zero text, numbers or pseudo-UI, including garbled squiggles that
   look like text?
4. Does it say something about this post (three scores, made simple), or could
   it illustrate any tech article?
5. Shrunk to card size (about 400 px wide), is it still clear and uncluttered?
6. Cropped to 16:10 from the top, and to 16:9 from the centre, is anything
   important cut off?
7. Does it look polished and intentional, with no AI artefacts (warped
   geometry, mushy edges, odd reflections)?

## Step 4: Wire it in and verify

1. Add to the post's front matter:
   ```yaml
   featuredImage:
     src: "@/assets/blog/core-web-vitals-thumbnail.jpg"
     alt: "<a plain description of what the final image shows>"
   ```
2. Rebuild and check it in place: the homepage "Latest Articles" card, the
   `/blog` card and the post page hero. Confirm it sits well next to the other
   two cards.
3. Report back with the final prompt you used, how many rounds it took, what
   you changed between rounds, and screenshots of the card and post page.

## Companion thumbnail refresh

The user subsequently requested matching replacements for the speed and llms
posts while preserving their topic components. Both were generated in one round
each with built-in imagegen, using the original as the content reference and the
approved Core Web Vitals image as the theme reference. Both are 1536 × 1024.
Existing asset paths were replaced and the posts received descriptive alt text.
Build passed. Visually verified the matching homepage cards and both article
heroes; headings and diagrams survive the 16:10 and 16:9 crops. Current set
screenshot: `/tmp/webmaxxers-thumbnail-evidence/matching-set.png`.

### Website Speed prompt

Redesign image 1, the Website Speed thumbnail, using image 2 solely as the exact visual theme reference. Generate 1536x1024 landscape 3:2. Preserve image 1's central topic components: a large speedometer in front of a simplified webpage, plus a performance score panel. Replace its cyan neon, orange streaks, and white pasted screenshot with the image 2 premium black #080808 starfield, polished silver bevels, dark inset panels, neutral white studio reflections, subtle reflective dark floor, and restrained #5e76f6 blue accents. Make a cohesive editorial 3D infographic matching image 2. Large heading 'Website Speed' centered at y=200. Under it a silver-rimmed dark speedometer with clean evenly spaced tick marks, no tick numbers, a silver needle pointing upper right, a short blue arc. Behind the dial one dark silver-rimmed webpage with broad simple silver content bars. To the left, a neatly integrated smaller dark silver-rimmed score panel with a blue circular ring containing exact large white text '100', underneath exact text 'Performance', and small text 'Example score' so this is illustrative, not a claim. Keep the score panel comfortably large and readable. Entire important composition INCLUDING HEADING fits inside x=180..1356 and y=190..810; broad safe margins at top and bottom for crops. No other text or microcopy. No green, cyan, orange, colored light cast, or excessive glow. Preserve the original speed/performance concept but adopt the refined metallic theme of image 2. Clear at 400px wide.

### AI-Friendly Websites prompt

Redesign image 1, the llms.txt infographic, using image 2 solely as the exact visual theme reference. Output 1536x1024 landscape 3:2. Keep the topic-bearing elements of image 1: two primary document panels titled exactly 'llms.txt' and 'llms-full.txt'; two smaller supporting document tiles titled 'robots.txt' and 'sitemap.xml'; a simple webpage diagram connected to the main documents; clear AI-readable structure and context. Replace thin cyan-neon wireframes and tiny dense copy with polished silver beveled frames, black inset faces, neutral studio reflections, spare #5e76f6 blue connection lines, near-black #080808 starfield and subtle dark reflective floor matching image 2. Cohesive premium editorial 3D infographic, broad clear typography readable at thumbnail size. Heading exactly 'AI-Friendly Websites', centered at y=195, comparable to heading size in image 2. Main composition under heading: small robots.txt and sitemap.xml tiles on left stacked vertically with silver robot and hierarchy icons; two dominant tall dark silver-rimmed document panels side by side in middle. llms.txt panel has a large silver document icon, exact subheading 'Site guide', then section labels 'Key pages' and 'Context' plus broad silver placeholder lines. llms-full.txt panel has large silver document icon, exact subheading 'Full content', then section labels 'Services' and 'Documentation' plus broad silver placeholder lines. On right a slightly smaller polished dark browser panel with silver mountain image thumbnail, two silver content bars and a small blue button. Thin blue branching connectors join the central documents to the website. Small caption 'Clear structure for AI' below the right panel. Do not depict the supporting files as converting into the llms files; simple grouping is enough. All meaningful text and geometry MUST lie within x=120..1416 and y=180..820 with generous empty black starfield margins above/below to survive cropping. Exact labels as specified, no other text, no microcopy, no dates, no promises of rankings, no neon cyan or green, no sprawling network mesh. Preserve most of the original information architecture but simplify it into a legible, polished thumbnail matching the other reference.

## Initial thumbnail (superseded)

Generated with the built-in image generation tool in one round; no prompt
revisions. Saved as the specified 1536 × 1024 JPEG (84,218 bytes) and wired into
the post's featuredImage with descriptive alt text.

Brand study: near-black #080808, white-silver metal, crisp bevels, neutral studio
reflections, tiny white stars, and sparing #5e76f6 accents. Three concepts were
considered: interlocking blocks, three distinct metric sculptures, and three
equal pillars supporting a level plane. The pillars were selected for a clear
small-card silhouette and a simple three-part foundation metaphor.

### Final prompt

Create a premium editorial 3D blog cover, 1536 × 1024, landscape 3:2. One sculptural object: exactly three equally sized polished white-silver metal pillars, evenly spaced left to right, supporting one perfectly level thin rectangular metal plane. Show all three supports clearly in a restrained slightly elevated three-quarter view. Crisp machined bevels, smooth broad faces, low-roughness metal with clearcoat, soft sweeping neutral-white studio reflections, bright silver edges and dark neutral reflections. The sculpture represents three equally important measures supporting one stable website experience. Near-black #080808 background with a sparse delicate field of tiny white stars, no nebula or horizon. A very fine #5e76f6 blue inset along the front edge of the upper plane is the only color accent; no colored light spill. Center the complete sculpture within the middle 60% of image height and middle 75% of width, generous dark breathing room. Calm, premium, architectural, intentional; clear at 400 pixels wide. No text, letters, numbers, logos, symbols, gauges, speedometers, screens, charts, dashboards, fake UI, extra objects, neon glow, colored casts, warped geometry, or busy detail.

### Verification

Both builds passed. Inspected the static build in native Chrome: homepage hero
and article cards before generation, then the homepage Latest Articles cards,
/blog listing, and article hero with the final image. The three pillars stay
distinct at the homepage's approximately 320 px card width. The top-anchored
16:10 and centered 16:9 crops preserve the entire sculpture. The monochrome
metal and starfield match the site, with only a thin blue accent. No text,
pseudo-UI, stray colors, or visible malformed geometry. The image conveys the
three foundations metaphor rather than labeling the individual metrics.

Requested screenshot evidence is saved outside the site at
`/tmp/webmaxxers-thumbnail-evidence/{homepage,blog,post}.png`.

## Descriptive revision

User requested a more descriptive illustration like the neighboring thumbnails,
while retaining the same theme. This supersedes the original no-text/no-UI
constraint: the replacement uses short accurate labels and illustrative webpage
diagrams for loading, responsiveness, and stability. The original pillar image
and screenshots above are superseded.

Two built-in imagegen rounds: generated the three labeled panels, then reduced
the composition to preserve the title and panels in both crops and neutralized
the blue floor reflections. Replaced the original JPEG and updated alt text.

Verified the rebuilt homepage card and centered article hero visually in Chrome.
All seven labels are correct and remain within the crops. Final JPEG: 1536 × 1024,
163,483 bytes. Build passed. Revised homepage screenshot:
`/tmp/webmaxxers-thumbnail-evidence/homepage-v2.png`.

### Generation prompt

Create a finished premium editorial infographic blog thumbnail, 1536 x 1024 pixels, 3:2 landscape. Topic: Core Web Vitals explained simply to business owners. Keep a refined Webmaxxers theme: near-black #080808, sparse tiny white stars, polished white-silver metal beveled edges and neutral studio reflections, restrained periwinkle blue #5e76f6 accents. This must communicate the topic directly, not be an abstract sculpture.

Composition: a cohesive group of THREE large illustrative panels arranged horizontally, nearly front-facing with subtle 3D depth. All important content lies within x=110..1426 and y=200..820 so it survives centered 16:9 and top-anchored 16:10 crops. Above the panels, within this safe area, a clean large white sans-serif heading reads exactly "Core Web Vitals". Three panels have clear large white labels "LCP", "INP", "CLS", one per panel, and smaller but legible plain-language labels respectively "Loading", "Responsiveness", "Stability".

Left panel LCP: simplified webpage diagram with one LARGE image area depicting silver mountain silhouettes and a tiny blue sun, plus two broad neutral horizontal content bars below. Along bottom of illustration a mostly filled thin blue loading progress track, unmistakably a page loading.
Middle panel INP: large polished silver mouse cursor visibly pressing a small blue rectangular button, with two restrained concentric click ripple arcs at the cursor tip. Behind it a spare dark webpage outline. Clear click-to-response metaphor.
Right panel CLS: a simplified webpage with three solid rectangular content blocks perfectly aligned inside fine fixed silver guide corners. A faint offset outline and small vertical double arrow beside the blocks shows layout movement being contained; solid blocks remain neatly aligned. Clear spatial stability metaphor.

Make the diagrams simple and large enough to read at 400px thumbnail width. Exact text only: "Core Web Vitals", "LCP", "Loading", "INP", "Responsiveness", "CLS", "Stability". No other text, no microcopy, no numeric performance scores, no logos, no speedometer. No rainbow colors, green, cyan, purple casts, excessive neon, hologram clutter, busy circuitry, or photographic elements. The dominant look is black and silver with small deliberate blue accents. Sharp coherent geometry, professional typography, polished intentional infographic, not a screenshot of a real analytics product.

### Crop-safety revision prompt

Edit this thumbnail only to fix crop safety. Preserve the exact three-panel design, all seven correctly spelled text labels, silver materials, black starfield and blue accents. Scale the ENTIRE foreground composition, including title and all three panels, down to 78% of its current size as one group and center it on the same 1536x1024 canvas. Extend the existing dark starfield background naturally around it. Top of title must be at y=180 or below; bottom of panels must be at y=820 or above. Keep title fully legible and do not change or add text. Reduce the blue floor reflections to neutral silver-black. No other design changes.

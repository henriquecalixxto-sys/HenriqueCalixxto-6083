# Calixto Agency — Design System

## Brand
Professional Document Solutions — Certified Translation, Notary Public, Apostille, Immigration Document Assistance. Connecticut, USA. Positioning: private bank / white-shoe law firm, not a startup.

Logo: gold ring-shaped "C" wrapping a classical Greek column, paired with serif wordmark "CALIXTO" (white) + "AGENCY" (gold), tracked letter-spacing, thin gold rule dividers.
- `/packages/web/public/brand/logo-card.png` — full lockup on black card (use in footer / dark sections)
- `/packages/web/public/brand/icon-mark_*.png` — isolated icon mark, transparent (use in navbar, favicon, loading state)

## Colors (CSS variables, no gradients, no bright colors)
```
--color-black:      #111111   (primary text / dark sections)
--color-gold:        #C9A227   (accent, CTAs, dividers, icon)
--color-gold-light:  #E4C766   (hover/highlight)
--color-navy:        #0F1F38   (secondary dark surface)
--color-gray:        #4A4A4A   (secondary text)
--color-gray-light:  #8A8A8A   (muted text)
--color-white:       #FFFFFF
--color-cream:       #FAF8F4   (page background, warmer than pure white)
--color-border:      #E4E0D8   (hairline borders)
```

## Typography
- Display / Headings: **Cinzel** (Google Fonts) — all-caps or small-caps for section labels & H1/H2
- Secondary headings / subtitles: **Cormorant Garamond** italic — elegant accent lines
- Body: **PT Serif** (Cambria substitute, serif, comfortable reading, widely available on Google Fonts)
- Letter-spacing: generous tracking on uppercase labels (0.15–0.25em)
- Large H1 (56–72px desktop), generous line-height (1.5+) on body

## Layout & Spacing
- Max content width 1200px, generous white space (cream background), section padding 120–160px desktop / 64px mobile
- Thin 1px gold hairline dividers between sections, not heavy borders
- Cards: no heavy rounded corners (2–4px radius max), thin border, subtle shadow only on hover
- Grid-based, symmetric, restrained — this is a law-firm site, not a playful startup

## Motion
- Single orchestrated fade/slide-up on scroll per section (staggered children), Motion (framer-motion) library
- No bouncy easing — ease-out, 400–600ms
- Sticky navbar that condenses on scroll (shrinks logo, adds bg blur + hairline bottom border)
- Subtle hover states only: underline grow, gold color shift, 1px lift

## Components
- Navbar: transparent over hero, solid cream+blur on scroll, icon mark + wordmark, gold "Request a Quote" outline button
- Buttons: rectangular, no rounding, gold border transitioning to gold fill on hover for primary; solid black for secondary
- Service cards: image/icon top, Cinzel small caps title, PT Serif description, thin gold underline, "Learn More →" link
- Timeline (How It Works): vertical on mobile, horizontal with connecting gold line on desktop, numbered circles
- Testimonial carousel: single quote at a time, large Cormorant Garamond italic quote, gold quotation mark, client name in small caps
- Footer: navy background, white/gold text, 4-column layout, logo lockup, disclaimer line in small gray text

## Disclaimer (must appear in footer of every page)
"Calixto Agency provides document services only and does not provide legal representation or legal advice."

## Roles / Access
- Public marketing site — no auth required
- Client Portal (`/portal/*`) — authenticated users, role `client` (default)
- Admin Dashboard (`/admin/*`) — authenticated users, role `admin`
- Auth: email/password + Google (Runable managed auth)

## Mobile App (Expo)
Client-facing companion app mirroring the portal: sign in, dashboard (order status), upload documents, request a quote, contact/messages. Same color/typography language (Cinzel/PT Serif via expo-font), cream background, gold accents.

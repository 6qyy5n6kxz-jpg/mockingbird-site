# Mockingbird Static Site

A fast, mobile-first static site for the Mockingbird restaurant and bar. Built with plain HTML/CSS/JS and JSON data so updates can be made without touching markup.

## Quick start
1) Open the project in VS Code or your editor of choice.
2) Use a local static server (e.g., the VS Code Live Server extension) and open `index.html`.
3) Edits are instant—no build step or npm install required.

## Editing guide (JSON only)
All live content is stored in `/data`. Update these files and refresh:
- `data/site.json`: Name, address, phone, email, hours, social links, hero/gallery image filenames, featured items, and announcement bar toggle/message.
- `data/menu.json`: Categories and menu items. Each item supports `name`, `description`, and optional `price`.
- `data/specials.json`: `weekOf` (Monday date) and `items` list with `name`, `description`, optional `pairing`, and optional `price`.
- `data/events.json`: Array of events with `date` (ISO string), `title`, `description`, `price`, and optional `payment_link_url` (Stripe link for tickets). Remove past dates to hide.
- `data/payments.json`: Stripe Payment Links for gift cards, private-party deposits, and wine club tiers. Replace placeholders with live Stripe URLs.

### Updating weekly specials
1) Open `data/specials.json`.
2) Set `weekOf` to the current Monday (YYYY-MM-DD).
3) Edit the `items` array. Include `pairing` if you want the badge to show.
4) Save and refresh the `/specials/` page.

### Updating events
1) Open `data/events.json`.
2) Add or edit event objects. Set `payment_link_url` to a Stripe link for ticketed events; leave blank to show an email RSVP button.
3) Remove past events to hide them. The page auto-sorts upcoming dates.

## Page map
- `/` – Home with hero, featured items, specials/events previews, and hours/location.
- `/menu/` – Menu rendered from `data/menu.json` with a PDF placeholder link.
- `/specials/` – Weekly specials from `data/specials.json`.
- `/events/` – Upcoming events with ticket/RSVP actions.
- `/private-parties/` – Inquiry form with copy-to-clipboard email helper and Stripe deposit options.
- `/wine-club/` – Pickup-only tiers with Stripe links and policies.
- `/gift-cards/` – Gift card purchase buttons tied to Stripe Payment Links.
- `/contact/` – Hours, address, map link, phone/email/social, and a contact form.
- `404.html` – GitHub Pages 404 fallback.

## Stripe links
Paste live Payment Link URLs into `data/payments.json`. Buttons across pages automatically use these values (gift cards, deposits, wine club, and ticketed events).

## Assets
Place hero/gallery images in `/assets/images` and reference the filenames in `data/site.json`. SVG placeholders are included to start.

## Deploying to GitHub Pages
1) Commit and push the repository to GitHub.
2) In the repo settings, enable GitHub Pages with the branch containing these files (e.g., `main`) and root folder.
3) GitHub Pages will serve the static files directly; no build step required.

## Accessibility & performance
- Semantic HTML, keyboard navigable menus/buttons, and focus outlines preserved.
- Lazy-loaded images with width/height set.
- System fonts, minimal JavaScript, and no external dependencies for fast loads.

## Updating photos
- Place production images in `assets/images/` and reference them in `data/site.json` under the `images` object (`hero`, `interior1-3`, `ogImage`).
- Recommended sizes: hero ~2000px wide JPG/WebP; interior shots ~1400px wide. Keep files optimized (<400KB when possible).
- Replace filenames in `data/site.json` (e.g., `assets/images/hero.jpg`) and keep the same keys for easy swaps.
- Checklist: set descriptive filenames, export to WebP or optimized JPG, and keep aspect ratios similar to placeholders to minimize layout shift.
- Provided filenames expected: `hero.jpg`, `interior1.jpg`, `interior2.jpg`, `interior3.jpg`, `food1.jpg`, `food2.jpg`, `food3.jpg`, `bar1.jpg`, `og.jpg`. Update `data/site.json` to match if you swap files.
- Export settings: JPG/WebP, ~75–85% quality, resize hero to ~2000px wide, interior/food/bar to ~1400px wide, and keep each under ~400KB when possible.
- Social sharing: `og.jpg` is used for OpenGraph/Twitter cards—replace it in `assets/images/` and `data/site.json` when you add a new image.

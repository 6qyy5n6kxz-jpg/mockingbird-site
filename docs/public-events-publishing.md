# Command Center event publishing

The website can read owner-approved Mockingbird events from Command Center
without a Git commit for each event. Both the homepage preview and `/events/`
use the same feed. Static HTML, styling and the other JSON content stay in place.

## One-time rollout

1. Merge/apply the Command Center public-content migration and deploy its
   `mockingbird-public-content` Edge Function. Its JWT verification is intentionally
   disabled; the function uses the anonymous database role for a fixed public RPC.
2. Open **Mockingbird Operations → Public Events**. Enter the upcoming calendar,
   save each draft, preview, mark reviewed, and explicitly publish. Nothing is
   imported or published automatically.
3. Copy the feed URL shown under **Website connection setup**. In
   `data/public-content.json`, set `events_endpoint` to that URL and `enabled`
   to `true`. No keys, tokens or private configuration belong in this file.
4. Deploy the website and check both homepage and events page. Check a published
   event, withdraw it in Command Center, and confirm it disappears on reload.

The default is `enabled:false`, which keeps the existing JSON calendar until
the replacement feed/calendar is ready. Once enabled, a valid empty feed shows
no upcoming events; an API/configuration failure shows unavailable. It never
falls back to old JSON events, because those could include withdrawn events.
Requests omit credentials and bypass caching; this phase refreshes on page load,
not continuously in an already-open tab.

## Owner workflow and limits

Use a separate event occurrence for each music night, trivia session, book club,
or other gathering. Save → preview → review → publish. Editing a published event
leaves the approved copy live until republished. Withdraw/archive removes it;
saving visibility as private also immediately withdraws it. Private notes,
costs, staff, sales, payroll and attendee data never enter the feed.

The first phase supports plain text, one HTTPS image, admission text, venue area,
and one external reservation/ticket/details link. Rich fundraiser payment-choice
cards retain their original behavior in legacy mode; migrate those workflows
separately before switching an affected upcoming calendar. Do not copy customer
records or create duplicate payments in the website CMS.

Times display in America/New_York regardless of the visitor's timezone, with
ongoing events retained until their end. The feed is bounded to 500 upcoming or
ongoing events within one year. Published content uses DOM text rather than HTML
interpolation. Image failures do not hide the rest of the card.

## Checks

Run `node --test tests/public-events.test.cjs`, `node --check js/main.js`, and
`node --check js/public-events.js`. The workflow runs these without installing
production dependencies. Tests cover enabled/disabled mode, errors, empty feeds,
staleness, ongoing events, safe text/URLs, Eastern DST and both card variants.
The Command Center PR provides transactional database lifecycle/security checks.

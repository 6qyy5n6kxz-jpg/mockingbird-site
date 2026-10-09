# Weekly specials from Mockingbird Operations

The website's homepage, Specials page, and Menu use one approved feed when `specials_enabled` is true in `data/public-content.json`. The existing `data/specials.json` is the temporary source while the flag is false. The events flag is independent.

## Rollout

1. Merge and deploy the Command Center change first. Apply its Supabase migration and deploy `mockingbird-public-specials` to the same Supabase project as public events.
2. Open Smart Weekly Menu, review the customer name and description and explicitly mark V/GF claims for **each of the five** slots. Save each slot, review the POS rollover, then Publish Week. Confirm the success message says “Approved website snapshot updated.”
3. Verify a GET to `https://krgvotkqeguvfiowammp.supabase.co/functions/v1/mockingbird-public-specials` returns `schema_version: 1`, five items, the approved prices, and no recipes or costs. The endpoint is public and needs no credentials.
4. Merge the website change. Set `specials_enabled` to `true` in `data/public-content.json` and deploy the website. Verify the homepage, Specials, and Menu on mobile and desktop. This flag is the activation switch and defaults to false in the integration PR.

The published service period is Thursday through Saturday of the selected Monday week in America/New_York. A successful subsequent publish replaces the active five-item snapshot. Older publications remain in the database for history. Once the current week has expired, the feed returns an empty list; the site hides its old weekly menu rows. API failures also hide old rows and show an availability message. No automatic dietary classification or private recipe, inventory, or cost data is sent to the site.

To pause the feed, set `specials_enabled` to `false`. Before doing so, review or clear `data/specials.json`, since that flag restores its static content.

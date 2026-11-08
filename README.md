# Natural Products Online

A lightweight research-resource portal with a modern public page and a protected
content studio. Node.js + Express, server-rendered HTML, SQLite, and local image
uploads. No PHP, client-side application framework, database server, or build step.

## Requirements

- Node.js 24.6 or newer (the implementation uses built-in `node:sqlite`; Node
  24.6 labels this API experimental and prints a warning).
- A persistent disk and a continuously running Node.js process.
- HTTPS in production, normally provided by a reverse proxy.
- One application instance. SQLite and the in-memory login limiter are not
  configured for multi-instance deployments or network filesystems.

## Local setup

```sh
npm ci
npm run setup
npm run admin -- editor
npm start
```

The admin command prompts for a password with hidden input and confirmation.
Use a unique password of 14–200 characters. There is **no default account or
password**. Noninteractive provisioning also accepts a password on standard
input, for example from a secret manager; do not put it in command arguments.

Visit `http://localhost:3000` and `http://localhost:3000/admin`.
`npm run setup` creates a private, ignored `.env` with a random session secret;
it refuses to overwrite an existing file.

Imported project logos, the original Natural Products Online identity, and the
Steinbeck Group footer logo are
included under `public/logos/`. To refresh them from the original portal and
nmrXiv's official website, run `npm run import-logos`. To refresh selected logos,
use `npm run import-logos -- natural-products nmrxiv steinbeck-group`. This migration-only command
requires network access; normal operation does not fetch logos or other resources
from the WordPress server. Review project descriptions, categorization, logo
permissions, and contact information with the maintainers before launch.
Some descriptions are deliberately general where project scope needs confirmation.

On startup, a one-time content migration changes the original default hero title
to **Natural Products Online**, moves Watermelon into Databases, and adds nmrXiv
with its locally stored official logo. Custom hero titles and existing nmrXiv
entries are preserved; other resource details are not reset. Later admin edits
are not reapplied or overwritten on restart. The headline has a short, one-shot
typewriter-style reveal with a cursor following the revealed text across line
breaks. It respects reduced-motion preferences and keeps its
full text available to assistive technology.
The original portal logo follows the hero headline with a brief, one-time
entrance and gentle tilt after the typing completes; reduced-motion mode shows
the logo immediately without animation.

## Docker deployment

A multi-stage `Dockerfile` (Node 24 Alpine, non-root, healthcheck on `/health`)
and a `docker-compose.yml` that builds it directly are included.

On the server, copy the project, then create a `.env` next to
`docker-compose.yml`:

```
SITE_ORIGIN=https://your-domain.example
SESSION_SECRET=<output of: openssl rand -hex 48>
TRUST_PROXY=1
```

Then:

```bash
docker compose up -d --build
docker compose exec app node scripts/admin.js editor   # create an admin user
```

The container serves HTTP on port 80 (published as `80:80`); put HTTPS in front
of it (production mode requires an `https://` origin and secure cookies). The database and uploaded
logos live in the `np-data` volume. To update, copy the new files and run
`docker compose up -d --build` again. Back up by mounting a host directory for
the output (backups must be outside the data directory):
`docker compose run --rm -v "$PWD/backups:/backups" app node scripts/backup.js /backups`.

## Everyday editing

1. Sign in at `/admin`.
2. Select **Add resource** or **Edit** beside a resource.
3. Update its name, website, category, description, display order, or visibility.
4. Save. The change is immediately visible to visitors on their next page load.
5. Upload a logo separately on the resource editor. Logo uploads publish immediately
   and reload the editor; save other text changes **before** uploading.

Lower display-order numbers come first; ties use creation ID. Featured is a
visual badge, not a separate sort order. Uncheck Published to hide a resource
without deleting it. Page headlines, introductory text, about text, contact
details, GitHub/group URLs, and legal links can be changed in the dashboard.
Text is plain text, not HTML. Categories and structural design changes are code
changes rather than CMS settings.

Logo uploads accept single-frame PNG, JPEG, or WebP up to 2 MB / 16 megapixels.
They are decoded, resized to fit 800×400, stripped of metadata by re-encoding,
and saved as uniquely named WebP files. SVG, GIF, and animated images are not
accepted. JavaScript is needed only for filters, upload requests, and an
additional deletion confirmation; ordinary text editing and public links work
without it.

Each resource and page-content record has a revision number. If another tab or
editor has saved first, a stale save is rejected rather than overwriting changes.
An error page explicitly explains the conflict. Copy any unsaved text before
reloading. Resource validation errors preserve the entered resource fields;
page-content validation errors currently show an error page (use browser Back
to recover the form).

Public responses use `Cache-Control: no-store`; do not override this with CDN or
reverse-proxy HTML caching. Already-open visitor pages do not update in real
time: reload to see saved changes. Code/design changes still require updating
the application and restarting it; routine content updates do not.

## Configuration

| Variable         | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `NODE_ENV`       | `production` enables HTTPS-only session cookies and HSTS                  |
| `HOST`           | Listening interface; defaults to `127.0.0.1`                              |
| `PORT`           | Listening port; defaults to `3000`                                        |
| `SITE_ORIGIN`    | Exact public origin, no trailing slash; HTTPS required in production      |
| `DATA_DIR`       | Persistent database/uploads directory, outside the publicly served folder |
| `SESSION_SECRET` | At least 48 characters; generated by setup; keep stable and private       |
| `TRUST_PROXY`    | `0` for direct connections, `1` only behind exactly one trusted proxy     |

`data/site.sqlite` contains content, administrator password hashes, and server-side
sessions. `data/uploads/` contains administrator-uploaded logos. Keep `.env` and
the entire data directory private. Never serve the project root as a static
directory. Only `/assets` and `/uploads` are static routes.

On a reverse-proxy deployment, prevent direct public access to the application
port so clients cannot supply trusted forwarded headers. The proxy must forward
the correct client IP and scheme. Use an HTTP-to-HTTPS redirect at the proxy.
Set a proxy request-body limit of at least 3 MB to accommodate the 2 MB image plus
multipart overhead. Host the application at the domain root, not a URL subpath.

## Production installation

1. Confirm Node.js support and persistent storage with your host. Ordinary
   static-only hosting and most PHP-only shared hosting are insufficient.
2. Install application files and run `npm ci --omit=dev`.
3. Run setup and configure `.env`, including production mode and public origin.
4. Set an absolute `DATA_DIR`, such as `/var/lib/natural-products`.
5. Run `npm run admin -- editor` with the same environment/data directory.
6. Run `npm start` under the host's service manager (systemd or equivalent),
   with a dedicated non-root user and automatic restarts.
7. Configure HTTPS and reverse proxying, then verify `/health`, public content,
   sign-in, a live edit, a logo upload, and a process restart.

Health endpoint: `GET /health` checks that the database is readable and returns
`{"status":"ok"}` on success. Monitor logs and disk space. Login throttling permits
10 attempts per IP per 15 minutes; this is intentionally a single-instance
limiter and resets on process restart.

Re-run `npm run admin -- editor` to reset a forgotten password. It increments the
account version and invalidates that administrator's existing sessions. Sessions
expire after eight hours. Rotate `SESSION_SECRET` to invalidate every session.
There is no public registration or email-based password recovery.

## Backups and restoration

```sh
npm run backup -- /absolute/private/backup-directory
```

This creates a timestamped backup using SQLite's online backup API, then copies
uploads. It can run while the site is live: uploaded files are written before
being referenced by the database and old uploads are retained. The result may
include unreferenced images, but referenced uploads are not removed during the
copy. Retention of replaced/deleted logos is intentional for backup consistency
and recovery; plan periodic disk-space reviews. No automatic upload pruning is
performed.

Backups contain administrator hashes and session records: protect/encrypt them,
schedule them at the host level, and keep an off-server copy. Back up `.env`
separately in an appropriate secret store, not in source control. Backup
retention/rotation and remote copies are hosting responsibilities.

To restore:

1. Stop the application and preserve the current data directory separately.
2. Copy the backup's `site.sqlite` and `uploads/` into a **fresh** `DATA_DIR`;
   do not mix it with stale SQLite `-wal` or `-shm` files.
3. Restore the service user's permissions (directory `0700`, files readable only
   by that user). Update `DATA_DIR` if needed.
4. Rotate `SESSION_SECRET` to invalidate sessions captured in the backup.
5. Start the application and verify content, uploaded images, and sign-in.

Restoring SQLite and its matching uploads together is required.

## WordPress migration checklist

- Back up WordPress files/database and inventory all real published pages.
- Review the 12 resources (including nmrXiv) and their descriptive copy.
- Add institution-approved privacy and legal notice URLs in Content Studio.
- Obtain appropriate rights/attribution for the existing project logos and
  confirm the new code's distribution license with the owner. This project
  does not assert that project logos are covered by a code license.
- Preserve the domain; switch only the portal's routing/hosting. Do not change
  scientific-service subdomains, MX/email records, or unrelated DNS records.
- `/contact/` redirects permanently to `/#contact`. Inventory other old paths,
  inbound media URLs, and any analytics before cutover; add specific redirects
  or retained media where required.
- Test HTTPS, metadata, keyboard/mobile behavior, backup/restore, and live edits
  on staging, then cut over with a rollback plan.
- Retire WordPress only after verification and a retained backup.

## Validation

```sh
npm test
npm run check
npm run format:check
npm audit --omit=dev
```

For headless Chromium checks:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite uses disposable data and a random temporary admin password.
It checks public layouts at 1440, 768, 390, and 320 pixels, mobile admin layouts,
image loading, category filters, no-JavaScript public rendering, real login,
text/logo publishing, and automated WCAG A/AA checks via axe. Automated checks
do not replace manual assistive-technology testing. Set `SCREENSHOT_DIR` to an
output directory to save desktop/mobile public and desktop admin screenshots.

Integration tests use isolated temporary SQLite databases and cover public
rendering, local logos, auth, sessions, CSRF, login throttling, content validation,
HTML escaping, create/edit/hide/delete/order, live page updates, upload limits,
revision conflicts, persistence across restart, secure production cookies,
and backup restoration. No test writes to the configured live data directory.

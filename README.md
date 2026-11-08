# Natural Products Online

Landing page for the open resources of the
[Steinbeck Group](https://cheminf.uni-jena.de/) (COCONUT, LOTUS, DECIMER, and
more), with a small admin area for editing content.

## What's inside

- **Public page:** hero with animated 2D molecules (coordinates generated with
  RDKit), resource cards with logos and short descriptions, contact footer.
- **Admin ("Content studio") at `/admin`:** add, edit, reorder, hide or delete
  resources, upload logos, and edit page text and contact details. Changes go
  live immediately.
- **Stack:** Node.js 24 + Express, server-rendered EJS, SQLite (built-in
  `node:sqlite`), no build step and no separate database server.
- **Docker:** a small `Dockerfile` and `docker-compose.yml` for deployment.

```
src/       server, database, content defaults
views/     EJS templates (public page, admin)
public/    CSS, JS, logos, molecule data
scripts/   admin-user and backup helpers
test/      automated tests (npm test)
```

## Run locally

Requires Node.js 24.6 or newer.

```bash
npm ci
npm run setup               # creates .env with a random session secret
npm run admin -- editor     # creates an admin user (asks for a password)
npm run dev                 # http://localhost:3000, admin at /admin
```

Run the tests with `npm test`.

## Deploy on an Ubuntu server

The app runs in Docker. It needs HTTPS in front of it (the admin login uses
secure cookies), so these steps use Caddy, which gets certificates
automatically. Point your domain's DNS at the server first.

**1. Install Docker and Caddy**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER        # then log out and back in
sudo apt install -y caddy
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

**2. Get the code**

```bash
sudo git clone https://github.com/Steinbeck-Lab/np-landing-page.git /opt/np-landing-page
sudo chown -R $USER /opt/np-landing-page
cd /opt/np-landing-page
```

**3. Configure**

```bash
cat > .env <<EOF
SITE_ORIGIN=https://your-domain.example
SESSION_SECRET=$(openssl rand -hex 48)
TRUST_PROXY=1
EOF
chmod 600 .env
```

`SITE_ORIGIN` is the exact public `https://` address, with no trailing slash.

**4. Put the app behind Caddy.** Caddy uses ports 80/443, so publish the app on
a local port instead: in `docker-compose.yml`, change `"80:80"` to
`"127.0.0.1:8080:80"`. Then set `/etc/caddy/Caddyfile` to:

```
your-domain.example {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
```

**5. Start it**

```bash
docker compose up -d --build
docker compose ps                         # wait for "healthy"
curl http://127.0.0.1:8080/health         # {"status":"ok"}
```

**6. Create the admin account**

```bash
docker compose exec app node scripts/admin.js editor
```

Pick a username (letters, numbers, `.` `_` `-`) and a password of at least 14
characters, then sign in at `https://your-domain.example/admin/login`. Running
the command again for the same username resets that password.

## Operate

| Task    | Command                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Update  | `git pull && docker compose up -d --build`                                                                   |
| Logs    | `docker compose logs -f app`                                                                                 |
| Restart | `docker compose restart app`                                                                                 |
| Back up | `mkdir -p backups && docker compose run --rm -v "$PWD/backups:/backups" app node scripts/backup.js /backups` |

The database and uploaded logos live in the `np-data` Docker volume, so they
survive updates and restarts. A backup contains admin password hashes, so keep
it private.

## Configuration

| Variable         | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `SITE_ORIGIN`    | Public origin; must be `https://` in production                    |
| `SESSION_SECRET` | At least 48 random characters; keep it stable and private          |
| `TRUST_PROXY`    | `1` behind exactly one reverse proxy, otherwise `0`                |
| `PORT` / `HOST`  | Listen port and interface (the Docker image uses `80` / `0.0.0.0`) |
| `DATA_DIR`       | Where the database and uploads are stored (`/data` in Docker)      |

Host the app at the domain root, run a single instance, and allow request
bodies of at least 3 MB at the proxy (logo uploads are limited to 2 MB).

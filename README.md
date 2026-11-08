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

## Run locally

Requires Node.js 24.6 or newer.

```bash
npm ci
npm run setup               # creates .env with a random session secret
npm run admin -- editor     # creates an admin user (asks for a password)
npm run dev                 # http://localhost:3000, admin at /admin
```

Run the tests with `npm test`.

## Maintained by

[Steinbeck group](https://cheminf.uni-jena.de) at the [Friedrich Schiller University](https://www.uni-jena.de/en/) Jena, Germany.

The code for this web application is released under the [MIT license](https://opensource.org/licenses/MIT). Copyright © CC-BY-SA 2024

<p align="center">
  <a href="https://cheminf.uni-jena.de/" target="_blank">
    <img src="https://github.com/Kohulan/DECIMER-Image-to-SMILES/blob/master/assets/CheminfGit.png" width="400" alt="cheminf Logo">
  </a>
</p>

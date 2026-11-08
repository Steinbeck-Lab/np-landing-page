# Implementation plan

## Goal and scope

Replace the WordPress portal with a single Node.js application: a responsive,
accessible scientific-resource directory and a protected browser-based content
studio. Routine edits must go live on Save without a build, deployment, or
restart. Scientific applications linked from the portal stay unchanged.

## Implementation sequence

1. **Workspace and architecture**
   - Inspect the project and runtime.
   - Choose Express, server-rendered EJS, plain CSS, and built-in SQLite.
   - Define configuration and persistent storage boundaries.
2. **Content persistence**
   - Add versioned schema initialization and seed the 11 portal resources.
   - Import optimized logos locally.
   - Implement validated edits, visibility, ordering, and revision conflicts.
3. **Public redesign**
   - Compact identity/navigation, concise hero, categorized resource cards.
   - About, contact, footer, legal links, metadata, and legacy contact redirect.
   - Responsive layout, semantic headings, focus styles, reduced-motion support.
4. **Administrator access**
   - Provision accounts without default credentials.
   - Password hashing, SQLite-backed sessions, login throttling, CSRF, HTTPS cookies.
5. **Content Studio**
   - Resource creation/editing/deletion and publishing controls.
   - Separate validated image upload and logo removal.
   - Editable page copy, contact information, and footer URLs.
6. **Verification**
   - Integration tests for real HTTP/database behavior and immediate updates.
   - Browser checks at desktop/mobile sizes, filters, and admin editing.
   - Verify process restart persistence and backup restoration.
7. **Operations and handover**
   - Local setup, production hosting, configuration, backup/restore documentation.
   - Keep production cutover and institutional content approval explicit.

## Release checklist

- [x] Project setup and configuration
- [x] Persistent SQLite content and local logos
- [x] Responsive public redesign
- [x] Protected administration
- [x] Live resource, page-content, and logo editing
- [x] Integration and browser verification complete
- [x] Installation, hosting, backup, and restoration documentation
- [ ] Owner review of descriptions, logo permissions, privacy/legal links
- [ ] Confirm production hosting supports Node.js and persistent storage
- [ ] Production installation, staging approval, backup schedule, and cutover

## Acceptance criteria

- A saved name, URL, description, or logo appears on the next public page request.
- No PHP, WordPress, database server, or frontend build is required.
- Authentication gates every write and errors are explicit.
- Invalid uploads, unsafe URL schemes, stale saves, and forged requests fail safely.
- Stored content and sessions survive process restarts.
- Backups restore the content database and matching uploaded files.
- The public page works on narrow phones and supports keyboard navigation.

## Deliberate boundaries

One application instance, one content-editor role, fixed resource categories,
plain-text content, and no WYSIWYG page builder. No analytics, cookies for public
visitors, externally hosted fonts, always-on map embed, or scientific-service
backend changes. A content edit is immediate; structural design/code changes
still need an application update.

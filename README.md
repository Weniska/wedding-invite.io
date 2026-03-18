# Wedding RSVP starter package

## Files included
- `index.html`, public RSVP page
- `admin.html`, admin dashboard and guest manager
- `assets/js/config.js`, add your Supabase URL and anon key here
- `assets/js/supabase-client.js`
- `assets/js/auth.js`
- `assets/js/rsvp.js`
- `assets/js/guests-admin.js`
- `assets/js/admin.js`
- `sql/schema.sql`

## Setup
1. Create a Supabase project.
2. Run `sql/schema.sql` in the Supabase SQL editor.
3. In Supabase Auth, create your admin user with email and password.
4. Put your actual Supabase project URL and anon key into `assets/js/config.js`.
5. Upload these files to your hosting provider.

## Important note
The public RSVP update policy in `schema.sql` is intentionally simple so the site works quickly. For stronger protection later, move RSVP writes to a server-side endpoint or edge function.

# Deploy the demo from GitHub

Repository: <https://github.com/jakov0703/nt-art>

Astro builds the public gallery. The Atelier editor runs at
**`https://YOUR-SITE.netlify.app/admin/`** on the same domain, with one
password-protected account. Nikolina does not need a GitHub account.

## One-time setup

1. Import the repository into Netlify and select **`main`** as the production
   branch. `netlify.toml` supplies Node 24, build command `npm run build`,
   publish directory `dist`, and functions directory `netlify/functions`.
   Keep automatic Git deployments enabled.
2. Create a GitHub **fine-grained personal access token** for an account that
   can write to `jakov0703/nt-art`. Select **only this repository** and grant
   **Repository permissions → Contents: Read and write**. Metadata read
   permission is implicit. Set an expiry and renew the token before expiry.
   Its account must be allowed to commit directly to `main`; branch rules
   requiring pull requests would block the editor.
3. Add these environment variables in Netlify. Use the **Functions** scope
   (or all scopes if scope selection is unavailable) and **Production** deploy
   context. Do not expose them to untrusted deploy previews or commit secrets.

   | Variable | Value |
   | --- | --- |
   | `GITHUB_REPO` | `jakov0703/nt-art` |
   | `GITHUB_BRANCH` | `main` |
   | `GITHUB_TOKEN` | Fine-grained token from step 2 |
   | `ADMIN_USERNAME` | `admin` or your chosen username |
   | `ADMIN_PASSWORD` | Unique password of at least 16 characters |
   | `ADMIN_SESSION_SECRET` | Separate random value of at least 32 characters |

   Generate a session secret locally:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Deploy/redeploy after setting variables. Open `/admin/` and sign in. Share
   the site URL and admin credentials privately with Nikolina. Keep the
   GitHub token and session secret to yourself.

No database, Netlify Identity, build hook or extra domain is required.
Canonical links and sitemaps use Netlify's deploy URL automatically. For a
later custom domain, set `SITE_URL=https://your-domain` in **Builds** scope.

## Saving and publishing

- Uploads are converted to JPEG and committed to GitHub. Browser-readable
  photos are resized to a maximum edge of 2400 px before upload, one file per
  request. If HEIC/TIFF is too large, export a JPG smaller than 3 MB.
- Saving commits the artwork and URL registry atomically. Success appears
  only after GitHub accepts the commit. Netlify rebuilds after commits;
  uploads also create commits/builds.
- The editor sees saved changes immediately. Public changes appear after a
  successful deployment, usually a few minutes later.
- Drafts are excluded from the public gallery. They and archived works remain
  in Git: use a **private repository** if their source should be private.
  Source content can include the owner/collection field.
- Archiving moves Markdown to `atelier/arhiva-online/`. Photos stay in place
  to preserve shared images; Git history keeps earlier versions.
- Sessions last eight hours. Changing the password or session secret
  invalidates existing sessions. Sign out on shared devices.
- Conflicting edits are rejected. Copy unsaved text, reopen the work and
  reapply changes. A network/save failure leaves the form open for retry.
- After online edits, run `git pull --ff-only` before local work. Local
  `npm run atelier` still saves on this computer and does not push automatically.

## First live deployment check

1. Open the gallery and `/admin/` in a private browser window. Admin should
   require login.
2. Sign in, upload a test image, save a **draft**, refresh and sign out/in.
   The draft/image should persist in Atelier and remain absent from the gallery.
3. Add the required description and publish. Check the commit in GitHub and
   wait for Netlify's deploy to succeed; refresh the public gallery.
4. Edit and save, verify the next deployment, then archive the test work and
   verify it disappears after the final deployment.

`npm test` exercises the real handlers against an in-memory GitHub API model:
upload, create, edit, publish, archive, failed writes, conflicts, sessions and
CSRF rejection. The live check above still needs your Netlify credentials.

## Troubleshooting

- **Online Atelier not configured**: check password/secret lengths, Functions
  scope and Production context, then redeploy.
- **GitHub saving unavailable**: check token expiry, selected repository,
  Contents write permission, branch name and branch protection.
- **Saved but public page unchanged**: check Netlify's latest deploy log and
  automatic build settings. The content remains in GitHub if a build fails;
  fix the build and redeploy without re-entering everything.
- **Login rate limited**: wait a minute. The login function allows ten requests
  per minute per IP/domain using Netlify function rate limiting.

References: [Netlify Functions](https://docs.netlify.com/build/functions/configuration/),
[environment variables](https://docs.netlify.com/build/functions/environment-variables/),
[function rate limits](https://docs.netlify.com/build/functions/api/),
[GitHub reference updates](https://docs.github.com/en/rest/git/refs#update-a-reference).

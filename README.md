# Two Sons Funeral Home website

Website for Two Sons Funeral Home Ltd., Stadium Road, Bush Hall, St. Michael, Barbados. Built the same way as the Sterling Funeral Services site.

Plain HTML, CSS and JavaScript. No framework and no server. It's hosted free on GitHub Pages.

## Pages

| Page | File | Where the content comes from |
|---|---|---|
| Home | `index.html` | `pages/index.html`, plus upcoming funerals and the latest notices from `data/obituaries.json` |
| About | `about.html` | `pages/about.html` |
| Services | `services.html` | `pages/services.html` |
| Caskets | `caskets.html` | `pages/caskets.html` |
| Obituaries | `obituaries.html` + `obituaries/<slug>.html` | `data/obituaries.json` and `data/condolences.json` |
| Funerals (livestreams) | `livestreams.html` | `data/obituaries.json` |
| Testimonials | `testimonials.html` | `data/testimonials.json` |
| Pre-Planning | `pre-planning.html` | `pages/pre-planning.html` |
| Contact | `contact.html` | `pages/contact.html` |
| Get a quote | `get-a-quote.html` | `data/quotes.json` |
| Floral tributes | `flowers.html` | `data/flowers.json` |
| Gallery | `gallery.html` | `pages/gallery.html` |

**Never edit the `.html` files at the top of the folder.** The build overwrites them.
Edit `pages/` or `data/`, then run the build.

## Run the build

You need Node.js. From this folder:

```
node tools/build.js
```

It writes every page and prints anything to check (missing photos, date mistakes, samples still in).

To look at the site on your laptop, open `index.html` in Chrome.

## Add a funeral notice

1. Open `data/obituaries.json`.
2. Copy a block, then change every field. Times are Barbados time, written like `2026-10-14T13:15`.
3. `slug` is the web address: lower-case letters and dashes, e.g. `john-alleyne`.
4. Save the photo as `images/notices/<slug>.jpg`. A head-and-shoulders photo works best.
5. Run the build.
6. Commit and push. The site updates in about a minute.

**Add the notice before the funeral**, so it shows under "Upcoming funerals" on the home page.

## Publish a condolence or testimonial

Messages come to info@ by email. Nothing goes on the site by itself. See [FORMS.md](FORMS.md).

## Change a photo

Replace the file, then **run the build**. The build adds a fingerprint to every image link, so the new photo shows straight away. GitHub Pages would otherwise keep showing the old one for up to 10 minutes.

## Preview now, real domain later

The site starts as a preview on GitHub Pages. At the top of `tools/build.js`:

- `SITE` is the web address. For now it's the github.io address.
- `PREVIEW = true` shows the green "Preview" bar and tells Google not to list the site yet.

**At launch (Juwan):**
1. Delete the three `"sample": true` notices from `data/obituaries.json` and the sample condolences.
2. In `tools/build.js`: set `SITE` to `https://www.twosonsfuneralhome.com` and `PREVIEW` to `false`.
3. Add a file called `CNAME` containing `www.twosonsfuneralhome.com`.
4. Run the build, commit and push.
5. GitHub → repo **Settings → Pages → Custom domain**: `www.twosonsfuneralhome.com`, then tick **Enforce HTTPS** once it's allowed.
6. Namecheap → Advanced DNS. Add **only** these, and **keep all the email records** (MX, autodiscover, SPF, MS= TXT, DKIM, DMARC):
   - CNAME `www` → `technovabb.github.io.`
   - A `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
7. Re-read the records after saving. Send a test email to info@ to check email still works.

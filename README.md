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
| Pre-planning | `pre-planning.html` | `pages/pre-planning.html` |
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

It writes every page and prints anything to check (spellings to confirm, missing photos, pictures that are too big).
If a notice has a mistake (a wrong date, a slug used twice), it stops and says which notice. Nothing is changed until you fix it.

To look at the site on your laptop, open `index.html` in Chrome.

## Add a funeral notice

1. Open `data/obituaries.json`.
2. Copy the first block and paste it **at the top**. The newest notice goes first, as on Facebook.
3. Change every field. Delete the ones the flyer doesn't have.
4. `slug` is the web address: lower-case letters and dashes, e.g. `john-alleyne`.
5. Save the flyer as `images/notices/flyers/<slug>.jpg`.
6. Run `node tools/images.js`. It makes the small copies of the flyer.
   - The first time only, run `npm install --no-save sharp` before it.
7. Run `node tools/build.js`.
8. Commit and push. The site updates in about a minute.

**Add the notice before the funeral**, so it shows under "Upcoming funerals" on the home page.

### The fields

Times are Barbados time.

| Field | What to put | Example |
|---|---|---|
| `name` | Full name | `"John Alleyne"` |
| `aka` | Nickname, or a list | `"Johnny"` or `["Tallies", "Papi"]` |
| `age`, `born`, `died` | As on the flyer | `84`, `"1941-07-09"` |
| `late_of` | Where they lived | `"Bush Hall, St. Michael"` |
| `service` | Date and time on the notice | `"2026-10-14T13:15"` (no time? `"2026-10-14"`) |
| `service_start` | What happens at that time | `"Leaves the Chapel of Two Sons Funeral Home, ..."` |
| `church`, `church_time` | The church, and the time the **service** starts there | `"St. John Parish Church"`, `"3:00 p.m."` |
| `church_note`, `officiant` | Extra line under the church | `"Tributes at 9:30 a.m."` |
| `place` | Where to send people if not a church (e.g. graveside) | `"Christ Church Cemetery, Christ Church"` |
| `interment` | Where, or `"Follows the service"` | |
| `viewing_start`, `viewing_end`, `viewing_place` | The viewing (same day) | `"2026-10-13T16:00"` |
| `viewing_note` | When there is no viewing | `"There will be no viewing of the body."` |
| `flowers_by` | Latest time for flowers | `"1:00 p.m. on the day"` |
| `note` | Anything else for mourners | `"Mourning colours are optional."` |
| `livestream` | Link and who streams it | `{ "url": "https://...", "label": "KD34 Streaming Services" }` |
| `flyer_wide` | `true` if the flyer is landscape | |
| `flag` | A reminder to check something. It shows when you build. Delete it once checked. | |

**Times:** the cards, the livestream panel and the calendar file use `church_time` for the service.
The `service` time is shown as "Leaves Two Sons at ...".

**Dates pass by themselves:** each visitor's browser checks today's date.
After the funeral day, "Upcoming", "Live", "Add to calendar" and "Order flowers" disappear, and the livestream moves to "Watch a service".
Still run the build now and then so the pages match.

## Publish a condolence or testimonial

Messages come to info@ by email. Nothing goes on the site by itself. See [FORMS.md](FORMS.md).

## Change a photo

Replace the file, then **run the build**. Keep photos to about 1200 px on the long side (`node tools/images.js --shrink` does it for you). The build adds a fingerprint to every image link, so the new photo shows straight away. GitHub Pages would otherwise keep showing the old one for up to 10 minutes.

## Preview now, real domain later

The site starts as a preview on GitHub Pages. At the top of `tools/build.js`:

- `SITE` is the web address. For now it's the preview address, `https://technovabb.com/twosons-funeral-home-home`.
- `PREVIEW = true` shows the green "Preview" bar and tells Google not to list the site yet.

**At launch (Juwan):**
1. Check there are no `"sample": true` notices in `data/obituaries.json`, and fill in the yellow placeholder on the About page. The build stops if a placeholder would go live.
2. In `tools/build.js`: set `SITE` to `https://www.twosonsfuneralhome.com` and `PREVIEW` to `false`.
3. Add a file called `CNAME` containing `www.twosonsfuneralhome.com`.
4. Run the build, commit and push.
5. GitHub → repo **Settings → Pages → Custom domain**: `www.twosonsfuneralhome.com`, then tick **Enforce HTTPS** once it's allowed.
6. Namecheap → Advanced DNS. Add **only** these, and **keep all the email records** (MX, autodiscover, SPF, MS= TXT, DKIM, DMARC):
   - CNAME `www` → `technovabb.github.io.`
   - A `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
7. Re-read the records after saving. Send a test email to info@ to check email still works.

# Forms: how they work and how to finish setting them up

The website has 6 forms:
- the **condolence book** on each notice
- **Get a quote**
- **Order flowers**
- **Pre-planning**
- **Contact**
- **Feedback** (on Testimonials)

They all work the same way as on the Sterling site.

## The flow
1. A visitor fills in a form.
2. It goes to **FormSubmit** (formsubmit.co), which emails **info@twosonsfuneralhome.com**.
3. Staff read it in the info@ shared mailbox.
4. If sending fails for any reason, the visitor's email app opens with the message filled in, so **nothing is lost**.
   The page also says plainly that it could not send, and gives the email address and phone number.

**Nothing a visitor writes goes on the website by itself.** That is on purpose: an open comment box on a grieving family's page attracts spam.

## One-time activation (required)
FormSubmit won't deliver anything until info@ confirms it. **The first message is used up by the activation.**

1. On the live site, send a short test message from any form.
2. FormSubmit emails info@ asking to confirm. **Open it and click the activation link.** Check Junk too.
3. Send a second test. That one should arrive.

## Publish a condolence
1. Open `data/condolences.json`.
2. Add the message under that person's slug (the file name of their page, e.g. `obituaries/john-alleyne.html` is `john-alleyne`):

```json
"john-alleyne": [
  { "name": "Marcia", "relationship": "Neighbour", "date": "2026-10-20", "message": "He was kind to every child on the street." }
]
```

3. Run `node tools/build.js`, then commit and push.

## Publish a testimonial
Add it to `entries` in `data/testimonials.json`, then build.
**Only publish words a family actually wrote, and only with their permission.**

## Good to know
- Each form has a hidden trap field. Robots fill it in, people don't, and those messages are dropped.
- A visitor's email address is optional and is never shown on the page.
- Messages travel through FormSubmit (a third party) on the way to info@, as on the Sterling site. To change the address later, edit `FORM_ENDPOINT` and `FORM_EMAIL` at the top of `js/main.js`, and `EMAIL` at the top of `tools/build.js`. Run `node tools/build.js`, then activate the new address the same way.

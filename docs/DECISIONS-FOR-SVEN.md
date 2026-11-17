# Decisions for Sven: Here Happened rework

Answer with the number and yes/no (or one word). My recommendation comes first in each.

1. **Go live?** Once the review passes, replace the current production (https://here-happened-nu.vercel.app, which fails on every tap today because the Perplexity account is out of credits) with this rework. **Recommend: yes.**

2. **Custom domain?** Buy `herehappened.com` through Vercel for $12.03 a year (renews at $12.03) and point it at the app, so the links you post look finished. `herehappened.app` is $9.99 the first year, then $15. **Recommend: yes, herehappened.com.**

3. **Is https://here-happened.vercel.app yours?** That URL isn't in your Vercel team. It runs an old March build of this same app, and some key still pays for every tap on it. It's probably your old personal Vercel account from before the move to "Sven Pro Services". If it's yours, delete that old project there; that also frees the clean name. **Answer: yes / no / don't know.** (Recommend deleting it if it's yours.)

4. **Retire Perplexity?** The new engine doesn't use it: it reads Wikipedia and Wikidata directly, so there's no AI bill per tap. Let the out-of-credit account lapse, then delete the key from Vercel. **Recommend: yes.**

5. **Lock down the Google key (a 2-minute job only you can do)?** The key used to ship to every browser with no restrictions. The rework uses it only on the server, for reverse geocoding. In Google Cloud Console › APIs & Services › Credentials › that key: set "API restrictions" to **Geocoding API** only. Leave "Application restrictions" at None, because the server calls have no referrer. Then rotate the key at your Dec 4 security reset, since the old one sat in public JavaScript for 8 months. **Recommend: yes.**

## Answers (Sven, Nov 17, 10:35 AM ET)

1. Go live: **yes. Done.** `dev` fast-forwarded to the rework and pushed; production deployment `here-happened-6f2524wfo` went Ready at about 10:40 AM and is serving https://here-happened-nu.vercel.app (public, indexable). The previous production deployment is still in the project's history if a rollback is ever needed.
2. Domain herehappened.com: **skipped (Sven, Nov 17, after seeing the terms).** Nothing was bought. The quote was $12.03/yr, auto-renew, non-refundable. The notes below are kept in case he changes his mind. The Vercel quote is $12.03 for one year, auto-renew on, tax on top, non-refundable, charged to the team's card on file. The purchase also needs registrant contact details (name, email, phone with country code, street address) that only Sven can give. After purchase: attach it to the project, set `NEXT_PUBLIC_SITE_URL=https://herehappened.com` for Production, redeploy.
3. Old https://here-happened.vercel.app: **yes, it's Sven's, but not deletable from here.** It lives in his old personal Vercel account, which this team's CLI and connector can't see. Sven: sign in at vercel.com with the old account, open the `here-happened` project, Settings, Delete. Then the plain name is free.
4. Perplexity: **done.** `PERPLEXITY_API_KEY` removed from Vercel Production, Preview and Development and from `.env.local`. The account can lapse.
5. Google key: **waiting on Sven (2 minutes).** Google Cloud Console, APIs & Services, Credentials, open the key, set API restrictions to Geocoding API only, leave application restrictions at None (the calls are server-side with no referrer). Rotate it at the Dec 4 security reset.

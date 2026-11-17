# Decisions for Sven: Here Happened rework

Answer with the number and yes/no (or one word). My recommendation comes first in each.

1. **Go live?** Once the review passes, replace the current production (https://here-happened-nu.vercel.app, which fails on every tap today because the Perplexity account is out of credits) with this rework. **Recommend: yes.**

2. **Custom domain?** Buy `herehappened.com` through Vercel for $12.03 a year (renews at $12.03) and point it at the app, so the links you post look finished. `herehappened.app` is $9.99 the first year, then $15. **Recommend: yes, herehappened.com.**

3. **Is https://here-happened.vercel.app yours?** That URL isn't in your Vercel team. It runs an old March build of this same app, and some key still pays for every tap on it. It's probably your old personal Vercel account from before the move to "Sven Pro Services". If it's yours, delete that old project there; that also frees the clean name. **Answer: yes / no / don't know.** (Recommend deleting it if it's yours.)

4. **Retire Perplexity?** The new engine doesn't use it: it reads Wikipedia and Wikidata directly, so there's no AI bill per tap. Let the out-of-credit account lapse, then delete the key from Vercel. **Recommend: yes.**

5. **Lock down the Google key (a 2-minute job only you can do)?** The key used to ship to every browser with no restrictions. The rework uses it only on the server, for reverse geocoding. In Google Cloud Console › APIs & Services › Credentials › that key: set "API restrictions" to **Geocoding API** only. Leave "Application restrictions" at None, because the server calls have no referrer. Then rotate the key at your Dec 4 security reset, since the old one sat in public JavaScript for 8 months. **Recommend: yes.**

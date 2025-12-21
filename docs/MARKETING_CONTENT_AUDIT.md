# Marketing Content Audit

Generated: 2025-12-21T08:38:12.380Z
Target: https://fiskai.hr
Repos: /home/admin/FiskAI, /home/admin/FiskAI-next
Scope: Marketing pages only. Auth routes excluded.

## Summary
- Total marketing routes discovered: 226
- Audited routes: 210
- Excluded auth routes: 16
- Hardcoded value hits: 2648
- Language issues: 10
- Design token issues: 16
- Static broken internal links: 72

## Excluded Auth Routes
- /check-email (FiskAI)
- /forgot-password (FiskAI)
- /login (FiskAI)
- /register (FiskAI)
- /reset-password (FiskAI)
- /select-role (FiskAI)
- /verify-email (FiskAI)
- /wizard (FiskAI)
- /check-email (FiskAI-next)
- /forgot-password (FiskAI-next)
- /login (FiskAI-next)
- /register (FiskAI-next)
- /reset-password (FiskAI-next)
- /select-role (FiskAI-next)
- /verify-email (FiskAI-next)
- /wizard (FiskAI-next)

## Route Inventory
| Route | Repo | Source | File |
| --- | --- | --- | --- |
| / | FiskAI | tsx | src/app/(marketing)/page.tsx |
| / | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/page.tsx |
| /about | FiskAI | tsx | src/app/(marketing)/about/page.tsx |
| /about | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/about/page.tsx |
| /ai-data-policy | FiskAI | tsx | src/app/(marketing)/ai-data-policy/page.tsx |
| /ai-data-policy | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/ai-data-policy/page.tsx |
| /alati | FiskAI | tsx | src/app/(marketing)/alati/page.tsx |
| /alati | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/page.tsx |
| /alati/e-racun | FiskAI | tsx | src/app/(marketing)/alati/e-racun/page.tsx |
| /alati/e-racun | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/e-racun/page.tsx |
| /alati/kalendar | FiskAI | tsx | src/app/(marketing)/alati/kalendar/page.tsx |
| /alati/kalendar | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/kalendar/page.tsx |
| /alati/kalkulator-doprinosa | FiskAI | tsx | src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx |
| /alati/kalkulator-doprinosa | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx |
| /alati/kalkulator-poreza | FiskAI | tsx | src/app/(marketing)/alati/kalkulator-poreza/page.tsx |
| /alati/kalkulator-poreza | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/kalkulator-poreza/page.tsx |
| /alati/oib-validator | FiskAI | tsx | src/app/(marketing)/alati/oib-validator/page.tsx |
| /alati/oib-validator | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/oib-validator/page.tsx |
| /alati/pdv-kalkulator | FiskAI | tsx | src/app/(marketing)/alati/pdv-kalkulator/page.tsx |
| /alati/pdv-kalkulator | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/pdv-kalkulator/page.tsx |
| /alati/posd-kalkulator | FiskAI | tsx | src/app/(marketing)/alati/posd-kalkulator/page.tsx |
| /alati/posd-kalkulator | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/posd-kalkulator/page.tsx |
| /alati/uplatnice | FiskAI | tsx | src/app/(marketing)/alati/uplatnice/page.tsx |
| /alati/uplatnice | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/alati/uplatnice/page.tsx |
| /baza-znanja | FiskAI | tsx | src/app/(marketing)/baza-znanja/page.tsx |
| /baza-znanja | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/baza-znanja/page.tsx |
| /check-email | FiskAI | tsx | src/app/(marketing)/check-email/page.tsx |
| /check-email | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/check-email/page.tsx |
| /contact | FiskAI | tsx | src/app/(marketing)/contact/page.tsx |
| /contact | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/contact/page.tsx |
| /cookies | FiskAI | tsx | src/app/(marketing)/cookies/page.tsx |
| /cookies | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/cookies/page.tsx |
| /dpa | FiskAI | tsx | src/app/(marketing)/dpa/page.tsx |
| /dpa | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/dpa/page.tsx |
| /features | FiskAI | tsx | src/app/(marketing)/features/page.tsx |
| /features | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/features/page.tsx |
| /fiskalizacija | FiskAI | tsx | src/app/(marketing)/fiskalizacija/page.tsx |
| /fiskalizacija | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/fiskalizacija/page.tsx |
| /for/accountants | FiskAI | tsx | src/app/(marketing)/for/accountants/page.tsx |
| /for/accountants | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/for/accountants/page.tsx |
| /for/dooo | FiskAI | tsx | src/app/(marketing)/for/dooo/page.tsx |
| /for/dooo | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/for/dooo/page.tsx |
| /for/pausalni-obrt | FiskAI | tsx | src/app/(marketing)/for/pausalni-obrt/page.tsx |
| /for/pausalni-obrt | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/for/pausalni-obrt/page.tsx |
| /forgot-password | FiskAI | tsx | src/app/(marketing)/forgot-password/page.tsx |
| /forgot-password | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/forgot-password/page.tsx |
| /izvori | FiskAI | tsx | src/app/(marketing)/izvori/page.tsx |
| /izvori | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/izvori/page.tsx |
| /kako-da | FiskAI | tsx | src/app/(marketing)/kako-da/page.tsx |
| /kako-da | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/kako-da/page.tsx |
| /kako-da/[slug] | FiskAI | tsx | src/app/(marketing)/kako-da/[slug]/page.tsx |
| /kako-da/[slug] | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/kako-da/[slug]/page.tsx |
| /kako-da/godisnji-obracun-pausalca | FiskAI | mdx | content/kako-da/godisnji-obracun-pausalca.mdx |
| /kako-da/godisnji-obracun-pausalca | FiskAI-next | mdx | ../FiskAI-next/content/kako-da/godisnji-obracun-pausalca.mdx |
| /kako-da/ispuniti-po-sd | FiskAI | mdx | content/kako-da/ispuniti-po-sd.mdx |
| /kako-da/ispuniti-po-sd | FiskAI-next | mdx | ../FiskAI-next/content/kako-da/ispuniti-po-sd.mdx |
| /kako-da/registrirati-informacijskog-posrednika | FiskAI | mdx | content/kako-da/registrirati-informacijskog-posrednika.mdx |
| /kako-da/registrirati-informacijskog-posrednika | FiskAI-next | mdx | ../FiskAI-next/content/kako-da/registrirati-informacijskog-posrednika.mdx |
| /kako-da/uci-u-sustav-pdv | FiskAI | mdx | content/kako-da/uci-u-sustav-pdv.mdx |
| /kako-da/uci-u-sustav-pdv | FiskAI-next | mdx | ../FiskAI-next/content/kako-da/uci-u-sustav-pdv.mdx |
| /login | FiskAI | tsx | src/app/(marketing)/login/page.tsx |
| /login | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/login/page.tsx |
| /metodologija | FiskAI | tsx | src/app/(marketing)/metodologija/page.tsx |
| /metodologija | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/metodologija/page.tsx |
| /prelazak | FiskAI | tsx | src/app/(marketing)/prelazak/page.tsx |
| /prelazak | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/prelazak/page.tsx |
| /pricing | FiskAI | tsx | src/app/(marketing)/pricing/page.tsx |
| /pricing | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/pricing/page.tsx |
| /privacy | FiskAI | tsx | src/app/(marketing)/privacy/page.tsx |
| /privacy | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/privacy/page.tsx |
| /register | FiskAI | tsx | src/app/(marketing)/register/page.tsx |
| /register | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/register/page.tsx |
| /reset-password | FiskAI | tsx | src/app/(marketing)/reset-password/page.tsx |
| /reset-password | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/reset-password/page.tsx |
| /rjecnik | FiskAI | tsx | src/app/(marketing)/rjecnik/page.tsx |
| /rjecnik | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/rjecnik/page.tsx |
| /rjecnik/[pojam] | FiskAI | tsx | src/app/(marketing)/rjecnik/[pojam]/page.tsx |
| /rjecnik/[pojam] | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/rjecnik/[pojam]/page.tsx |
| /rjecnik/akontacija | FiskAI | mdx | content/rjecnik/akontacija.mdx |
| /rjecnik/akontacija | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/akontacija.mdx |
| /rjecnik/direktor | FiskAI | mdx | content/rjecnik/direktor.mdx |
| /rjecnik/direktor | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/direktor.mdx |
| /rjecnik/dobit | FiskAI | mdx | content/rjecnik/dobit.mdx |
| /rjecnik/dobit | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/dobit.mdx |
| /rjecnik/doh | FiskAI | mdx | content/rjecnik/doh.mdx |
| /rjecnik/doh | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/doh.mdx |
| /rjecnik/dohodak | FiskAI | mdx | content/rjecnik/dohodak.mdx |
| /rjecnik/dohodak | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/dohodak.mdx |
| /rjecnik/doo | FiskAI | mdx | content/rjecnik/doo.mdx |
| /rjecnik/doo | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/doo.mdx |
| /rjecnik/e-racun | FiskAI | mdx | content/rjecnik/e-racun.mdx |
| /rjecnik/e-racun | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/e-racun.mdx |
| /rjecnik/fisk-aplikacija | FiskAI | mdx | content/rjecnik/fisk-aplikacija.mdx |
| /rjecnik/fisk-aplikacija | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/fisk-aplikacija.mdx |
| /rjecnik/fiskalizacija | FiskAI | mdx | content/rjecnik/fiskalizacija.mdx |
| /rjecnik/fiskalizacija | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/fiskalizacija.mdx |
| /rjecnik/fiskalna-godina | FiskAI | mdx | content/rjecnik/fiskalna-godina.mdx |
| /rjecnik/fiskalna-godina | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/fiskalna-godina.mdx |
| /rjecnik/hgk | FiskAI | mdx | content/rjecnik/hgk.mdx |
| /rjecnik/hgk | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/hgk.mdx |
| /rjecnik/hok | FiskAI | mdx | content/rjecnik/hok.mdx |
| /rjecnik/hok | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/hok.mdx |
| /rjecnik/hzzo | FiskAI | mdx | content/rjecnik/hzzo.mdx |
| /rjecnik/hzzo | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/hzzo.mdx |
| /rjecnik/informacijski-posrednik | FiskAI | mdx | content/rjecnik/informacijski-posrednik.mdx |
| /rjecnik/informacijski-posrednik | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/informacijski-posrednik.mdx |
| /rjecnik/ira | FiskAI | mdx | content/rjecnik/ira.mdx |
| /rjecnik/ira | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/ira.mdx |
| /rjecnik/jdoo | FiskAI | mdx | content/rjecnik/jdoo.mdx |
| /rjecnik/jdoo | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/jdoo.mdx |
| /rjecnik/jir | FiskAI | mdx | content/rjecnik/jir.mdx |
| /rjecnik/jir | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/jir.mdx |
| /rjecnik/joppd | FiskAI | mdx | content/rjecnik/joppd.mdx |
| /rjecnik/joppd | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/joppd.mdx |
| /rjecnik/kpr | FiskAI | mdx | content/rjecnik/kpr.mdx |
| /rjecnik/kpr | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/kpr.mdx |
| /rjecnik/mikroeracun | FiskAI | mdx | content/rjecnik/mikroeracun.mdx |
| /rjecnik/mikroeracun | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/mikroeracun.mdx |
| /rjecnik/minimalna-osnovica | FiskAI | mdx | content/rjecnik/minimalna-osnovica.mdx |
| /rjecnik/minimalna-osnovica | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/minimalna-osnovica.mdx |
| /rjecnik/mio | FiskAI | mdx | content/rjecnik/mio.mdx |
| /rjecnik/mio | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/mio.mdx |
| /rjecnik/naknadno-fiskaliziranje | FiskAI | mdx | content/rjecnik/naknadno-fiskaliziranje.mdx |
| /rjecnik/naknadno-fiskaliziranje | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/naknadno-fiskaliziranje.mdx |
| /rjecnik/nerezident | FiskAI | mdx | content/rjecnik/nerezident.mdx |
| /rjecnik/nerezident | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/nerezident.mdx |
| /rjecnik/nkd | FiskAI | mdx | content/rjecnik/nkd.mdx |
| /rjecnik/nkd | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/nkd.mdx |
| /rjecnik/obrt | FiskAI | mdx | content/rjecnik/obrt.mdx |
| /rjecnik/obrt | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/obrt.mdx |
| /rjecnik/obrtni-registar | FiskAI | mdx | content/rjecnik/obrtni-registar.mdx |
| /rjecnik/obrtni-registar | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/obrtni-registar.mdx |
| /rjecnik/oib | FiskAI | mdx | content/rjecnik/oib.mdx |
| /rjecnik/oib | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/oib.mdx |
| /rjecnik/oib-operatera | FiskAI | mdx | content/rjecnik/oib-operatera.mdx |
| /rjecnik/oib-operatera | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/oib-operatera.mdx |
| /rjecnik/osobni-odbitak | FiskAI | mdx | content/rjecnik/osobni-odbitak.mdx |
| /rjecnik/osobni-odbitak | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/osobni-odbitak.mdx |
| /rjecnik/pausal | FiskAI | mdx | content/rjecnik/pausal.mdx |
| /rjecnik/pausal | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/pausal.mdx |
| /rjecnik/pdv | FiskAI | mdx | content/rjecnik/pdv.mdx |
| /rjecnik/pdv | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/pdv.mdx |
| /rjecnik/pdv-obrazac | FiskAI | mdx | content/rjecnik/pdv-obrazac.mdx |
| /rjecnik/pdv-obrazac | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/pdv-obrazac.mdx |
| /rjecnik/peppol | FiskAI | mdx | content/rjecnik/peppol.mdx |
| /rjecnik/peppol | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/peppol.mdx |
| /rjecnik/po-sd | FiskAI | mdx | content/rjecnik/po-sd.mdx |
| /rjecnik/po-sd | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/po-sd.mdx |
| /rjecnik/porezna-osnovica | FiskAI | mdx | content/rjecnik/porezna-osnovica.mdx |
| /rjecnik/porezna-osnovica | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/porezna-osnovica.mdx |
| /rjecnik/porezna-prijava | FiskAI | mdx | content/rjecnik/porezna-prijava.mdx |
| /rjecnik/porezna-prijava | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/porezna-prijava.mdx |
| /rjecnik/porezni-razred | FiskAI | mdx | content/rjecnik/porezni-razred.mdx |
| /rjecnik/porezni-razred | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/porezni-razred.mdx |
| /rjecnik/pos | FiskAI | mdx | content/rjecnik/pos.mdx |
| /rjecnik/pos | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/pos.mdx |
| /rjecnik/predujam | FiskAI | mdx | content/rjecnik/predujam.mdx |
| /rjecnik/predujam | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/predujam.mdx |
| /rjecnik/prirez | FiskAI | mdx | content/rjecnik/prirez.mdx |
| /rjecnik/prirez | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/prirez.mdx |
| /rjecnik/r-1 | FiskAI | mdx | content/rjecnik/r-1.mdx |
| /rjecnik/r-1 | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/r-1.mdx |
| /rjecnik/r-2 | FiskAI | mdx | content/rjecnik/r-2.mdx |
| /rjecnik/r-2 | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/r-2.mdx |
| /rjecnik/rezident | FiskAI | mdx | content/rjecnik/rezident.mdx |
| /rjecnik/rezident | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/rezident.mdx |
| /rjecnik/stopa-poreza | FiskAI | mdx | content/rjecnik/stopa-poreza.mdx |
| /rjecnik/stopa-poreza | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/stopa-poreza.mdx |
| /rjecnik/sudski-registar | FiskAI | mdx | content/rjecnik/sudski-registar.mdx |
| /rjecnik/sudski-registar | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/sudski-registar.mdx |
| /rjecnik/temeljni-kapital | FiskAI | mdx | content/rjecnik/temeljni-kapital.mdx |
| /rjecnik/temeljni-kapital | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/temeljni-kapital.mdx |
| /rjecnik/ubl | FiskAI | mdx | content/rjecnik/ubl.mdx |
| /rjecnik/ubl | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/ubl.mdx |
| /rjecnik/ura | FiskAI | mdx | content/rjecnik/ura.mdx |
| /rjecnik/ura | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/ura.mdx |
| /rjecnik/zki | FiskAI | mdx | content/rjecnik/zki.mdx |
| /rjecnik/zki | FiskAI-next | mdx | ../FiskAI-next/content/rjecnik/zki.mdx |
| /security | FiskAI | tsx | src/app/(marketing)/security/page.tsx |
| /security | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/security/page.tsx |
| /select-role | FiskAI | tsx | src/app/(marketing)/select-role/page.tsx |
| /select-role | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/select-role/page.tsx |
| /status | FiskAI | tsx | src/app/(marketing)/status/page.tsx |
| /status | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/status/page.tsx |
| /terms | FiskAI | tsx | src/app/(marketing)/terms/page.tsx |
| /terms | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/terms/page.tsx |
| /urednicka-politika | FiskAI | tsx | src/app/(marketing)/urednicka-politika/page.tsx |
| /urednicka-politika | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/urednicka-politika/page.tsx |
| /usporedba | FiskAI | tsx | src/app/(marketing)/usporedba/page.tsx |
| /usporedba | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/usporedba/page.tsx |
| /usporedba/[slug] | FiskAI | tsx | src/app/(marketing)/usporedba/[slug]/page.tsx |
| /usporedba/[slug] | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/usporedba/[slug]/page.tsx |
| /usporedba/dodatni-prihod | FiskAI | mdx | content/usporedbe/dodatni-prihod.mdx |
| /usporedba/dodatni-prihod | FiskAI-next | mdx | ../FiskAI-next/content/usporedbe/dodatni-prihod.mdx |
| /usporedba/firma | FiskAI | mdx | content/usporedbe/firma.mdx |
| /usporedba/firma | FiskAI-next | mdx | ../FiskAI-next/content/usporedbe/firma.mdx |
| /usporedba/pocinjem-solo | FiskAI | mdx | content/usporedbe/pocinjem-solo.mdx |
| /usporedba/pocinjem-solo | FiskAI-next | mdx | ../FiskAI-next/content/usporedbe/pocinjem-solo.mdx |
| /usporedba/preko-praga | FiskAI | mdx | content/usporedbe/preko-praga.mdx |
| /usporedba/preko-praga | FiskAI-next | mdx | ../FiskAI-next/content/usporedbe/preko-praga.mdx |
| /verify-email | FiskAI | tsx | src/app/(marketing)/verify-email/page.tsx |
| /verify-email | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/verify-email/page.tsx |
| /vijesti | FiskAI | tsx | src/app/(marketing)/vijesti/page.tsx |
| /vijesti | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/vijesti/page.tsx |
| /vijesti/[slug] | FiskAI | tsx | src/app/(marketing)/vijesti/[slug]/page.tsx |
| /vijesti/[slug] | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/vijesti/[slug]/page.tsx |
| /vijesti/kategorija/[slug] | FiskAI | tsx | src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx |
| /vijesti/kategorija/[slug] | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx |
| /vodic | FiskAI | tsx | src/app/(marketing)/vodic/page.tsx |
| /vodic | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/vodic/page.tsx |
| /vodic/[slug] | FiskAI | tsx | src/app/(marketing)/vodic/[slug]/page.tsx |
| /vodic/[slug] | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/vodic/[slug]/page.tsx |
| /vodic/doo | FiskAI | mdx | content/vodici/doo.mdx |
| /vodic/doo | FiskAI-next | mdx | ../FiskAI-next/content/vodici/doo.mdx |
| /vodic/freelancer | FiskAI | mdx | content/vodici/freelancer.mdx |
| /vodic/freelancer | FiskAI-next | mdx | ../FiskAI-next/content/vodici/freelancer.mdx |
| /vodic/neoporezivi-primici | FiskAI | mdx | content/vodici/neoporezivi-primici.mdx |
| /vodic/neoporezivi-primici | FiskAI-next | mdx | ../FiskAI-next/content/vodici/neoporezivi-primici.mdx |
| /vodic/obrt-dohodak | FiskAI | mdx | content/vodici/obrt-dohodak.mdx |
| /vodic/obrt-dohodak | FiskAI-next | mdx | ../FiskAI-next/content/vodici/obrt-dohodak.mdx |
| /vodic/pausalni-obrt | FiskAI | mdx | content/vodici/pausalni-obrt.mdx |
| /vodic/pausalni-obrt | FiskAI-next | mdx | ../FiskAI-next/content/vodici/pausalni-obrt.mdx |
| /vodic/posebni-oblici | FiskAI | mdx | content/vodici/posebni-oblici.mdx |
| /vodic/posebni-oblici | FiskAI-next | mdx | ../FiskAI-next/content/vodici/posebni-oblici.mdx |
| /wizard | FiskAI | tsx | src/app/(marketing)/wizard/page.tsx |
| /wizard | FiskAI-next | tsx | ../FiskAI-next/src/app/(marketing)/wizard/page.tsx |

## Tool Coverage
| Tool | Route | Notes |
| --- | --- | --- |
| pdv-threshold | /alati/pdv-kalkulator | Checks that the PDV threshold value is rendered from fiscal-data. |
| tax-calculator | /alati/kalkulator-poreza | Ensures pauzalni max threshold appears and matches fiscal-data. |
| contribution-calculator | /alati/kalkulator-doprinosa | Validates monthly contribution outputs rendered from fiscal-data. |
| oib-validator | /alati/oib-validator | Confirms OIB validator accepts a known valid checksum. |

## Dynamic Validation (Playwright)
Results file: audit/marketing-playwright-results.json
- Total tests: n/a | Passed: 1 | Failed: 1 | Skipped: 0 | Flaky: 0
- Start time: 2025-12-21T08:31:01.110Z
- Duration: 348.5s
- Failures:
  - Error: Contrast issues on https://fiskai.hr/: color-contrast
  - Error: Contrast issues on https://fiskai.hr/about: color-contrast
  - Error: Contrast issues on https://fiskai.hr/ai-data-policy: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/e-racun: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/kalendar: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/kalkulator-doprinosa: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/kalkulator-poreza: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/oib-validator: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/pdv-kalkulator: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/posd-kalkulator: color-contrast
  - Error: Contrast issues on https://fiskai.hr/alati/uplatnice: color-contrast
  - Error: Contrast issues on https://fiskai.hr/baza-znanja: color-contrast
  - Error: Contrast issues on https://fiskai.hr/contact: color-contrast
  - Error: Contrast issues on https://fiskai.hr/cookies: color-contrast
  - Error: Contrast issues on https://fiskai.hr/dpa: color-contrast
  - Error: Contrast issues on https://fiskai.hr/features: color-contrast
  - Error: Link https://www.porezna-uprava.hr/ request failed on https://fiskai.hr/fiskalizacija: apiRequestContext.get: failed to decompress 'deflate' encoding: Error: incorrect header check
  - Error: Link https://e-racun.hr/ request failed on https://fiskai.hr/fiskalizacija: apiRequestContext.get: Timeout 10000ms exceeded.
  - Error: Contrast issues on https://fiskai.hr/fiskalizacija: color-contrast
  - Error: Contrast issues on https://fiskai.hr/for/accountants: color-contrast
  - Error: Contrast issues on https://fiskai.hr/for/dooo: color-contrast
  - Error: Contrast issues on https://fiskai.hr/for/pausalni-obrt: color-contrast
  - Error: Contrast issues on https://fiskai.hr/izvori: color-contrast
  - Error: Contrast issues on https://fiskai.hr/kako-da: color-contrast
  - Error: Contrast issues on https://fiskai.hr/kako-da/godisnji-obracun-pausalca: color-contrast
  - Error: Link https://fiskai.hr/vodici/pausalni-obrt should respond (found on https://fiskai.hr/kako-da/ispuniti-po-sd).
  - Error: Link https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/obrasci.aspx request failed on https://fiskai.hr/kako-da/ispuniti-po-sd: apiRequestContext.get: failed to decompress 'deflate' encoding: Error: incorrect header check
  - Error: Contrast issues on https://fiskai.hr/kako-da/ispuniti-po-sd: color-contrast
  - Error: Link https://www.porezna-uprava.hr/fiskalizacija request failed on https://fiskai.hr/kako-da/registrirati-informacijskog-posrednika: apiRequestContext.get: failed to decompress 'deflate' encoding: Error: incorrect header check
  - Error: Link https://fiskalizacija.gov.hr/ request failed on https://fiskai.hr/kako-da/registrirati-informacijskog-posrednika: apiRequestContext.get: getaddrinfo ENOTFOUND fiskalizacija.gov.hr
  - Error: Contrast issues on https://fiskai.hr/kako-da/registrirati-informacijskog-posrednika: color-contrast
  - Error: Link https://fiskai.hr/alati/prag-pdv should respond (found on https://fiskai.hr/kako-da/uci-u-sustav-pdv).
  - Error: Link https://fiskai.hr/alati/pdv-prijava should respond (found on https://fiskai.hr/kako-da/uci-u-sustav-pdv).
  - Error: Link https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pdv-registracija.aspx request failed on https://fiskai.hr/kako-da/uci-u-sustav-pdv: apiRequestContext.get: failed to decompress 'deflate' encoding: Error: incorrect header check
  - Error: Contrast issues on https://fiskai.hr/kako-da/uci-u-sustav-pdv: color-contrast
  - Error: Contrast issues on https://fiskai.hr/metodologija: color-contrast
  - Error: Contrast issues on https://fiskai.hr/prelazak: color-contrast
  - Error: Contrast issues on https://fiskai.hr/pricing: color-contrast
  - Error: Contrast issues on https://fiskai.hr/privacy: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/akontacija: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/direktor: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/dobit: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/doh: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/dohodak: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/doo: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/e-racun: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/fisk-aplikacija: color-contrast
  - Error: Contrast issues on https://fiskai.hr/rjecnik/fiskalizacija: color-contrast
  - ... 79 more

## Page-by-Page Audit

### /
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - english: dashboard (ratio 0.023)
- Design token issues:
  - None

### /
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - english: dashboard (ratio 0.023)
- Design token issues:
  - None

### /about
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/about/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /about
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/about/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /ai-data-policy
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/ai-data-policy/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /ai-data-policy
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/ai-data-policy/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /alati
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati/${tool.slug} (internal, missing)
  - /wizard (internal, auth)
  - /usporedba/pocinjem-solo (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /alati
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati/${tool.slug} (internal, missing)
  - /wizard (internal, auth)
  - /usporedba/pocinjem-solo (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /alati/e-racun
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/e-racun/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 2000 (line 215) - Year reference is earlier than current year; verify it is still accurate.
  - 2026 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 286) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - placeholder: placeholder
- Design token issues:
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 330) - Inline styles detected; ensure design tokens are used.
  - style={{ background: "var(--surface)" } (line 348) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 376) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 387) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 409) - Inline styles detected; ensure design tokens are used.
  - style={{ background: "var(--surface)" } (line 427) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 455) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 466) - Inline styles detected; ensure design tokens are used.

### /alati/e-racun
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/e-racun/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 2000 (line 215) - Year reference is earlier than current year; verify it is still accurate.
  - 2026 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 286) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - placeholder: placeholder
- Design token issues:
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 330) - Inline styles detected; ensure design tokens are used.
  - style={{ background: "var(--surface)" } (line 348) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 376) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 387) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 409) - Inline styles detected; ensure design tokens are used.
  - style={{ background: "var(--surface)" } (line 427) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 455) - Inline styles detected; ensure design tokens are used.
  - style={{ borderColor: "var(--border)", background: "var(--surface)" } (line 466) - Inline styles detected; ensure design tokens are used.

### /alati/kalendar
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/kalendar/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 10) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 55) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 60) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/kalendar
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/kalendar/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 10) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 55) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 60) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/kalkulator-doprinosa
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /vodic/pausalni-obrt (internal, ok)
  - /alati/uplatnice (internal, ok)
  - /register (internal, auth)
  - /features (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 560,40 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 204,79 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560,40 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 719,20 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 10) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 22) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 56) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 58) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/kalkulator-doprinosa
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /vodic/pausalni-obrt (internal, ok)
  - /alati/uplatnice (internal, ok)
  - /register (internal, auth)
  - /features (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 560,40 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 204,79 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560,40 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 719,20 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 10) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 22) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 56) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 58) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/kalkulator-poreza
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/kalkulator-poreza/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /vodic/pausalni-obrt (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 10) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 57) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/kalkulator-poreza
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/kalkulator-poreza/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /vodic/pausalni-obrt (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 10) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 57) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/oib-validator
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/oib-validator/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
- Buttons:
  - Provjeri
- Hardcoded values:
  - None
- Language issues:
  - placeholder: placeholder
- Design token issues:
  - None

### /alati/oib-validator
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/oib-validator/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
- Buttons:
  - Provjeri
- Hardcoded values:
  - None
- Language issues:
  - placeholder: placeholder
- Design token issues:
  - None

### /alati/pdv-kalkulator
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/pdv-kalkulator/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /usporedba/preko-praga (internal, ok)
  - /vodic/pausalni-obrt#pdv (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 71) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/pdv-kalkulator
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/pdv-kalkulator/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /usporedba/preko-praga (internal, ok)
  - /vodic/pausalni-obrt#pdv (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 71) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/posd-kalkulator
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/posd-kalkulator/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /alati/posd-kalkulator
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/posd-kalkulator/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /alati/uplatnice
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/alati/uplatnice/page.tsx
- Data dependencies: knowledge-hub/constants
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 1820 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /alati/uplatnice
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/alati/uplatnice/page.tsx
- Data dependencies: knowledge-hub/constants
- Links:
  - /baza-znanja (internal, ok)
  - /alati (internal, ok)
  - /register (internal, auth)
- Buttons:
  - None
- Hardcoded values:
  - 1820 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /baza-znanja
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/baza-znanja/page.tsx
- Data dependencies: None
- Links:
  - /wizard (internal, auth)
  - /vodic (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /alati (internal, ok)
  - /usporedba/${comparison.slug} (internal, missing)
  - /vodic/${guide.slug} (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /baza-znanja
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/baza-znanja/page.tsx
- Data dependencies: None
- Links:
  - /wizard (internal, auth)
  - /vodic (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /alati (internal, ok)
  - /usporedba/${comparison.slug} (internal, missing)
  - /vodic/${guide.slug} (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /contact
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/contact/page.tsx
- Data dependencies: None
- Links:
  - mailto:kontakt@fiskai.hr (external, external)
  - tel:+38512345678 (external, external)
  - mailto:podrska@fiskai.hr (external, external)
  - /login (internal, auth)
  - /register (internal, auth)
  - tel:+38512345679 (external, external)
- Buttons:
  - Pošalji zahtjev za demo
- Hardcoded values:
  - None
- Language issues:
  - placeholder: placeholder
- Design token issues:
  - None

### /contact
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/contact/page.tsx
- Data dependencies: None
- Links:
  - mailto:kontakt@fiskai.hr (external, external)
  - tel:+38512345678 (external, external)
  - mailto:podrska@fiskai.hr (external, external)
  - /login (internal, auth)
  - /register (internal, auth)
  - tel:+38512345679 (external, external)
- Buttons:
  - Pošalji zahtjev za demo
- Hardcoded values:
  - None
- Language issues:
  - placeholder: placeholder
- Design token issues:
  - None

### /cookies
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/cookies/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /cookies
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/cookies/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /dpa
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/dpa/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /dpa
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/dpa/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /features
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/features/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /features
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/features/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /fiskalizacija
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/fiskalizacija/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /kako-da/registrirati-informacijskog-posrednika (internal, ok)
  - /kako-da/izdati-prvi-fiskalizirani-racun (internal, missing)
  - /register (internal, auth)
  - /features (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 200.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 22) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 23) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 76) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 147) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /fiskalizacija
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/fiskalizacija/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /kako-da/registrirati-informacijskog-posrednika (internal, ok)
  - /kako-da/izdati-prvi-fiskalizirani-racun (internal, missing)
  - /register (internal, auth)
  - /features (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 200.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 22) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 23) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 76) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 147) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /for/accountants
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/for/accountants/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
  - /contact (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /for/accountants
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/for/accountants/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
  - /contact (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /for/dooo
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/for/dooo/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
  - /contact (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /for/dooo
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/for/dooo/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
  - /contact (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /for/pausalni-obrt
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/for/pausalni-obrt/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
  - /contact (internal, ok)
  - tel:+38512345678 (external, external)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /for/pausalni-obrt
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/for/pausalni-obrt/page.tsx
- Data dependencies: None
- Links:
  - /register (internal, auth)
  - /contact (internal, ok)
  - tel:+38512345678 (external, external)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /izvori
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/izvori/page.tsx
- Data dependencies: None
- Links:
  - /urednicka-politika (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /izvori
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/izvori/page.tsx
- Data dependencies: None
- Links:
  - /urednicka-politika (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/kako-da/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /kako-da/${howto.slug} (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/kako-da/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - /kako-da/${howto.slug} (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/[slug]
- Repo: FiskAI
- Source: db
- File: /home/admin/FiskAI/src/app/(marketing)/kako-da/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/[slug]
- Repo: FiskAI-next
- Source: db
- File: /home/admin/FiskAI-next/src/app/(marketing)/kako-da/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/godisnji-obracun-pausalca
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/kako-da/godisnji-obracun-pausalca.mdx
- Data dependencies: None
- Links:
  - /alati/posd-kalkulator (internal, ok)
  - /alati/kalkulator-doprinosa (internal, ok)
  - /alati/kalendar (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 6.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35.000 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35.000 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 840 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 151,20 EUR (line 84) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 991,20 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 230 EUR (line 88) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 310 EUR (line 89) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 290 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.180 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 188,80 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 133 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 176) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 187) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 650 EUR (line 187) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.300 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 189) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.950 EUR (line 189) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 196) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 200) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 201) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 11) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 24) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 27) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 28) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 29) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 57) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 76) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 153) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 24) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 28) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 57) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 153) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 153) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 171) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 176) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 176) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 181) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 183) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 185) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 233) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/godisnji-obracun-pausalca
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/kako-da/godisnji-obracun-pausalca.mdx
- Data dependencies: None
- Links:
  - /alati/posd-kalkulator (internal, ok)
  - /alati/kalkulator-doprinosa (internal, ok)
  - /alati/kalendar (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 6.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35.000 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35.000 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 840 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 151,20 EUR (line 84) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 991,20 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 230 EUR (line 88) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 310 EUR (line 89) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 290 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.180 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 188,80 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 133 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 176) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 187) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 650 EUR (line 187) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.300 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 189) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.950 EUR (line 189) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 196) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 200) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 201) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 11) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 24) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 27) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 28) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 29) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 57) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 76) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 153) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 24) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 28) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 57) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 153) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 153) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 171) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 176) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 176) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 181) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 183) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 185) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 233) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/ispuniti-po-sd
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/kako-da/ispuniti-po-sd.mdx
- Data dependencies: None
- Links:
  - /rjecnik/po-sd (internal, ok)
  - /vodici/pausalni-obrt (internal, missing)
  - /rjecnik/pausal (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 8.500 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.500 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 204 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 168,30 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 372,30 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 11) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 74) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/ispuniti-po-sd
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/kako-da/ispuniti-po-sd.mdx
- Data dependencies: None
- Links:
  - /rjecnik/po-sd (internal, ok)
  - /vodici/pausalni-obrt (internal, missing)
  - /rjecnik/pausal (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 8.500 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.500 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 204 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 168,30 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 372,30 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 11) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 74) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/registrirati-informacijskog-posrednika
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/kako-da/registrirati-informacijskog-posrednika.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 0 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0,15 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0,10 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 5) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 160) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/registrirati-informacijskog-posrednika
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/kako-da/registrirati-informacijskog-posrednika.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 0 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0,15 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0,10 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 5) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 160) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/uci-u-sustav-pdv
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/kako-da/uci-u-sustav-pdv.mdx
- Data dependencies: None
- Links:
  - /alati/pdv-kalkulator (internal, ok)
  - /alati/prag-pdv (internal, missing)
  - /alati/pdv-prijava (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 2) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 5) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 11) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 62.000 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000,00 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250,00 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250,00 EUR (line 170) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 214) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 215) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 230) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 230) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 275) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 36) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 36) - Year reference is earlier than current year; verify it is still accurate.
  - 60000 (line 8) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /kako-da/uci-u-sustav-pdv
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/kako-da/uci-u-sustav-pdv.mdx
- Data dependencies: None
- Links:
  - /alati/pdv-kalkulator (internal, ok)
  - /alati/prag-pdv (internal, missing)
  - /alati/pdv-prijava (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 2) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 5) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 11) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 62.000 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000,00 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250,00 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250,00 EUR (line 170) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 214) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 215) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 230) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 230) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 275) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 36) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 36) - Year reference is earlier than current year; verify it is still accurate.
  - 60000 (line 8) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /metodologija
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/metodologija/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - placeholder: todo
- Design token issues:
  - None

### /metodologija
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/metodologija/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - placeholder: todo
- Design token issues:
  - None

### /prelazak
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/prelazak/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /prelazak
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/prelazak/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /pricing
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/pricing/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /pricing
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/pricing/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /privacy
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/privacy/page.tsx
- Data dependencies: None
- Links:
  - /cookies (internal, ok)
  - /ai-data-policy (internal, ok)
  - mailto:gdpr@fiskai.hr (external, external)
  - https://azop.hr (external, external)
  - /terms (internal, ok)
  - /dpa (internal, ok)
  - /security (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /privacy
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/privacy/page.tsx
- Data dependencies: None
- Links:
  - /cookies (internal, ok)
  - /ai-data-policy (internal, ok)
  - mailto:gdpr@fiskai.hr (external, external)
  - https://azop.hr (external, external)
  - /terms (internal, ok)
  - /dpa (internal, ok)
  - /security (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/rjecnik/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - #${letter} (anchor, external)
  - /rjecnik/${term.slug} (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/rjecnik/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
  - #${letter} (anchor, external)
  - /rjecnik/${term.slug} (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/[pojam]
- Repo: FiskAI
- Source: db
- File: /home/admin/FiskAI/src/app/(marketing)/rjecnik/[pojam]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/[pojam]
- Repo: FiskAI-next
- Source: db
- File: /home/admin/FiskAI-next/src/app/(marketing)/rjecnik/[pojam]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/akontacija
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/akontacija.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 20.000 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.000 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.000 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200.000 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500.000 EUR (line 89) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200.000 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 54.000 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 54.000 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 96) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 18.000 EUR (line 97) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.500 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 117) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 118) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 120) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 144) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 38) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 43) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 76) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 43) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 44) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 81) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 83) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 84) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 88) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 95) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 107) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 108) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 109) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 110) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 119) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/akontacija
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/akontacija.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 20.000 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.000 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.000 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200.000 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500.000 EUR (line 89) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200.000 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 54.000 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 54.000 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 96) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 18.000 EUR (line 97) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.500 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 117) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 118) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 120) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 144) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 38) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 43) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 76) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 43) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 44) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 81) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 83) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 84) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 88) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 95) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 107) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 108) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 109) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 110) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 119) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/direktor
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/direktor.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /usporedbe/firma (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 682 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136,40 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/direktor
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/direktor.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /usporedbe/firma (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 682 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136,40 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/dobit
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/dobit.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 1.000.000 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000.000 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000.000 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500.000 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 410.000 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 118) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 120) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 140) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 143) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 144) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.000 EUR (line 145) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 72) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 91) - Year reference is earlier than current year; verify it is still accurate.
  - 2023 (line 118) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 119) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 72) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 91) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 92) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 119) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 122) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/dobit
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/dobit.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 1.000.000 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000.000 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000.000 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500.000 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 410.000 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 118) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 120) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 140) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 143) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 144) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.000 EUR (line 145) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 72) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 91) - Year reference is earlier than current year; verify it is still accurate.
  - 2023 (line 118) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 119) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 72) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 91) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 92) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2024 (line 119) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 122) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/doh
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/doh.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 80.000 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.280 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.656 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 838 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.494 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 125) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.800 EUR (line 125) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.494 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 694 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 35) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/doh
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/doh.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 80.000 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.280 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.656 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 838 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.494 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 125) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.800 EUR (line 125) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.494 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 694 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 35) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/dohodak
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/dohodak.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.080 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.600 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.880 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.960 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 73) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 640 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.360 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 97) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 28,80 EUR (line 98) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 188,80 EUR (line 99) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 HRK (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 115) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 52) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 67) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 115) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/dohodak
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/dohodak.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.080 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.600 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.880 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.960 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 73) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 640 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.360 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 97) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 28,80 EUR (line 98) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 188,80 EUR (line 99) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 HRK (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 115) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 52) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 67) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 115) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/doo
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/doo.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.500 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 88) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 89) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.000 EUR (line 93) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.000 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 113) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 115) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25.000 EUR (line 116) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 128) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25.000 EUR (line 130) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 23) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/doo
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/doo.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.500 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 88) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 89) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 90.000 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.000 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.000 EUR (line 93) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.000 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 113) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 115) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25.000 EUR (line 116) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 128) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25.000 EUR (line 130) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 137) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 23) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/e-racun
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/e-racun.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 26) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 27) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 28) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 63) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 74) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/e-racun
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/e-racun.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 26) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 27) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 28) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 39) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 63) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 74) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/fisk-aplikacija
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/fisk-aplikacija.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 27) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 47) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/fisk-aplikacija
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/fisk-aplikacija.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 27) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 47) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/fiskalizacija
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/fiskalizacija.mdx
- Data dependencies: None
- Links:
  - /vodici/pausalni-obrt (internal, missing)
  - /vodici/obrt-dohodak (internal, missing)
  - /vodici/doo (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 40.000 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 84) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2013 (line 3) - Year reference is earlier than current year; verify it is still accurate.
  - 2013 (line 13) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 57) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 58) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 59) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 60) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 71) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 90) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 90) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 104) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 105) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/fiskalizacija
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/fiskalizacija.mdx
- Data dependencies: None
- Links:
  - /vodici/pausalni-obrt (internal, missing)
  - /vodici/obrt-dohodak (internal, missing)
  - /vodici/doo (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 40.000 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 84) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2013 (line 3) - Year reference is earlier than current year; verify it is still accurate.
  - 2013 (line 13) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 57) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 58) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 59) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2027 (line 60) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 71) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 90) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 90) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 104) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 105) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/fiskalna-godina
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/fiskalna-godina.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2024 (line 34) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/fiskalna-godina
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/fiskalna-godina.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2024 (line 34) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 38) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/hgk
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/hgk.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 300 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/hgk
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/hgk.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 300 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/hok
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/hok.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 400 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/hok
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/hok.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 400 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/hzzo
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/hzzo.mdx
- Data dependencies: None
- Links:
  - https://gov.hr/moja-uprava/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 1.000 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20 HRK (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 HRK (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 22) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 41) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/hzzo
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/hzzo.mdx
- Data dependencies: None
- Links:
  - https://gov.hr/moja-uprava/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 1.000 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20 HRK (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 HRK (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 22) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 41) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/informacijski-posrednik
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/informacijski-posrednik.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 19) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 21) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 26) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/informacijski-posrednik
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/informacijski-posrednik.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 19) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 21) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 26) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/ira
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/ira.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 24.000,00 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.680,00 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720,00 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.920,00 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 345,60 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.334,40 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 35) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 57) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/ira
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/ira.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 24.000,00 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.680,00 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720,00 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.920,00 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 345,60 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.334,40 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 35) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 57) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/jdoo
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/jdoo.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /usporedbe/firma (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 1.000.000 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2012 (line 13) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/jdoo
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/jdoo.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /usporedbe/firma (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 1.000.000 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2012 (line 13) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/jir
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/jir.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/jir
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/jir.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/joppd
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/joppd.mdx
- Data dependencies: None
- Links:
  - https://www.porezna-uprava.hr/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 1.000 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 365 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 75 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 620 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.165 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 87) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 59) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 59) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 80) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/joppd
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/joppd.mdx
- Data dependencies: None
- Links:
  - https://www.porezna-uprava.hr/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 1.000 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 365 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 75 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 620 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 165 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.165 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 87) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 59) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 59) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 80) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/kpr
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/kpr.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 500.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 125.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.500 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 131.500 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 131.500 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.500 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.500 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 29) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 57) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/kpr
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/kpr.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 500.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 125.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.500 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 131.500 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 131.500 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.500 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 81.500 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2024 (line 29) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 57) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/mikroeracun
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/mikroeracun.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 3) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/mikroeracun
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/mikroeracun.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 3) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/minimalna-osnovica
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/minimalna-osnovica.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 682 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 eur (line 9) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 102,30 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 34,10 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 248,93 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 361,46 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 248,93 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 700 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 730 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 620 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2023 (line 80) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 81) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 3) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 17) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 23) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 82) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/minimalna-osnovica
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/minimalna-osnovica.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 682 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 eur (line 9) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 17) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 102,30 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 34,10 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 248,93 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 361,46 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 248,93 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 700 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 730 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 620 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 90) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2023 (line 80) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 81) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 3) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 17) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 23) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 82) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/mio
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/mio.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 1.500 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 225 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 75 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136,40 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 21) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 43) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2030 (line 87) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/mio
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/mio.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 1.500 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 225 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 75 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136,40 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 92) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 21) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 43) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2030 (line 87) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/naknadno-fiskaliziranje
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/naknadno-fiskaliziranje.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 40.000 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/naknadno-fiskaliziranje
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/naknadno-fiskaliziranje.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 40.000 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/nerezident
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/nerezident.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/nerezident
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/nerezident.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/nkd
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/nkd.mdx
- Data dependencies: None
- Links:
  - https://www.dzs.hr/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 50 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2007 (line 9) - Year reference is earlier than current year; verify it is still accurate.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/nkd
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/nkd.mdx
- Data dependencies: None
- Links:
  - https://www.dzs.hr/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 50 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2007 (line 9) - Year reference is earlier than current year; verify it is still accurate.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/obrt
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/obrt.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 300.000 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 102) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.700 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.400 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 41) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/obrt
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/obrt.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 300.000 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 102) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.700 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.400 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 41) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/obrtni-registar
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/obrtni-registar.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 300 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/obrtni-registar
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/obrtni-registar.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 300 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/oib
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/oib.mdx
- Data dependencies: None
- Links:
  - https://www.porezna-uprava.hr/HR_OIB/Stranice/Provjera-OIB.aspx (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 2009 (line 13) - Year reference is earlier than current year; verify it is still accurate.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/oib
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/oib.mdx
- Data dependencies: None
- Links:
  - https://www.porezna-uprava.hr/HR_OIB/Stranice/Provjera-OIB.aspx (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 2009 (line 13) - Year reference is earlier than current year; verify it is still accurate.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/oib-operatera
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/oib-operatera.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/oib-operatera
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/oib-operatera.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/osobni-odbitak
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/osobni-odbitak.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 560 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 660 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 480 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 460 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 92 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 16,56 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 911,44 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 480 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 830 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.390 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 256 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 544 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 544 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 113) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 113) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2020 (line 109) - Year reference is earlier than current year; verify it is still accurate.
  - 2021 (line 110) - Year reference is earlier than current year; verify it is still accurate.
  - 2022 (line 111) - Year reference is earlier than current year; verify it is still accurate.
  - 2023 (line 112) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 113) - Year reference is earlier than current year; verify it is still accurate.
  - 2023 (line 116) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 3) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 9) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 114) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/osobni-odbitak
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/osobni-odbitak.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 560 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 34) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 660 EUR (line 35) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 36) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 480 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 460 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 92 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 16,56 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 911,44 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 480 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 830 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.390 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.020 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 256 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 544 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 544 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 113) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 113) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 114) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2020 (line 109) - Year reference is earlier than current year; verify it is still accurate.
  - 2021 (line 110) - Year reference is earlier than current year; verify it is still accurate.
  - 2022 (line 111) - Year reference is earlier than current year; verify it is still accurate.
  - 2023 (line 112) - Year reference is earlier than current year; verify it is still accurate.
  - 2024 (line 113) - Year reference is earlier than current year; verify it is still accurate.
  - 2023 (line 116) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 3) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 9) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 114) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pausal
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/pausal.mdx
- Data dependencies: None
- Links:
  - /vodici/pausalni-obrt (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 300.000 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.440 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 259 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.699 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 142 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136,40 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 248,93 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 142 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 391 EUR (line 73) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 369 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 138) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 145) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 19) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 62) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 154) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pausal
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/pausal.mdx
- Data dependencies: None
- Links:
  - /vodici/pausalni-obrt (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 300.000 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 55) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.440 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 259 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.699 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 142 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136,40 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 112,53 EUR (line 65) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 248,93 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 142 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 391 EUR (line 73) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 369 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 126) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300.000 EUR (line 138) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 145) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 19) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 62) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 154) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pdv
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/pdv.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2013 (line 42) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 9) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 17) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2013 (line 42) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pdv
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/pdv.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2013 (line 42) - Year reference is earlier than current year; verify it is still accurate.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 9) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 17) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2013 (line 42) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pdv-obrazac
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/pdv-obrazac.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.100 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 116) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 28) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 47) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 47) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 48) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 48) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 67) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pdv-obrazac
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/pdv-obrazac.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.100 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 110) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 112) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 116) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 28) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 36) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 46) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 47) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 47) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 48) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2026 (line 48) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 67) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/peppol
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/peppol.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 55) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/peppol
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/peppol.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 55) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/po-sd
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/po-sd.mdx
- Data dependencies: None
- Links:
  - /vodici/pausalni-obrt (internal, missing)
  - /kako-da/ispuniti-po-sd (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 15.000 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 360 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 64,80 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 424,80 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 360 EUR (line 73) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 43,20 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 403,20 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136 EUR (line 99) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 113 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 101) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 118) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 25) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 70) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/po-sd
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/po-sd.mdx
- Data dependencies: None
- Links:
  - /vodici/pausalni-obrt (internal, missing)
  - /kako-da/ispuniti-po-sd (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 15.000 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 360 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 64,80 EUR (line 49) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 424,80 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 360 EUR (line 73) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 43,20 EUR (line 74) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 403,20 EUR (line 75) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 91) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 136 EUR (line 99) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 113 EUR (line 100) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 249 EUR (line 101) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 118) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 25) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 29) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 32) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 70) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/porezna-osnovica
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/porezna-osnovica.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 640 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.360 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 256 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 544 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 125 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 125 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 84) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 110.000 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 11.000 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 96) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 247,50 EUR (line 97) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 124) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 650 EUR (line 129) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 140) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.440 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 148) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.200 EUR (line 151) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 103) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/porezna-osnovica
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/porezna-osnovica.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 640 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.360 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 256 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 544 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 125 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 125 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 84) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 110.000 EUR (line 85) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 11.000 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 96) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 247,50 EUR (line 97) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 682 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 119) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 124) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 127) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 650 EUR (line 129) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 140) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.440 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 148) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.200 EUR (line 151) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 103) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/porezna-prijava
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/porezna-prijava.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/porezna-prijava
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/porezna-prijava.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 59) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/porezni-razred
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/porezni-razred.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 560 EUR (line 20) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.390 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/porezni-razred
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/porezni-razred.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 560 EUR (line 20) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 415 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 25) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.390 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pos
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/pos.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2013 (line 45) - Year reference is earlier than current year; verify it is still accurate.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/pos
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/pos.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2013 (line 45) - Year reference is earlier than current year; verify it is still accurate.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/predujam
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/predujam.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 10.000 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 20) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 21) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.750 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.750 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.750 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000,00 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750,00 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750,00 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000,00 EUR (line 102) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500,00 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.500,00 EUR (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000,00 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750,00 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750,00 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.750,00 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 131) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 133) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 140) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 146) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 147) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 148) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 43) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 71) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 98) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 106) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/predujam
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/predujam.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 10.000 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 20) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 21) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.500 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.750 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.750 EUR (line 46) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 50) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.750 EUR (line 51) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000,00 EUR (line 81) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750,00 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750,00 EUR (line 83) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000,00 EUR (line 102) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500,00 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.500,00 EUR (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000,00 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750,00 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750,00 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.750,00 EUR (line 111) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 131) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 133) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 140) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 146) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 750 EUR (line 147) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 148) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 37) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 43) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 71) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 98) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 106) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/prirez
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/prirez.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 640 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.360 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 28,80 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 188,80 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.171,20 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19,20 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 179,20 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.180,80 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9,60 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 115,20 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/prirez
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/prirez.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 640 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.360 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 68) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 28,80 EUR (line 69) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 188,80 EUR (line 70) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.171,20 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 160 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19,20 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 179,20 EUR (line 79) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.180,80 EUR (line 80) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9,60 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 115,20 EUR (line 82) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 30) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/r-1
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/r-1.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/r-1
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/r-1.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 76) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 31) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/r-2
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/r-2.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 660 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/r-2
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/r-2.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 38) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 39) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 330 EUR (line 40) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 660 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 60) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/rezident
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/rezident.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/rezident
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/rezident.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/stopa-poreza
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/stopa-poreza.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 15) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 16) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/stopa-poreza
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/stopa-poreza.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 50.400 EUR (line 15) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.400 EUR (line 16) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000.000 EUR (line 23) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 11) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 18) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/sudski-registar
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/sudski-registar.mdx
- Data dependencies: None
- Links:
  - https://sudreg.pravosudje.hr/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 800 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/sudski-registar
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/sudski-registar.mdx
- Data dependencies: None
- Links:
  - https://sudreg.pravosudje.hr/ (external, external)
- Buttons:
  - None
- Hardcoded values:
  - 800 EUR (line 41) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/temeljni-kapital
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/temeljni-kapital.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /usporedbe/firma (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 2.500 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 20) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25.000 EUR (line 21) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 15) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/temeljni-kapital
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/temeljni-kapital.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /usporedbe/firma (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 2.500 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 3) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 20) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 25.000 EUR (line 21) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 37) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 52) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 53) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 54) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 4) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 15) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/ubl
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/ubl.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/ubl
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/ubl.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 34) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 35) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/ura
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/ura.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/ura
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/ura.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - 2.000 EUR (line 43) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 44) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 45) - Currency value appears in copy; verify it is sourced from fiscal-data.
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/zki
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/rjecnik/zki.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /rjecnik/zki
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/rjecnik/zki.mdx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /security
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/security/page.tsx
- Data dependencies: None
- Links:
  - /status (internal, ok)
  - /api/health (internal, missing)
  - mailto:gdpr@fiskai.hr (external, external)
  - mailto:security@fiskai.hr (external, external)
  - /privacy (internal, ok)
  - /ai-data-policy (internal, ok)
  - /dpa (internal, ok)
  - /cookies (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 240) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 341) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /security
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/security/page.tsx
- Data dependencies: None
- Links:
  - /status (internal, ok)
  - /api/health (internal, missing)
  - mailto:gdpr@fiskai.hr (external, external)
  - mailto:security@fiskai.hr (external, external)
  - /privacy (internal, ok)
  - /ai-data-policy (internal, ok)
  - /dpa (internal, ok)
  - /cookies (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 240) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 341) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /status
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/status/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /status
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/status/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /terms
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/terms/page.tsx
- Data dependencies: None
- Links:
  - /pricing (internal, ok)
  - /status (internal, ok)
  - mailto:info@fiskai.hr (external, external)
  - mailto:podrska@fiskai.hr (external, external)
  - /privacy (internal, ok)
  - /cookies (internal, ok)
  - /ai-data-policy (internal, ok)
  - /dpa (internal, ok)
  - /security (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /terms
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/terms/page.tsx
- Data dependencies: None
- Links:
  - /pricing (internal, ok)
  - /status (internal, ok)
  - mailto:info@fiskai.hr (external, external)
  - mailto:podrska@fiskai.hr (external, external)
  - /privacy (internal, ok)
  - /cookies (internal, ok)
  - /ai-data-policy (internal, ok)
  - /dpa (internal, ok)
  - /security (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /urednicka-politika
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/urednicka-politika/page.tsx
- Data dependencies: None
- Links:
  - mailto:info@fisk.ai (external, external)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /urednicka-politika
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/urednicka-politika/page.tsx
- Data dependencies: None
- Links:
  - mailto:info@fisk.ai (external, external)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/usporedba/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/usporedba/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/[slug]
- Repo: FiskAI
- Source: db
- File: /home/admin/FiskAI/src/app/(marketing)/usporedba/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/[slug]
- Repo: FiskAI-next
- Source: db
- File: /home/admin/FiskAI-next/src/app/(marketing)/usporedba/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/dodatni-prihod
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/usporedbe/dodatni-prihod.mdx
- Data dependencies: None
- Links:
  - /vodic/pausalni-obrt (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/preko-praga (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 14) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 14) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 15) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 87) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 11 EUR (line 93) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 129) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.400 EUR (line 130) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 16.800 EUR (line 130) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 14.463 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.100 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.900 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.500 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.500 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.963 EUR (line 138) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.100 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.200 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 337 EUR (line 146) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.663 EUR (line 146) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.100 EUR (line 147) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.900 EUR (line 147) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.600 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.200 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 687 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.313 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.313 EUR (line 160) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 719,20 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 205) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 206) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 208) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 219) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 226) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 239) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 239) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 239) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 255) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 256) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 305) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 316) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/dodatni-prihod
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/usporedbe/dodatni-prihod.mdx
- Data dependencies: None
- Links:
  - /vodic/pausalni-obrt (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/preko-praga (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 14) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 14) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 15) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 28) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 87) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 11 EUR (line 93) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 129) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.400 EUR (line 130) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 16.800 EUR (line 130) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 14.463 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.100 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.900 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.500 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.500 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.963 EUR (line 138) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.000 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.100 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.200 EUR (line 142) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 337 EUR (line 146) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.663 EUR (line 146) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.100 EUR (line 147) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.900 EUR (line 147) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.600 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.200 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 687 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.313 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.000 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.313 EUR (line 160) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 719,20 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 205) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 206) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 208) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 137 EUR (line 219) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 226) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 239) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 239) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 20.000 EUR (line 239) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 255) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 256) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 305) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 316) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/firma
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/usporedbe/firma.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /rjecnik/jdoo (internal, ok)
  - /rjecnik/temeljni-kapital (internal, ok)
  - /rjecnik/direktor (internal, ok)
  - /usporedbe/pocinjem-solo (internal, missing)
  - /usporedbe/dodatni-prihod (internal, missing)
  - /usporedbe/preko-praga (internal, missing)
  - /kontakt (internal, missing)
  - /newsletter (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 2.650 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 148) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 151) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 155) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 164) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.150 EUR (line 165) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 166) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 192) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.240 EUR (line 193) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 18.000 EUR (line 194) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 198) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 235) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 242) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 243) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 244) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 245) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 246) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 248) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 250) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 251) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 252) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 253) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 254) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 255) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 256) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 257) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 361) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 362) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 370) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 373) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 374) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 381) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 382) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.150 EUR (line 383) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 386) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 387) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.240 EUR (line 388) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 390) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 395) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 397) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 700 EUR (line 398) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 EUR (line 401) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 402) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 403) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 404) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.100 EUR (line 405) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 430) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 435) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 436) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 442) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.880 EUR (line 448) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.600 EUR (line 449) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 450) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.880 EUR (line 451) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 42.120 EUR (line 453) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.212 EUR (line 454) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 37.908 EUR (line 455) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.791 EUR (line 456) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 34.117 EUR (line 457) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 42.997 EUR (line 457) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80.000 EUR (line 463) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 468) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 469) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 481) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 483) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 17.760 EUR (line 486) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.400 EUR (line 487) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 488) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.660 EUR (line 489) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 26.340 EUR (line 491) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.634 EUR (line 492) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.706 EUR (line 493) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 505) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 511) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 521) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 950 EUR (line 522) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.800 EUR (line 523) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 527) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 536) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 542) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.400 EUR (line 554) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 17.760 EUR (line 562) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.800 EUR (line 563) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 564) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.060 EUR (line 565) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 26.940 EUR (line 567) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.694 EUR (line 568) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 24.246 EUR (line 569) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 14.548 EUR (line 570) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.698 EUR (line 571) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 577) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 583) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 593) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.880 EUR (line 599) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 600) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 601) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.580 EUR (line 602) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 66.420 EUR (line 604) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.000 EUR (line 606) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.156 EUR (line 607) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.156 EUR (line 608) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 59.264 EUR (line 609) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.926 EUR (line 610) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 53.338 EUR (line 611) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 62.218 EUR (line 611) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 624) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 635) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 664) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 664) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 664) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 680) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 681) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.000 EUR (line 682) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.000 EUR (line 683) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 687) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 688) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 689) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 691) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 715) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 739) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 750) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 756) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 779) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 780) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 797) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 799) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 800) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 65.000 EUR (line 801) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.500 EUR (line 802) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 37.500 EUR (line 803) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 807) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 807) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.016 EUR (line 808) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.736 EUR (line 809) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 56.264 EUR (line 810) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.626 EUR (line 811) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.638 EUR (line 812) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.064 EUR (line 813) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.574 EUR (line 814) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.400 EUR (line 815) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.974 EUR (line 816) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 828) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 849) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 867) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 870) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 872) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 882) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 901) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 901) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 920) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/firma
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/usporedbe/firma.mdx
- Data dependencies: None
- Links:
  - /vodici/doo (internal, missing)
  - /rjecnik/jdoo (internal, ok)
  - /rjecnik/temeljni-kapital (internal, ok)
  - /rjecnik/direktor (internal, ok)
  - /usporedbe/pocinjem-solo (internal, missing)
  - /usporedbe/dodatni-prihod (internal, missing)
  - /usporedbe/preko-praga (internal, missing)
  - /kontakt (internal, missing)
  - /newsletter (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 2.650 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 27) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 42) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 56) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 66) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 67) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 71) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 72) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 121) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 148) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 151) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 155) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 164) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.150 EUR (line 165) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 166) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 192) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.240 EUR (line 193) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 18.000 EUR (line 194) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 198) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 235) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 242) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 243) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 244) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 245) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 246) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 248) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 250) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 251) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 252) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 EUR (line 253) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 254) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 255) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 256) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 257) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 361) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 362) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 370) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 373) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 374) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 381) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 382) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.150 EUR (line 383) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 386) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 387) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.240 EUR (line 388) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 390) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 395) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 397) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 700 EUR (line 398) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 EUR (line 401) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 402) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 403) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 404) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.100 EUR (line 405) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 430) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 435) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 436) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 442) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.880 EUR (line 448) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.600 EUR (line 449) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 450) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.880 EUR (line 451) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 42.120 EUR (line 453) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.212 EUR (line 454) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 37.908 EUR (line 455) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.791 EUR (line 456) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 34.117 EUR (line 457) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 42.997 EUR (line 457) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80.000 EUR (line 463) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 468) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 469) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.200 EUR (line 481) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 483) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 17.760 EUR (line 486) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.400 EUR (line 487) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 488) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.660 EUR (line 489) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 26.340 EUR (line 491) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.634 EUR (line 492) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.706 EUR (line 493) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 505) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 511) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 521) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 950 EUR (line 522) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.800 EUR (line 523) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 EUR (line 527) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 536) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 542) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.400 EUR (line 554) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 17.760 EUR (line 562) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.800 EUR (line 563) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 564) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.060 EUR (line 565) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 26.940 EUR (line 567) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.694 EUR (line 568) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 24.246 EUR (line 569) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 14.548 EUR (line 570) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.698 EUR (line 571) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200.000 EUR (line 577) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 583) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 593) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.880 EUR (line 599) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 600) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 601) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13.580 EUR (line 602) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 66.420 EUR (line 604) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.000 EUR (line 606) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.156 EUR (line 607) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.156 EUR (line 608) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 59.264 EUR (line 609) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.926 EUR (line 610) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 53.338 EUR (line 611) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 62.218 EUR (line 611) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 624) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 635) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 664) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 664) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 450 EUR (line 664) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 680) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 681) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.000 EUR (line 682) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.000 EUR (line 683) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 687) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.000 EUR (line 688) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.000 EUR (line 689) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 691) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 715) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.000 EUR (line 739) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 750) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 756) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 740 EUR (line 779) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 780) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 797) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 799) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 800) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 65.000 EUR (line 801) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 12.500 EUR (line 802) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 37.500 EUR (line 803) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 807) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 807) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.016 EUR (line 808) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.736 EUR (line 809) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 56.264 EUR (line 810) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.626 EUR (line 811) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.638 EUR (line 812) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.064 EUR (line 813) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.574 EUR (line 814) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.400 EUR (line 815) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.974 EUR (line 816) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 560 EUR (line 828) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 849) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 867) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 870) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 872) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500.000 EUR (line 882) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 901) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.500 EUR (line 901) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 920) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/pocinjem-solo
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/usporedbe/pocinjem-solo.mdx
- Data dependencies: None
- Links:
  - /vodic/pausalni-obrt (internal, ok)
  - /vodic/obrt-dohodak (internal, ok)
  - /vodic/jdoo (internal, missing)
  - /vodic/freelancer (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 14) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 15) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 98) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 133) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.744 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.256 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.864 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.136 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.680 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.824 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 29.176 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80.000 EUR (line 163) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 163) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 164) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.200 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.656 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 22.800 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.742 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.458 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35.000 EUR (line 174) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.669 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 31.331 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.144 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.856 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 205) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 262) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 263) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 290) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 299) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 348) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/pocinjem-solo
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/usporedbe/pocinjem-solo.mdx
- Data dependencies: None
- Links:
  - /vodic/pausalni-obrt (internal, ok)
  - /vodic/obrt-dohodak (internal, ok)
  - /vodic/jdoo (internal, missing)
  - /vodic/freelancer (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 14) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 15) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 29) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 98) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 133) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 134) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 135) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 136) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.000 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.744 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 36.256 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.720 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.864 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.136 EUR (line 157) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.680 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.824 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 29.176 EUR (line 158) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80.000 EUR (line 163) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 163) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 164) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.200 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.656 EUR (line 168) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 22.800 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.742 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 23.458 EUR (line 169) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35.000 EUR (line 174) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.669 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 31.331 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.144 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.856 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 205) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 262) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 263) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 290) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 299) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 0 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 12) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 348) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/preko-praga
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/usporedbe/preko-praga.mdx
- Data dependencies: None
- Links:
  - /vodiči/obrt-dohodak (internal, missing)
  - /vodiči/jdoo (internal, missing)
  - /vodiči/pdv-sustav (internal, missing)
  - /vodiči/odabir-knjigovode (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 11) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 16) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 129) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 195) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 199) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 202) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.500 EUR (line 210) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 221) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 262) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 267) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 279) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 280) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 297) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 298) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 301) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250 EUR (line 301) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250 EUR (line 302) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 314) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 314) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 317) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 318) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 319) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.400 EUR (line 320) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 49.456 EUR (line 321) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 11.869 EUR (line 322) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 37.587 EUR (line 323) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 326) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 327) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.400 EUR (line 328) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.620 EUR (line 329) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.600 EUR (line 330) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 44.380 EUR (line 331) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.326 EUR (line 332) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 39.054 EUR (line 333) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.905 EUR (line 334) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.549 EUR (line 335) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 337) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 339) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 339) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 342) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 343) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 344) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.400 EUR (line 345) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 64.456 EUR (line 346) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.337 EUR (line 347) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.119 EUR (line 348) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 351) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 352) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.200 EUR (line 353) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.160 EUR (line 354) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 355) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 56.440 EUR (line 356) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.773 EUR (line 357) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 49.667 EUR (line 358) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.967 EUR (line 359) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 51.900 EUR (line 360) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.800 EUR (line 362) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 364) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 364) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 367) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 368) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 369) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 370) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 93.856 EUR (line 371) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 28.157 EUR (line 372) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 65.699 EUR (line 373) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 376) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 377) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.600 EUR (line 378) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.880 EUR (line 379) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.800 EUR (line 380) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 82.720 EUR (line 381) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 14.890 EUR (line 382) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 67.830 EUR (line 383) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.783 EUR (line 384) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.647 EUR (line 385) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 387) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80.000 EUR (line 391) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 392) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 392) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 393) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 400) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 405) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 414) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 417) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 421) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 423) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 425) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 441) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 445) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 446) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 447) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 475) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 481) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 486) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 487) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 491) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 492) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 508) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 519) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 554) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /usporedba/preko-praga
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/usporedbe/preko-praga.mdx
- Data dependencies: None
- Links:
  - /vodiči/obrt-dohodak (internal, missing)
  - /vodiči/jdoo (internal, missing)
  - /vodiči/pdv-sustav (internal, missing)
  - /vodiči/odabir-knjigovode (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 60.000 EUR (line 11) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 16) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 24) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 47) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 48) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 262 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 57) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 58) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 129) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 141) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 156) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 177) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 178) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 195) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 199) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 202) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.500 EUR (line 210) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 221) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 262) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 267) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 279) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400.000 EUR (line 280) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 297) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 298) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 301) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250 EUR (line 301) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.250 EUR (line 302) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 250 EUR (line 303) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 314) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 314) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 317) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 318) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 319) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.400 EUR (line 320) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 49.456 EUR (line 321) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 11.869 EUR (line 322) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 37.587 EUR (line 323) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.000 EUR (line 326) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 15.000 EUR (line 327) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.400 EUR (line 328) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.620 EUR (line 329) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.600 EUR (line 330) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 44.380 EUR (line 331) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.326 EUR (line 332) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 39.054 EUR (line 333) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.905 EUR (line 334) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 40.549 EUR (line 335) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 337) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 339) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 339) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 342) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 343) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 344) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.400 EUR (line 345) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 64.456 EUR (line 346) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 19.337 EUR (line 347) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 45.119 EUR (line 348) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100.000 EUR (line 351) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 30.000 EUR (line 352) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.200 EUR (line 353) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.160 EUR (line 354) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.200 EUR (line 355) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 56.440 EUR (line 356) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.773 EUR (line 357) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 49.667 EUR (line 358) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.967 EUR (line 359) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 51.900 EUR (line 360) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.800 EUR (line 362) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 364) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 364) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 367) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 368) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.144 EUR (line 369) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 370) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 93.856 EUR (line 371) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 28.157 EUR (line 372) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 65.699 EUR (line 373) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150.000 EUR (line 376) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 377) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 9.600 EUR (line 378) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.880 EUR (line 379) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 4.800 EUR (line 380) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 82.720 EUR (line 381) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 14.890 EUR (line 382) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 67.830 EUR (line 383) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.783 EUR (line 384) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 70.647 EUR (line 385) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 387) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80.000 EUR (line 391) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 392) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.000 EUR (line 392) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 120.000 EUR (line 393) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 400) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 405) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 414) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 417) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 421) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 423) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 425) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.000 EUR (line 441) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 445) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.650 EUR (line 446) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 EUR (line 447) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 475) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 481) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 486) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 300 EUR (line 487) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 350 EUR (line 491) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 EUR (line 492) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60.000 EUR (line 508) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 EUR (line 519) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 554) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vijesti
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/vijesti/page.tsx
- Data dependencies: None
- Links:
  - /vodic (internal, ok)
  - /alati (internal, ok)
  - /vijesti (internal, ok)
  - /vijesti/kategorija/${category.slug} (internal, db)
  - /register (internal, auth)
  - /vijesti/${post.slug} (internal, db)
  - /alati/kalendar (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vijesti
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/vijesti/page.tsx
- Data dependencies: None
- Links:
  - /vodic (internal, ok)
  - /alati (internal, ok)
  - /vijesti (internal, ok)
  - /vijesti/kategorija/${category.slug} (internal, db)
  - /register (internal, auth)
  - /vijesti/${post.slug} (internal, db)
  - /alati/kalendar (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vijesti/[slug]
- Repo: FiskAI
- Source: db
- File: /home/admin/FiskAI/src/app/(marketing)/vijesti/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vijesti/[slug]
- Repo: FiskAI-next
- Source: db
- File: /home/admin/FiskAI-next/src/app/(marketing)/vijesti/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vijesti/kategorija/[slug]
- Repo: FiskAI
- Source: db
- File: /home/admin/FiskAI/src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vijesti/kategorija/[slug]
- Repo: FiskAI-next
- Source: db
- File: /home/admin/FiskAI-next/src/app/(marketing)/vijesti/kategorija/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vodic
- Repo: FiskAI
- Source: tsx
- File: /home/admin/FiskAI/src/app/(marketing)/vodic/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vodic
- Repo: FiskAI-next
- Source: tsx
- File: /home/admin/FiskAI-next/src/app/(marketing)/vodic/page.tsx
- Data dependencies: None
- Links:
  - /baza-znanja (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/[slug]
- Repo: FiskAI
- Source: db
- File: /home/admin/FiskAI/src/app/(marketing)/vodic/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/[slug]
- Repo: FiskAI-next
- Source: db
- File: /home/admin/FiskAI-next/src/app/(marketing)/vodic/[slug]/page.tsx
- Data dependencies: None
- Links:
  - None
- Buttons:
  - None
- Hardcoded values:
  - None
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/doo
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/vodici/doo.mdx
- Data dependencies: None
- Links:
  - /rjecnik/temeljni-kapital (internal, ok)
  - /rjecnik/jdoo (internal, ok)
  - /rjecnik/direktor (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/firma (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
  - /usporedba/preko-praga (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 60000 (line 406) - Numeric value appears near fiscal keywords or matches canonical data.
  - 50000 (line 500) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 548) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/doo
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/vodici/doo.mdx
- Data dependencies: None
- Links:
  - /rjecnik/temeljni-kapital (internal, ok)
  - /rjecnik/jdoo (internal, ok)
  - /rjecnik/direktor (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/firma (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
  - /usporedba/preko-praga (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 60000 (line 406) - Numeric value appears near fiscal keywords or matches canonical data.
  - 50000 (line 500) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 548) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/freelancer
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/vodici/freelancer.mdx
- Data dependencies: None
- Links:
  - /rjecnik/pausal (internal, ok)
  - /rjecnik/dohodak (internal, ok)
  - /rjecnik/pdv (internal, ok)
  - /rjecnik/fiskalizacija (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
  - /vodici/pausalni-obrt (internal, missing)
  - /vodici/obrt-dohodak (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 313) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 575) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/freelancer
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/vodici/freelancer.mdx
- Data dependencies: None
- Links:
  - /rjecnik/pausal (internal, ok)
  - /rjecnik/dohodak (internal, ok)
  - /rjecnik/pdv (internal, ok)
  - /rjecnik/fiskalizacija (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
  - /vodici/pausalni-obrt (internal, missing)
  - /vodici/obrt-dohodak (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 313) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 575) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/neoporezivi-primici
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/vodici/neoporezivi-primici.mdx
- Data dependencies: None
- Links:
  - /alati/kalkulator-place (internal, missing)
  - /alati/joppd (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 100 HRK (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13,27 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 HRK (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6,64 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7,53450 HRK (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 HRK (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 26,54 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 HRK (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 53,09 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 HRK (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 79,63 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 HRK (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 106,17 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 93) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 HRK (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 331,80 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 HRK (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 497,70 EUR (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 HRK (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 663,60 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.250 HRK (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 829,51 EUR (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 HRK (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 995,41 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.750 HRK (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.161,31 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 HRK (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.327,21 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 HRK (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 331,80 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 HRK (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 995,41 EUR (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 HRK (line 179) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 66,36 EUR (line 179) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 180) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 960 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 331,80 EUR (line 189) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 190) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 796,32 EUR (line 191) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 192) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.486,28 EUR (line 193) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.246 EUR (line 196) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.497 EUR (line 197) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 198) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 225) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 1) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 6) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 8) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 184) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/neoporezivi-primici
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/vodici/neoporezivi-primici.mdx
- Data dependencies: None
- Links:
  - /alati/kalkulator-place (internal, missing)
  - /alati/joppd (internal, missing)
- Buttons:
  - None
- Hardcoded values:
  - 100 HRK (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 13,27 EUR (line 18) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 HRK (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6,64 EUR (line 19) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7,53450 HRK (line 22) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 26) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 35 EUR (line 30) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50 EUR (line 31) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 60 EUR (line 32) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 100 EUR (line 33) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 HRK (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 26,54 EUR (line 61) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 400 HRK (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 53,09 EUR (line 62) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 600 HRK (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 79,63 EUR (line 63) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 800 HRK (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 106,17 EUR (line 64) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 77) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 78) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 86) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 200 EUR (line 93) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 150 EUR (line 94) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 95) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 HRK (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 331,80 EUR (line 103) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 HRK (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 497,70 EUR (line 104) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 HRK (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 663,60 EUR (line 105) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 6.250 HRK (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 829,51 EUR (line 106) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 HRK (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 995,41 EUR (line 107) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 8.750 HRK (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.161,31 EUR (line 108) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 10.000 HRK (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.327,21 EUR (line 109) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.500 HRK (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 331,80 EUR (line 122) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.500 HRK (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 995,41 EUR (line 152) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 153) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 500 HRK (line 179) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 66,36 EUR (line 179) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.000 HRK (line 180) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 80 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 960 EUR (line 188) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 331,80 EUR (line 189) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 398,16 EUR (line 190) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 796,32 EUR (line 191) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 5.000 EUR (line 192) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 7.486,28 EUR (line 193) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2.246 EUR (line 196) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 1.497 EUR (line 197) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 3.750 EUR (line 198) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 50.000 EUR (line 225) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 1) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 6) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 8) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 184) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/obrt-dohodak
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/vodici/obrt-dohodak.mdx
- Data dependencies: None
- Links:
  - /rjecnik/dohodak (internal, ok)
  - /rjecnik/pausal (internal, ok)
  - /rjecnik/obrt (internal, ok)
  - /rjecnik/pdv (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/preko-praga (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 40) - Numeric value appears near fiscal keywords or matches canonical data.
  - 60000 (line 106) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/obrt-dohodak
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/vodici/obrt-dohodak.mdx
- Data dependencies: None
- Links:
  - /rjecnik/dohodak (internal, ok)
  - /rjecnik/pausal (internal, ok)
  - /rjecnik/obrt (internal, ok)
  - /rjecnik/pdv (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/preko-praga (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 40) - Numeric value appears near fiscal keywords or matches canonical data.
  - 60000 (line 106) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/pausalni-obrt
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/vodici/pausalni-obrt.mdx
- Data dependencies: None
- Links:
  - /rjecnik/pausal (internal, ok)
  - /rjecnik/fiskalizacija (internal, ok)
  - /rjecnik/po-sd (internal, ok)
  - /kako-da/ispuniti-po-sd (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 60000 (line 156) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 162) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 187) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/pausalni-obrt
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/vodici/pausalni-obrt.mdx
- Data dependencies: None
- Links:
  - /rjecnik/pausal (internal, ok)
  - /rjecnik/fiskalizacija (internal, ok)
  - /rjecnik/po-sd (internal, ok)
  - /kako-da/ispuniti-po-sd (internal, ok)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 45) - Numeric value appears near fiscal keywords or matches canonical data.
  - 60000 (line 156) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 162) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 187) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/posebni-oblici
- Repo: FiskAI
- Source: mdx
- File: /home/admin/FiskAI/content/vodici/posebni-oblici.mdx
- Data dependencies: None
- Links:
  - https://arkod.gov.hr (external, external)
  - https://apprrr.hr (external, external)
  - https://hok-cba.hr (external, external)
  - https://hlk.hr (external, external)
  - https://komora-arhitekata.hr (external, external)
  - https://revizorska-komora.hr (external, external)
  - https://registri.uprava.hr (external, external)
  - https://zaklada.civilnodrustvo.hr (external, external)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
  - /vodic/freelancer (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 4.000 kn (line 459) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 75) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 88) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 340) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 353) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

### /vodic/posebni-oblici
- Repo: FiskAI-next
- Source: mdx
- File: /home/admin/FiskAI-next/content/vodici/posebni-oblici.mdx
- Data dependencies: None
- Links:
  - https://arkod.gov.hr (external, external)
  - https://apprrr.hr (external, external)
  - https://hok-cba.hr (external, external)
  - https://hlk.hr (external, external)
  - https://komora-arhitekata.hr (external, external)
  - https://revizorska-komora.hr (external, external)
  - https://registri.uprava.hr (external, external)
  - https://zaklada.civilnodrustvo.hr (external, external)
  - /usporedba/pocinjem-solo (internal, ok)
  - /usporedba/dodatni-prihod (internal, ok)
  - /vodic/freelancer (internal, ok)
- Buttons:
  - None
- Hardcoded values:
  - 4.000 kn (line 459) - Currency value appears in copy; verify it is sourced from fiscal-data.
  - 2025 (line 2) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 75) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 88) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 340) - Numeric value appears near fiscal keywords or matches canonical data.
  - 2025 (line 353) - Numeric value appears near fiscal keywords or matches canonical data.
- Language issues:
  - None
- Design token issues:
  - None

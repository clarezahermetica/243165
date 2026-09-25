# Dana Karen — personal homepage / living CV

V1 is a one-page, handmade static site. Open `index.html` in a browser or serve this folder with `python -m http.server 8000`. There is no build step, package install, tracking, or external data feed.

## Edit the content

Nearly all mutable text is in [`content.js`](content.js):

- `metadata.lastUpdated` is the date shown in the header and footer. Change it manually when you edit the site. The CURRENTLY box shows a live America/Chicago clock instead.
- `profile` holds identity, location, intro, the website biography, a separate print-only professional summary, and education. `profile.education` is website copy; `profile.resumeEducation` is the school-specific print entry. Edit `profile.about.paragraphs` for the website and `profile.about.secrets` for its three tiny tooltip notes. The `{age}` and `{ageArticle}` tokens use the Chicago birth record and update on birthdays.
- `whyLayers` holds the four nested answers inside the existing `why?` disclosure. Each answer is editable as paragraphs; `~words~` renders struck through and `*words*` renders italic.
- `currently` is a list of label/value pairs. Leave a value as `""` to omit that row. `valueFrom` can reuse another profile value, as the location rows do. It is meant to look good with just a few rows. It never appears in the résumé or print output.
- `experience`, `projects`, `knowledge`, `programs`, and `volunteer` feed both views where appropriate. In `knowledge`, `know` and `dontKnow` are compact label/item groups; `wantToKnow` holds questions and broader interests. Only `knowledge.know` appears in the printed résumé's Skills section. `writing` and `interests` remain on the website only. `programs[].teammates` supplies the website-only contact note; the résumé uses only the event name, upcoming acceptance status, dates, and location.
- `projects[].links` accepts `https://` URLs. Empty values hide the links. A project can use paragraph arrays in `description`, version/note entries in `history`, and a short `resume` record for print. `projects[].image` is placeholder text until real images and alt text are added.
- `memotifs.quoteSlots` supplies small quotations scattered through the page. A `null` slot stays empty. The supplied Kant attribution is disputed and should be reviewed before treating it as a verified source.
- `memotifs.elsewhereCities` supplies the small hover/focus note on “mentally: everywhere.”
- `contact` holds the email and external profiles, including Instagram, Substack, and X. Clearing one of those three URLs shows `[link pending]` until a new `https://` URL is added.
- `music.tracks` is the editable playlist of local MP3 titles and paths. The player chooses a weighted random track, avoids an immediate repeat when there is more than one, and stays silent until the visitor presses play. See `assets/music/README.md`.
- `futureRooms` holds the two visibly unfinished room names. They are placeholders and do not navigate anywhere yet.

The page structure is in `index.html`, its appearance and responsive/print rules are in `styles.css`, and rendering/interactions are in `script.js`. All dynamic text is inserted as text or escaped HTML.

The five quote slots in `index.html` use `data-quote-slot="0"` through `"4"` to select the corresponding `memotifs.quoteSlots` entry. Most of the web page displays in lowercase; the biography preserves the supplied capitalization, and the printable résumé retains normal name capitalization.

## Résumé and print

The website's résumé links open a small dialog. Its print button opens the browser print dialog; its download button is an intentionally disabled placeholder. Opening `?resume=1` directly still shows the clean résumé, with its own print button. Printing from the main page prints only the résumé, including `profile.professionalSummary` and `profile.resumeEducation`; it excludes the website biography, scholarship note, writing placeholders, and teammate request. Other placeholder entries are deliberately visible in V1; replace them before using it as an actual application document.

The age is calculated from the date and **03:59 America/Chicago** birth time with `Intl.DateTimeFormat`. It refreshes at minute boundaries and when a hidden tab becomes visible. To inspect a particular instant in the browser console, use `siteAgeAt(new Date("2026-08-18T08:58:00Z"))` (17) and `siteAgeAt(new Date("2026-08-18T08:59:00Z"))` (18).

## Adding real images later

The small Princess Bubblegum GIF is stored locally in `assets/princess-bubblegum-science-tags.gif`. Replace a project placeholder box with an `<img>` and meaningful `alt` text when an image genuinely helps explain the project. The other supplied visual references remain moodboard material and are not shipped with the site.

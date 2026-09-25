const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const elements = new Map();
const quoteNodes = [...html.matchAll(/data-quote-slot="(\d)"/g)].map((match) => ({ dataset: { quoteSlot: match[1] }, textContent: "" }));
const motifNodes = [...html.matchAll(/data-motif="([^"]+)"/g)].map((match) => ({ dataset: { motif: match[1] }, textContent: "" }));
const resumeLinks = [...html.matchAll(/href="\?resume=1"/g)].map(() => ({ handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; } }));
const bodyClasses = new Set();
const scheduled = [];
const documentHandlers = {};
let reducedMotion = false;
let printCalls = 0;
function element(selector) {
  if (!elements.has(selector)) {
    const node = {
      textContent: "", innerHTML: "", hidden: false, href: "", dateTime: "",
      dataset: {}, style: { setProperty() {} }, attrs: new Map(), handlers: {}, open: false,
      addEventListener(type, handler) { this.handlers[type] = handler; },
      querySelectorAll() { return []; },
      setAttribute(name, value) { this.attrs.set(name, value); },
      getAttribute(name) { return this.attrs.get(name); },
      showModal() { this.open = true; }, close() { this.open = false; }, append() {}
    };
    if (selector === "#music-audio") {
      node.paused = true;
      node.play = async function () { this.paused = false; };
      node.pause = function () { this.paused = true; };
    }
    elements.set(selector, node);
  }
  return elements.get(selector);
}
const context = {
  URL, URLSearchParams, Intl, Date, Math, String, Number, Object,
  location: { search: "" },
  document: { querySelector: element, querySelectorAll: (selector) => selector === "[data-quote-slot]" ? quoteNodes : selector === "[data-motif]" ? motifNodes : selector === 'a[href="?resume=1"]' ? resumeLinks : [], addEventListener(type, handler) { documentHandlers[type] = handler; }, body: { classList: { add(value) { bodyClasses.add(value); }, remove(value) { bodyClasses.delete(value); } } } },
  window: { setTimeout(handler, delay) { scheduled.push({ handler, delay }); }, matchMedia: () => ({ matches: reducedMotion }), print() { printCalls += 1; } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "script.js"), "utf8"), context);

test("Chicago age changes at 03:59 on the birthday, irrespective of viewer timezone", () => {
  const age = context.window.siteAgeAt;
  assert.equal(age(new Date("2026-08-18T08:58:59Z")), 17);
  assert.equal(age(new Date("2026-08-18T08:59:00Z")), 18);
  assert.equal(age(new Date("2027-08-18T08:58:59Z")), 18);
  assert.equal(age(new Date("2027-08-18T08:59:00Z")), 19);
});

test("CURRENTLY clock shows live Chicago seconds in summer and winter", () => {
  const clock = context.window.siteChicagoClockAt;
  assert.equal(clock(new Date("2026-09-24T16:11:42Z")), "sep 24, 2026 11:11:42");
  assert.equal(clock(new Date("2026-12-24T17:11:42Z")), "dec 24, 2026 11:11:42");
  assert.match(element("#chicago-clock").textContent, /\d\d:\d\d:\d\d$/);
  assert.ok(scheduled.some(({ delay }) => delay > 0 && delay <= 1020));
});

test("CURRENTLY omits empty fields and stays out of the résumé", () => {
  const current = element("#currently-list").innerHTML;
  assert.equal((current.match(/<dt>/g) || []).length, 5);
  assert.ok(!current.includes("thinking about"));
  assert.ok(current.includes("Houston"));
  assert.ok(!element("#resume-content").innerHTML.includes("CURRENTLY"));
  assert.ok(css.includes("@media print"));
  assert.match(css, /@media print[\s\S]*\.page-shell[^}]*display:none!important/);
});

test("every in-page anchor has a target", () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(targets.length > 10);
  for (const target of targets) assert.ok(ids.has(target), `Missing #${target}`);
});

test("homepage sections and contents follow the curated order", () => {
  const sectionIds = [...html.matchAll(/<section id="([^"]+)" class="doc-section /g)].map((match) => match[1]);
  assert.deepEqual(sectionIds, ["about", "education", "projects", "knowledge", "writing", "programs", "contact"]);
  const contents = html.split('<ol id="contents-list">')[1].split("</ol>")[0];
  const anchors = [...contents.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(anchors, sectionIds);
  assert.doesNotMatch(html, /id="(?:history|experience|interests|volunteer)"|href="#(?:history|experience|interests|volunteer)"/);
  assert.match(html, /id="program-list"[^]*?class="community-placeholder"/);
});

test("static assets resolve beneath the GitHub Pages project path", () => {
  const base = "https://clarezahermetica.github.io/243165/";
  const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
    .filter((value) => /^(?:assets\/|(?:content|script)\.js(?:\?[^#]*)?$|styles\.css(?:\?[^#]*)?$|index\.html$)/.test(value));
  assert.ok(localAssets.length >= 4);
  for (const asset of localAssets) {
    assert.ok(new URL(asset, base).pathname.startsWith("/243165/"), `Wrong site path: ${asset}`);
    assert.ok(fs.existsSync(path.join(root, asset.split(/[?#]/)[0])), `Missing asset: ${asset}`);
  }
  const tracks = context.window.siteContent.music.tracks;
  assert.equal(tracks.length, 17);
  for (const track of tracks) {
    assert.ok(track.title && !/\[track\]/.test(track.title));
    assert.ok(new URL(track.src, base).pathname.startsWith("/243165/assets/music/"));
    assert.ok(fs.existsSync(path.join(root, track.src)), `Missing song: ${track.src}`);
  }
  assert.ok(fs.existsSync(path.join(root, ".nojekyll")));
});

test("real contact links and printable content are rendered from one data source", () => {
  assert.equal(element("#email-link").href, "mailto:asemotadana@gmail.com");
  assert.equal(element("#github-link").href, "https://github.com/clarezahermetica");
  assert.match(element("#resume-contact").innerHTML, /clarezahermetica/);
  assert.match(element("#resume-content").innerHTML, /Cypress Springs High School/);
  assert.match(element("#instagram-slot").innerHTML, /https:\/\/www\.instagram\.com\/08clareza/);
  assert.match(element("#substack-slot").innerHTML, /https:\/\/243165\.substack\.com\//);
  assert.match(element("#x-slot").innerHTML, /https:\/\/x\.com\/88clareza/);
  const contact = html.slice(html.indexOf('id="contact"'), html.indexOf('class="bottom-drawer"'));
  assert.doesNotMatch(contact, /<li>|transmission ends|\d\d \/ /);
});

test("the regular website renders the complete personal biography and three tap/focus secrets", () => {
  const biography = element("#about-biography").innerHTML;
  assert.equal((biography.match(/<p(?: class="body-placeholder")?>/g) || []).length, context.window.siteContent.profile.about.paragraphs.length);
  assert.match(biography, /hi, i&#39;m dana! : \) i&#39;m an 18 year old independent researcher and/);
  assert.match(biography, /aspiring founder/);
  assert.match(css, /\.about-biography\{text-transform:none\}/);
  assert.match(biography, /we&#39;ll see how far that gets me\. : \)/);
  assert.equal((biography.match(/class="bio-secret"/g) || []).length, 3);
  assert.match(biography, /big dreams and a head that&#39;s too small/);
  assert.match(biography, /currently accepting donations of computing power and optimism :3/);
  assert.match(biography, /my laptop and i are both trying our best/);
  assert.doesNotMatch(biography, /professional summary|language-model development and evaluation/);
  assert.match(context.window.siteContent.profile.intro, /building little things in pursuit of large things.*stars :3/);
});

test("bio notes toggle on tap and close with Escape", () => {
  const biography = element("#about-biography");
  const buttons = [0, 1, 2].map(() => ({
    attrs: new Map(), closest() { return this; },
    getAttribute(name) { return this.attrs.get(name); },
    setAttribute(name, value) { this.attrs.set(name, value); }
  }));
  biography.contains = (button) => buttons.includes(button);
  biography.querySelectorAll = () => buttons;
  biography.handlers.click({ target: buttons[0] });
  assert.equal(buttons[0].getAttribute("aria-expanded"), "true");
  biography.handlers.click({ target: buttons[1] });
  assert.equal(buttons[0].getAttribute("aria-expanded"), "false");
  assert.equal(buttons[1].getAttribute("aria-expanded"), "true");
  documentHandlers.keydown({ key: "Escape" });
  assert.equal(buttons[1].getAttribute("aria-expanded"), "false");
  assert.match(css, /\.bio-secret:focus-visible>\.secret-tip/);
});

test("print résumé uses only the professional summary and retains plain text sections", () => {
  const printed = element("#resume-content").innerHTML;
  assert.match(printed, /<h2>professional summary<\/h2>/);
  assert.match(printed, /Independent researcher and aspiring founder working on language-model development and evaluation/);
  assert.match(printed, /longstanding interest in astrophysics and philosophy/);
  assert.doesNotMatch(printed, /i&#39;m dana|large ideas|computing power and optimism|why\?|bio-secret|<button/);
  for (const heading of ["Education", "Experience", "Projects", "Skills", "Programs / events", "Volunteer / community"]) assert.match(printed, new RegExp(`<h2>${heading.replaceAll("/", "\\/")}</h2>`));
  assert.doesNotMatch(printed, /Writing \/ research|\[essay \/ note \/ paper title\]/);
  assert.match(printed, /Cypress Springs High School.*2022–2026 · Class of 2026.*High school diploma/);
  assert.doesNotMatch(printed, /ditched a full-ride scholarship|need teammates|i don&#39;t bite|\[email me/);
  assert.match(printed, /Cal Hacks 13\.0.*October 23–25, 2026.*Accepted — upcoming.*San Francisco, California/);
  assert.match(printed, /Python · JavaScript · TypeScript · C\+\+ · HTML · CSS/);
  assert.match(css, /@media print[\s\S]*\.page-shell[^}]*display:none!important/);
  assert.match(css, /@media print[\s\S]*\.resume-page[^}]*display:block!important/);
  assert.doesNotMatch(printed, /<img|<svg|<canvas/);
});

test("knowledge stays in the existing three columns and print includes only worked-with skills", () => {
  const data = context.window.siteContent.knowledge;
  const section = html.slice(html.indexOf('id="knowledge"'), html.indexOf('id="writing"'));
  const know = element("#know-list").innerHTML;
  const dontKnow = element("#dont-know-list").innerHTML;
  const questions = element("#want-know-list").innerHTML;
  const printedSkills = element("#resume-content").innerHTML.split("<h2>Skills</h2>")[1].split("</section>")[0];
  assert.equal((section.match(/class="knowledge-column"/g) || []).length, 3);
  assert.match(section, /i don't know <span class="secret-target"/);
  assert.match(section, /an honest inventory is allowed to have blanks/);
  assert.match(section, /i don't know[^]*?<\/h3><div class="knowledge-note">\/\/ worked with; still learning<\/div>/);
  assert.match(section, /i make things because i have questions\./);
  assert.match(section, /being explicit about the question is part of the work/);
  assert.equal(know, "");
  assert.equal(dontKnow, "");
  assert.equal(questions, "");
  assert.deepEqual(Array.from(data.know), []);
  assert.deepEqual(Array.from(data.dontKnow), []);
  assert.deepEqual(Array.from(data.wantToKnow.questions), []);
  assert.equal((printedSkills.match(/<p>/g) || []).length, context.window.siteContent.resume.skills.length);
  assert.match(printedSkills, /React · Next\.js · Chrome APIs · Manifest V3/);
  assert.doesNotMatch(printedSkills, /rlhf|self-model|black holes|an honest inventory|i make things because|being explicit about the question/);
  assert.doesNotMatch(section, /broader interests/);
});

test("website education stays unchanged while Cal Hacks has a contactable teammate secret", () => {
  const data = context.window.siteContent;
  assert.equal(data.profile.education.class, "class of 2026 · high school diploma");
  assert.equal(data.profile.education.note, "ditched a full-ride scholarship to my dream school to research, create, and build. we'll see how that goes. : )");
  const educationSection = html.slice(html.indexOf('id="education"'), html.indexOf('id="projects"'));
  assert.doesNotMatch(educationSection, /Cypress Springs High School|2022–2026/);
  const programs = element("#program-list").innerHTML;
  assert.match(programs, /Cal Hacks 13\.0.*Accepted — upcoming.*October 23–25, 2026.*San Francisco, California/s);
  assert.match(programs, /\[need teammates\?\]/);
  assert.match(programs, /mailto:asemotadana@gmail\.com\?subject=Cal%20Hacks%2013\.0%20teammates/);
  assert.match(programs, /\[email me ↗\]/);
  assert.match(element("#writing-list").innerHTML, /\[essay \/ note \/ paper title\]/);
});

test("the three factual experience entries remain only in the résumé", () => {
  const entries = context.window.siteContent.experience;
  const printed = element("#resume-content").innerHTML;
  const printedExperience = printed.split("<h2>Experience</h2>")[1].split("</section>")[0];
  const escaped = (value) => value.replaceAll("&", "&amp;").replaceAll("'", "&#39;");
  assert.equal(entries.length, 3);
  assert.deepEqual(Array.from(entries, ({ organization, role, dates, bullets }) => [organization, role, dates, bullets.length]), [
    ["Speech & Debate", "Competitor, peer speech coach & mentor", "2022–2026", 4],
    ["Esports Team", "Founding secretary → president", "2024–2026", 5],
    ["Philosophy Club", "Vice president", "2025–2026", 5]
  ]);
  assert.doesNotMatch(html, /id="experience"|id="experience-list"|href="#experience"/);
  assert.equal((printedExperience.match(/class="resume-entry"/g) || []).length, 3);
  for (const entry of entries) {
    for (const value of [entry.organization, entry.role, entry.dates, ...entry.bullets]) {
      assert.ok(printedExperience.includes(escaped(value)), `Résumé missing ${value}`);
    }
  }
  assert.doesNotMatch(printedExperience, /Cypress Springs High School|Philosophy Club.*founder|awarded|won/i);
  assert.equal((printed.match(/Cypress Springs High School/g) || []).length, 1);
  assert.deepEqual(Array.from(context.window.siteContent.changelog), ["v0.1 — file created", "v0.2 — opened it up", "v0.3 — moved more things around"]);
});

test("Landling replaces only project 01 and prints a concise CP2 record", () => {
  const project = context.window.siteContent.projects[0];
  const website = element("#project-list").innerHTML;
  const first = website.split('<article class="project-entry">')[1].split("</article>")[0];
  const printed = element("#resume-content").innerHTML;
  const printedProjects = printed.split("<h2>Projects</h2>")[1].split("</section>")[0];
  assert.equal(project.name, "landling");
  assert.equal(project.status, "cp2 public · cp3 in progress");
  assert.match(first, /\.\/projects\/01\/.*<h3>landling <span class="secret-target active-project-marker"/s);
  assert.match(first, /currently working on this/);
  assert.equal((website.match(/class="secret-target active-project-marker"/g) || []).length, 1);
  assert.match(first, /experimental persona model, not nick land himself/);
  assert.match(first, /1,018 effective conversational examples/);
  assert.equal((first.match(/class="project-history-list"/g) || []).length, 1);
  for (const version of ["v1", "v2", "3.0-cp1", "3.0-cp2", "3.0-cp3"]) assert.ok(first.includes(`<strong>${version}</strong>`));
  assert.match(first, /3\.0-cp3.*in progress.*no cp3 checkpoint has been published/s);
  for (const method of project.methods) assert.ok(first.includes(method), `Missing ${method}`);
  assert.match(first, /href="https:\/\/github\.com\/clarezahermetica\/landling"[^>]*>\[source \/ github ↗\]<\/a>/);
  assert.match(first, /href="https:\/\/huggingface\.co\/clarezahermetica\/landling-3\.0-cp2"[^>]*>\[checkpoint \/ hugging face ↗\]<\/a>/);
  assert.match(first, /\[a rather lengthy account of how this got out of hand is forthcoming\.\]/);
  assert.match(first, /\[project image \/ artifact goes here\]/);
  assert.match(website, /\[project name 02\].*\[project name 03\]/s);
  assert.equal(context.window.siteContent.memotifs.tooltips.projects, "only the first little buds. more things are growing. ♡");
  assert.doesNotMatch(html, /work will go here; the scaffolding is real/);
  assert.match(printedProjects, /<strong>landling<\/strong><span>2026–present<\/span>/);
  assert.match(printedProjects, /Language-model persona development.*Qwen2\.5-7B-Instruct QLoRA adapter.*1,018 conversational training examples.*model evaluation/s);
  assert.match(printedProjects, /href="https:\/\/github\.com\/clarezahermetica\/landling"/);
  assert.match(printedProjects, /href="https:\/\/huggingface\.co\/clarezahermetica\/landling-3\.0-cp2"/);
  assert.doesNotMatch(printedProjects, /3\.0-cp3|v1|v2|mindless rambles|rather lengthy account|only the first little buds/);
});

test("Cal Hacks teammate note toggles on click and closes with Escape", () => {
  const programList = element("#program-list");
  const button = { attrs: new Map(), closest() { return this; }, getAttribute(name) { return this.attrs.get(name); }, setAttribute(name, value) { this.attrs.set(name, value); } };
  programList.contains = (node) => node === button;
  programList.querySelectorAll = () => [button];
  programList.handlers.click({ target: button });
  assert.equal(button.getAttribute("aria-expanded"), "true");
  programList.handlers.click({ target: button });
  assert.equal(button.getAttribute("aria-expanded"), "false");
  programList.handlers.click({ target: button });
  documentHandlers.keydown({ key: "Escape" });
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.match(css, /\.teammate-invite:focus-within \.teammate-message/);
});

test("the document opens as a small homepage and quote slots are dispersed", () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 2); // small homepage identity + separate résumé
  assert.match(html, /<h1 class="masthead-name">/);
  assert.doesNotMatch(html, /a place to put<br>/);
  const slots = [...html.matchAll(/data-quote-slot="(\d)"/g)];
  assert.deepEqual(slots.map((match) => match[1]), ["0", "1", "3", "2", "4"]);
  assert.ok(slots[0].index < html.indexOf('id="education"'));
  assert.ok(slots[1].index > html.indexOf('id="projects"'));
  assert.ok(slots[2].index > html.indexOf('id="knowledge"'));
  assert.ok(slots[3].index > html.indexOf('id="writing"'));
  assert.ok(slots[4].index > html.indexOf('id="contact"'));
  assert.match(element("#project-list").innerHTML, /\.\/projects\/01\//);
  assert.match(quoteNodes[0].textContent, /Space echoes.*Nick Land/);
  assert.match(quoteNodes[1].textContent, /Rules for happiness.*Immanuel Kant/);
  assert.equal(quoteNodes[2].textContent, "");
  assert.match(quoteNodes[3].textContent, /Only prisoners.*Mark Fisher/);
  assert.match(quoteNodes[4].textContent, /miracle of a single flower.*unknown/);
  assert.match(motifNodes[0].textContent, /a little more than a short bio/);
});

test("future rooms remain placeholders and the player has local files without autoplay", () => {
  assert.doesNotMatch(html, /id="interests"|id="interests-list"/);
  assert.match(element("#future-rooms").innerHTML, /goodreads knockoff.*photogallery/);
  assert.equal(element("#music-button").disabled, false);
  assert.equal(element("#music-next").disabled, false);
  assert.equal(element("#music-audio").paused, true);
  assert.equal(context.window.siteContent.music.tracks.length, 17);
  for (const track of context.window.siteContent.music.tracks) {
    const file = path.join(root, track.src);
    assert.ok(fs.existsSync(file), `${track.src} is missing`);
    assert.equal(fs.readFileSync(file).subarray(0, 3).toString("ascii"), "ID3");
  }
  assert.doesNotMatch(html, /<audio[^>]*\bautoplay\b/i);
});

test("why prose stays archived in data without a homepage disclosure", () => {
  assert.equal(context.window.siteContent.whyLayers.length, 4);
  assert.doesNotMatch(html, /id="history"|id="why-content"|href="#history"/);
});

test("music shuffle excludes the current track and slightly weights Artificial Angels", async () => {
  const tracks = context.window.siteContent.music.tracks;
  const pick = context.window.sitePickMusicIndex;
  const angel = tracks.findIndex(({ title }) => /artificial angels/i.test(title));
  assert.ok(angel >= 0);
  for (let index = 0; index < tracks.length; index += 1) assert.notEqual(pick(index, () => 0.5), index);
  const counts = tracks.map(() => 0);
  for (let i = 0; i < 17300; i += 1) counts[pick(-1, () => (i + .5) / 17300)] += 1;
  assert.ok(counts[angel] > counts[0]);
  const audio = element("#music-audio");
  const first = audio.src;
  await element("#music-button").handlers.click();
  assert.equal(audio.paused, false);
  assert.equal(element("#music-button").textContent, "[pause]");
  element("#music-next").handlers.click();
  assert.notEqual(audio.src, first);
  const second = audio.src;
  audio.handlers.ended();
  assert.notEqual(audio.src, second);
  await element("#music-button").handlers.click();
  assert.equal(audio.paused, true);
});

test("personal copy and tiny cleanup stay in place", () => {
  assert.equal(context.window.siteContent.metadata.version, "0.3");
  assert.deepEqual(Array.from(context.window.siteContent.changelog), ["v0.1 — file created", "v0.2 — opened it up", "v0.3 — moved more things around"]);
  assert.match(element("#currently-list").innerHTML, /scheming.*citation needed.*evidence withheld :3/);
  assert.match(element("#project-list").innerHTML, /<details class="project-ramble">/);
  assert.equal((element("#project-list").innerHTML.match(/\(mindless rambles\)/g) || []).length, 3);
  assert.match(html, /lastrecordedvideoofme\.gif/);
  assert.match(html, /hello world/);
  assert.match(html, /tended<br>/);
  assert.doesNotMatch(html, /ai assisted|hello, internet|notes on knowing things <span|interests\.txt <span/);
});

test("résumé links shake briefly, open the dialog, and print only on the real button", () => {
  assert.equal(resumeLinks.length, 3);
  let prevented = false;
  resumeLinks[0].handlers.click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(bodyClasses.has("resume-shake"), true);
  assert.equal(element("#resume-dialog").open, false);
  scheduled.find(({ delay }) => delay === 165).handler();
  assert.equal(element("#resume-dialog").open, true);
  assert.equal(bodyClasses.has("resume-shake"), false);
  element("#dialog-print").handlers.click();
  assert.equal(element("#resume-dialog").open, false);
  assert.equal(printCalls, 1);
  assert.match(html, /id="resume-download" aria-disabled="true"/);
  assert.doesNotMatch(html, /id="resume-download"[^>]*href=/);
  reducedMotion = true;
  resumeLinks[1].handlers.click({ preventDefault() {} });
  assert.equal(element("#resume-dialog").open, true);
  assert.equal(bodyClasses.has("resume-shake"), false);
  element("#resume-close").handlers.click();
  assert.equal(element("#resume-dialog").open, false);
});

test("small click secrets toggle without touching content", () => {
  element("#star-toggle").handlers.click();
  assert.equal(element("#star-toggle").textContent, "★");
  assert.equal(element("#star-toggle").getAttribute("aria-pressed"), "true");
  element("#star-toggle").handlers.click();
  assert.equal(element("#star-toggle").textContent, "☆");
  element("#debris-cycle").handlers.click();
  assert.equal(element("#debris-face").textContent, ":3");
});

test("the supplied local GIF and exact-shaped ASCII shrine are present", () => {
  const gif = fs.readFileSync(path.join(root, "assets", "princess-bubblegum-science-tags.gif"));
  assert.equal(gif.subarray(0, 6).toString("ascii"), "GIF89a");
  assert.match(html, /assets\/princess-bubblegum-science-tags\.gif/);
  const art = html.match(/<pre class="ascii-shrine"[^>]*>([\s\S]*?)<\/pre>/)?.[1];
  assert.ok(art);
  assert.equal(art.split("\n").length, 22);
  assert.ok(art.startsWith("⠀⠀⠀⠀⠀⠀⠀⠘⠃"));
  assert.ok(art.endsWith("⠈⠹⠁⠀⠀⠀⠀⠀⠀⠀⠀"));
});

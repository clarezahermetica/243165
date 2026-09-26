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
const mediaHandlers = {};
let reducedMotion = false;
let printCalls = 0;
function element(selector) {
  if (!elements.has(selector)) {
    const node = {
      textContent: "", innerHTML: selector === "#about-biography" ? html.match(/<div id="about-biography" class="about-biography">([^]*?)<\/div><div class="wiki-note">/)[1] : "", hidden: false, href: "", dateTime: "",
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
  window: { setTimeout(handler, delay) { scheduled.push({ handler, delay }); }, matchMedia: () => ({ get matches() { return reducedMotion; }, addEventListener(type, handler) { mediaHandlers[type] = handler; } }), print() { printCalls += 1; } }
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
  assert.equal((current.match(/<dt>/g) || []).length, 8);
  assert.match(current, /<dt>building<\/dt><dd><\/dd>/);
  assert.match(current, /red plenty — francis spufford/);
  assert.match(current, /sardu \/ עברית.*\[slacking off\].*progress has been\.\.\. intermittent :3/);
  assert.match(current, /<a href="https:\/\/m\.imbc\.com\/program\/1006897100000100000" target="_blank" rel="noopener noreferrer">연애기숙학교 돌싱N모솔<\/a>/);
  assert.match(current, /<dt>avoiding<\/dt><dd>the real world<\/dd>/);
  assert.match(current, /scheming.*\[citation needed\]/);
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
  assert.deepEqual(sectionIds, ["about", "education", "plans", "projects", "knowledge", "writing", "programs", "contact"]);
  const contents = html.split('<ol id="contents-list">')[1].split("</ol>")[0];
  const anchors = [...contents.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(anchors, sectionIds);
  assert.doesNotMatch(html, /id="(?:history|experience|interests|volunteer)"|href="#(?:history|experience|interests|volunteer)"/);
  assert.match(html, /id="program-list"[^]*?id="volunteer-list"/);
  assert.equal(context.window.siteContent.plans.length, 2);
  assert.match(element("#plans-list").innerHTML, /<details class="plan-entry"><summary>the foreseeable future[^]*?<details class="plan-entry"><summary>further afield/);
  assert.equal((element("#plans-list").innerHTML.match(/<details class="plan-entry">/g) || []).length, 2);
  assert.match(html, /id="about"[^]*?id="education"[^]*?id="plans"[^]*?id="projects"/);
  assert.match(html, /<h2 class="plain-title document-heading">academics<\/h2>[^]*?class="plain-title document-heading">future tense/);
  assert.match(css, /\.document-heading\{border-bottom:1px solid #777/);
  assert.match(css, /\.education-section \.plain-title,\.plans-section \.plain-title\{text-decoration:underline/);
  assert.match(html, /things i know, more or less<span id="knowledge-title-note"/);
  assert.match(html, /skills, basically\. technically i know all of these; this is more of a confidence \/ familiarity gradient :3/);
  assert.match(html, /assorted affiliations &amp; encounters/);
  assert.doesNotMatch(html, /assorted institutional entanglements/);
  assert.match(css, /\.about-section\{border-bottom:0;/);
  assert.match(css, /\.wiki-title\{[^}]*border-bottom:1px solid #777/);
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

test("the homepage shows the supplied short About copy with three phrase secrets", () => {
  const biography = element("#about-biography").innerHTML;
  assert.match(biography, /hi, i'm <button[^]*?>dana<\/span>[^]*?! : \) i&#39;m an <button[^]*?aspiring[^]*?independent researcher and founder working primarily in machine learning/);
  assert.equal((biography.match(/<p(?:\s|>)/g) || []).length, 2);
  assert.match(biography, /i&#39;m an <button[^]*?aspiring[^]*?independent researcher and founder working primarily in machine learning/);
  assert.match(biography, /there&#39;s something we can build together\. : \)/);
  assert.doesNotMatch(biography, /aspiring founder|large ideas/);
  assert.equal(context.window.siteContent.profile.about.showOnHomepage, true);
  assert.equal(context.window.siteContent.profile.about.paragraphs.length, 2);
  assert.equal(context.window.siteContent.profile.about.archivedParagraphs.length, 9);
  assert.equal(context.window.siteContent.profile.about.secrets.length, 3);
  assert.equal((biography.match(/class="bio-secret"/g) || []).length, 3);
  assert.match(css, /\.about-biography\{text-transform:none\}/);
  assert.equal(context.window.siteContent.profile.intro, "i make things to find out what happens.");
  assert.match(html, /hello world!/);
  assert.match(html, /<figcaption>me\.gif<\/figcaption>/);
});

test("locked About and Future Tense copy retains its paragraphs and punctuation", () => {
  const data = context.window.siteContent;
  assert.deepEqual(Array.from(data.profile.about.paragraphs), [
    "i'm an aspiring independent researcher and founder working primarily in machine learning, with an interest in embodied intelligence and a longstanding soft spot for astrophysics. most of my time is spent reading, experimenting, and trying to build things with my uncooperative laptop.",
    "i'm always happy to meet people working on interesting things, especially if there's something we can build together. : )"
  ]);
  assert.deepEqual(Array.from(data.profile.about.secrets, ({ phrase, note }) => [phrase, note]), [
    ["aspiring", "emphasis on aspiring. this word is currently doing a LOT of heavy lifting."],
    ["reading", "(and scrolling on twitter. but that counts, doesn't it?)"],
    ["my uncooperative laptop", "currently accepting donations for a macbook /j"]
  ]);
  assert.deepEqual(Array.from(data.plans, ({ heading, paragraphs, closing }) => [heading, Array.from(paragraphs), closing]), [
    ["the foreseeable future", [
      "for now, i'd like to continue working on my technical abilities, explore other areas of machine learning, and actually get better at hardware (lol). i want to make the most of whatever resources are available to me, learn from people who know more than i do, and follow my questions into experiments, specifically ones that are a little beyond my ability to pull off.",
      "i'd like to get my feet wet, make mistakes, figure out what went wrong, learn something from my mistakes, and (inevitably) find myself in deeper water. eventually, something will go right! and i'll mistake this small victory for proof of my extraordinary genius, allow my ego to inflate to the size of a weather balloon, and meet reality armed with a fat needle. probably an annoying and painful process, but such is life! that's how anyone learns anything worth knowing."
    ], undefined],
    ["further afield", [
      "i'd like to work on more ambitious ai models that can interact with and learn from the physical world and bring up questions about learning, identity, and agency. beyond language models, there's a whole world of embodied intelligence that i'd love to get my hands on. there's no shortage of things to investigate along the way, and hopefully i'll find other curious people to build and experiment with",
      "eventually, i'd like to found a research lab of my own. what would it specialize in? GREAT question ^_^; i'd love to know too! i imagine the particulars will become clear once i've developed my skills, gained more experience, and built enough things to have a better idea of what i'm capable of. i'd rather work toward having the knowledge and experience to make that decision than rush into making it before i know what i'm doing."
    ], "sorry for not taking the 16-year-old stanford dropout → b2b saas founder route. the scenic route looks cooler anyway. :3"]
  ]);
  assert.match(element("#plans-list").innerHTML, /<em>a little<\/em>/);
  assert.match(element("#plans-list").innerHTML, /<p class="plan-closing"><em>sorry for not taking/);
  assert.doesNotMatch(element("#resume-content").innerHTML, /weather balloon|scenic route/);
});

test("bio notes retain their tap and Escape behavior", () => {
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

test("Dana's slot flickers briefly, pauses, and stays static with reduced motion", () => {
  const button = element("#dana-slot");
  const script = element("#dana-script");
  const forms = ["dana", "дана", "檀那", "दाना", "다나", "だんな", "דָּנָה"];
  assert.match(html, /id="dana-slot"[^>]*aria-label="Dana" aria-pressed="false" aria-describedby="dana-slot-note"/);
  assert.match(html, /id="dana-script" aria-hidden="true">dana/);
  assert.match(html, /multilingual\. or at least trying to be :3/);
  assert.match(css, /\.dana-slot\{[^}]*color:var\(--pink-4\)/);
  assert.match(css, /\.secret-target:focus-visible/);
  const firstBurst = scheduled.findIndex(({ delay }) => delay >= 3000 && delay <= 5000);
  assert.ok(firstBurst >= 0);
  scheduled[firstBurst].handler();
  let cursor = firstBurst + 1;
  for (let frame = 0; frame < 6; frame += 1) {
    const next = scheduled.findIndex(({ delay }, index) => index >= cursor && delay === 55);
    assert.ok(next >= 0);
    scheduled[next].handler();
    cursor = next + 1;
  }
  assert.ok(forms.includes(script.textContent));
  assert.notEqual(script.textContent, "dana");
  button.handlers.click();
  assert.equal(button.getAttribute("aria-pressed"), "true");
  const frozen = script.textContent;
  const pending = scheduled.findIndex(({ delay }, index) => index >= cursor && delay >= 3000 && delay <= 5000);
  assert.ok(pending >= 0);
  scheduled[pending].handler();
  assert.equal(script.textContent, frozen);
  button.handlers.click();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  reducedMotion = true;
  mediaHandlers.change();
  assert.equal(script.textContent, "dana");
  button.handlers.click();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  reducedMotion = false;
  mediaHandlers.change();
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
  const wantKnow = element("#want-know-list").innerHTML;
  const printedSkills = element("#resume-content").innerHTML.split("<h2>Skills</h2>")[1].split("</section>")[0];
  assert.equal((section.match(/class="knowledge-column"/g) || []).length, 3);
  assert.match(section, /i don't know <span class="secret-target"/);
  assert.match(section, /an honest inventory is allowed to have blanks/);
  assert.match(section, /i don't know[^]*?<\/h3><div class="knowledge-note">\/\/ worked with; still learning<\/div>/);
  assert.match(section, /technically i know all of these/);
  assert.match(section, /being explicit about the question is part of the work/);
  assert.equal((know.match(/class="knowledge-row"/g) || []).length, 6);
  assert.equal((dontKnow.match(/class="knowledge-row"/g) || []).length, 6);
  assert.equal((wantKnow.match(/class="knowledge-row"/g) || []).length, 5);
  assert.match(know, /Python · JavaScript · TypeScript · C\+\+ · HTML · CSS · React · Next\.js/);
  assert.match(know, /\[VERY rusty\][^]*?don&#39;t count on this\. last time i touched any of this i was 11/);
  assert.match(dontKnow, /Rust · memory management · concurrency/);
  assert.match(wantKnow, /Vision-language-action models · diffusion policies/);
  assert.doesNotMatch(know + dontKnow + wantKnow, /knowledge-group|<strong>programming|<strong>machine learning/);
  assert.equal((printedSkills.match(/<p>/g) || []).length, context.window.siteContent.resume.skills.length);
  assert.match(printedSkills, /React · Next\.js · Chrome APIs · Manifest V3/);
  assert.doesNotMatch(printedSkills, /RLHF|Vision-language-action|VERY rusty|PCB design|confidence|POMDPs/);
  assert.doesNotMatch(section, /broader interests/);
});

test("academics contains the exact scores while Cal Hacks keeps its teammate secret", () => {
  const data = context.window.siteContent;
  assert.equal(data.profile.education.class, "class of 2026");
  assert.equal(data.profile.education.credential, "high school diploma");
  const educationSection = html.slice(html.indexOf('id="education"'), html.indexOf('id="projects"'));
  assert.doesNotMatch(educationSection, /Cypress Springs High School|2022–2026/);
  const academic = element("#academics-detail").innerHTML;
  for (const item of data.academics.coursework) {
    const [name, score] = item.split(" — ");
    assert.ok(academic.includes(`<dt>${name}</dt><dd>${score}</dd>`));
  }
  assert.match(academic, /AP Physics C<\/dt><dd>5/);
  assert.match(academic, /Three-time UIL qualifier\./);
  assert.doesNotMatch(academic, /<details|<summary|<button/);
  assert.doesNotMatch(academic, /Physics C: Mechanics|Physics C: Electricity/);
  assert.match(academic, /Two-time NSDA Nationals qualifier/);
  const programs = element("#program-list").innerHTML;
  assert.match(programs, /Cal Hacks 13\.0.*Accepted — upcoming.*October 23–25, 2026.*San Francisco, California/s);
  assert.match(programs, /\[need teammates\?\]/);
  assert.match(programs, /mailto:asemotadana@gmail\.com\?subject=Cal%20Hacks%2013\.0%20teammates/);
  assert.match(programs, /\[email me ↗\]/);
  assert.equal(element("#writing-list").innerHTML, "");
  assert.equal(element("#writing-empty").hidden, false);
});

test("résumé receives academics and real volunteering without homepage-only inventory", () => {
  const printed = element("#resume-content").innerHTML;
  const education = printed.split("<h2>Education</h2>")[1].split("</section>")[0];
  const volunteer = printed.split("<h2>Volunteer / community</h2>")[1].split("</section>")[0];
  for (const score of context.window.siteContent.academics.coursework) assert.ok(education.includes(score), `Missing ${score}`);
  for (const award of context.window.siteContent.academics.distinctions) assert.ok(education.includes(award.replaceAll("&", "&amp;")), `Missing ${award}`);
  assert.match(education, /Three-time UIL qualifier\./);
  assert.match(education, /Cypress Springs High School.*2022–2026 · Class of 2026.*High school diploma/);
  assert.match(volunteer, /Turtle Island Restoration Network.*2022–2024.*Volunteer · Galveston, Texas/);
  assert.match(volunteer, /Houston Public Library.*2022.*Volunteer · Houston, Texas/);
  assert.doesNotMatch(printed, /VERY rusty|PCB design|weather balloon|scenic route|more time for work that matters|RLHF|POMDPs/);
  assert.doesNotMatch(printed, /Can a Machine Believe\?/);
  assert.equal((education.match(/Two-time NSDA Nationals qualifier/g) || []).length, 1);
  assert.match(css, /@media print\{[^]*?\.resume-section\{break-inside:auto\}/);
  assert.match(element("#volunteer-list").innerHTML, /Turtle Island Restoration Network[^]*?Houston Public Library/);
  assert.equal(element("#volunteer-note").textContent, "// i'd like to make more time for work that matters outside my own little corner of the internet. more soon, hopefully. : )");
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

test("two real active projects render while the résumé keeps the detailed Landling record", () => {
  const project = context.window.siteContent.projects[0];
  const website = element("#project-list").innerHTML;
  const first = website.split('<article class="project-entry">')[1].split("</article>")[0];
  const printed = element("#resume-content").innerHTML;
  const printedProjects = printed.split("<h2>Projects</h2>")[1].split("</section>")[0];
  assert.equal(project.name, "landling");
  assert.equal(project.status, "cp2 public · cp3 in progress");
  assert.match(first, /\.\/projects\/01\/.*<h3>landling <span class="secret-target active-project-marker"/s);
  assert.match(first, /currently working on this/);
  assert.equal((website.match(/class="secret-target active-project-marker"/g) || []).length, 2);
  assert.doesNotMatch(first, /project-path-secret|missing image but emotionally present/);
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
  assert.match(website, /Can a Machine Believe\?[^]*?an independent research project investigating belief, agency, and identity in artificial systems\./);
  const second = website.split('<article class="project-entry project-entry-no-image">')[1].split("</article>")[0];
  assert.match(second, /\.\/projects\/02\/[^]*?<h3>Can a Machine Believe\? <span class="secret-target active-project-marker"/);
  assert.match(second, /<dt>status<\/dt><dd>in progress · study in development<\/dd><dt>summary<\/dt>/);
  assert.equal((second.match(/class="project-description"/g) || []).length, 1);
  assert.equal((second.match(/class="project-description"><p>/g) || []).length, 1);
  assert.match(second, /<details class="project-ramble"><summary>\(personal notes \/ writing\)<\/summary><\/details>/);
  assert.doesNotMatch(second, /<dt>(?:year|methods|links|history)<\/dt>|project-image|coming soon|more to come/);
  assert.doesNotMatch(website, /\[project name 02\]|\[project name 03\]/);
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
  assert.equal((element("#project-list").innerHTML.match(/\(personal notes \/ writing\)/g) || []).length, 2);
  assert.equal(element("#motif-reveal").textContent, "[nothing important. i just wanted you to find something.] 🪷");
  assert.match(html, /id="confetti-button" class="party-button">\[click me\]<\/button>/);
  assert.match(html, /<figcaption>me\.gif<\/figcaption>/);
  assert.match(html, /hello world!/);
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

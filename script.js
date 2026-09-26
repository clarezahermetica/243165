(() => {
  "use strict";
  const data = window.siteContent;
  if (!data) throw new Error("content.js must load before script.js");
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const knowledgeRows = (rows) => rows.map((row) => {
    const text = typeof row === "string" ? row : row.text;
    const annotation = row.annotation ? ` <span class="secret-target knowledge-annotation" tabindex="0" aria-describedby="rusty-note">${escapeHTML(row.annotation)}<span id="rusty-note" class="secret-tip" role="tooltip">${escapeHTML(row.note)}</span></span>` : "";
    return `<li class="knowledge-row">${escapeHTML(text)}${annotation}</li>`;
  }).join("");
  const safeUrl = (value) => {
    try { const url = new URL(value); return ["https:", "mailto:"].includes(url.protocol) ? url.href : ""; }
    catch { return ""; }
  };
  const pathValue = (path) => path.split(".").reduce((value, key) => value?.[key], {
    version: data.metadata.version, ...data.profile, volunteer: data.volunteer
  });
  const withAge = (value) => String(value ?? "").replaceAll("{age}", String(ageAt(new Date())));
  const musicTracks = (data.music.tracks ?? []).filter((track) => /^assets\/music\/[^?#]+\.mp3$/i.test(track.src) && !track.src.includes(".."));
  let currentTrackIndex = -1;
  function pickMusicIndex(previous, random = Math.random) {
    const choices = musicTracks.map((track, index) => ({ index, weight: /artificial angels/i.test(`${track.title} ${track.src}`) ? 1.3 : 1 }))
      .filter(({ index }) => musicTracks.length === 1 || index !== previous);
    if (!choices.length) return -1;
    const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
    let selection = Math.min(Math.max(random(), 0), 0.999999999999) * total;
    for (const choice of choices) { selection -= choice.weight; if (selection < 0) return choice.index; }
    return choices.at(-1).index;
  }
  window.sitePickMusicIndex = pickMusicIndex;
  function selectMusicTrack(index) {
    if (index < 0) return;
    currentTrackIndex = index;
    const track = musicTracks[index];
    $("#music-track").textContent = track.title;
    $("#music-audio").src = track.src;
    $("#music-button").textContent = "[play]";
    $("#music-status").textContent = "ready when you are ✧";
  }

  // Compare Chicago calendar parts, including the birth minute; the viewer's device timezone never enters the age calculation.
  const chicagoFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: data.metadata.birth.timeZone, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", hourCycle: "h23"
  });
  function ageAt(instant) {
    const parts = Object.fromEntries(chicagoFormatter.formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const birth = data.metadata.birth;
    const beforeBirthday = parts.month < birth.month ||
      (parts.month === birth.month && parts.day < birth.day) ||
      (parts.month === birth.month && parts.day === birth.day && parts.hour < birth.hour) ||
      (parts.month === birth.month && parts.day === birth.day && parts.hour === birth.hour && parts.minute < birth.minute);
    return parts.year - birth.year - Number(beforeBirthday);
  }
  window.siteAgeAt = ageAt; // Tiny diagnostic hook for the birthday-boundary check.
  let renderedBiographyAge = null;
  const aboutOpening = $("#about-biography").innerHTML;
  const ageArticleFor = (age) => (age === 8 || age === 11 || age === 18 || age === 19 || (age >= 80 && age < 90) ? "an" : "a");
  function renderBiography() {
    renderedBiographyAge = ageAt(new Date());
    if (!data.profile.about.showOnHomepage) {
      return;
    }
    const paragraphs = data.profile.about.paragraphs.map((paragraph) => {
      let content = escapeHTML(paragraph.replaceAll("{ageArticle}", ageArticleFor(renderedBiographyAge)).replaceAll("{age}", String(renderedBiographyAge))).replace(/\n/g, "<br>");
      data.profile.about.secrets.forEach((secret, secretIndex) => {
        const phrase = escapeHTML(secret.phrase);
        const tipId = `bio-tip-${secretIndex}`;
        content = content.replace(phrase, `<button type="button" class="bio-secret" aria-label="${phrase}" aria-describedby="${tipId}" aria-expanded="false">${phrase}<span id="${tipId}" class="secret-tip" role="tooltip">${escapeHTML(secret.note)}</span></button>`);
      });
      return content;
    });
    $("#about-biography").innerHTML = aboutOpening.replace(/<\/p>\s*$/, ` ${paragraphs[0]}</p>`) + paragraphs.slice(1).map((content) => `<p>${content}</p>`).join("");
  }
  function refreshAge() {
    const age = ageAt(new Date());
    $("#age").textContent = String(age);
    if (renderedBiographyAge !== age) {
      if (data.profile.about.paragraphs.some((paragraph) => paragraph.includes("{age"))) renderBiography();
      else renderedBiographyAge = age;
    }
  }
  function scheduleAgeRefresh() {
    refreshAge();
    // Wake just after each real minute boundary, so 03:59 Chicago changes the visible age promptly.
    window.setTimeout(() => { refreshAge(); scheduleAgeRefresh(); }, 60000 - (Date.now() % 60000) + 25);
  }
  const chicagoClockFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  function chicagoClockAt(instant) {
    const parts = Object.fromEntries(chicagoClockFormatter.formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${parts.month.toLowerCase()} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  }
  window.siteChicagoClockAt = chicagoClockAt;
  function refreshChicagoClock() {
    const now = new Date();
    const node = $("#chicago-clock");
    node.dateTime = now.toISOString();
    node.textContent = chicagoClockAt(now);
  }
  function scheduleChicagoClock() {
    refreshChicagoClock();
    window.setTimeout(scheduleChicagoClock, 1000 - (Date.now() % 1000) + 20);
  }

  function renderData() {
    document.querySelectorAll("[data-text]").forEach((element) => { element.textContent = withAge(pathValue(element.dataset.text)); });
    renderBiography();
    const prettyDate = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${data.metadata.lastUpdated}T12:00:00Z`));
    ["#header-updated", "#footer-updated"].forEach((selector) => { const node = $(selector); node.dateTime = data.metadata.lastUpdated; node.textContent = prettyDate; });
    $("#currently-list").innerHTML = data.currently.map((item, index) => {
      const value = item.valueFrom ? pathValue(item.valueFrom) : item.value;
      if (!item.showWhenEmpty && !String(value ?? "").trim()) return "";
      const url = safeUrl(item.url);
      const display = url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(value)}</a>` : escapeHTML(value);
      const note = item.citationNote ?? "evidence withheld :3";
      const citation = item.citation ? ` <span class="secret-target citation-needed" tabindex="0" aria-describedby="currently-note-${index}">${escapeHTML(item.citation)}<span id="currently-note-${index}" class="secret-tip" role="tooltip">${escapeHTML(note)}</span></span>` : "";
      return `<dt>${escapeHTML(item.label)}</dt><dd>${display}${citation}</dd>`;
    }).join("");
    $("#academics-detail").innerHTML = `<div class="academic-group academic-scores"><h3>coursework / scores</h3><dl>${data.academics.coursework.map((entry) => { const split = entry.lastIndexOf(" — "); return `<div><dt>${escapeHTML(entry.slice(0, split))}</dt><dd>${escapeHTML(entry.slice(split + 3))}</dd></div>`; }).join("")}</dl></div><div class="academic-group academic-activities"><h3>activities</h3>${data.academics.activities.map((entry) => `<p>${escapeHTML(entry)}</p>`).join("")}</div><div class="academic-group academic-distinctions"><h3>distinctions</h3>${data.academics.distinctions.map((entry) => `<p>${escapeHTML(entry)}</p>`).join("")}</div>`;
    $("#plans-list").innerHTML = data.plans.map(({ heading, paragraphs, closing }, index) => `<details class="plan-entry"><summary>${escapeHTML(heading)}<span class="plan-indicator" aria-hidden="true"></span></summary><div class="plan-prose">${paragraphs.map((paragraph, paragraphIndex) => {
      let content = escapeHTML(paragraph);
      if (index === 0 && paragraphIndex === 0) content = content.replace("a little", "<em>a little</em>");
      return `<p>${content}</p>`;
    }).join("")}${closing ? `<p class="plan-closing"><em>${escapeHTML(closing)}</em></p>` : ""}</div></details>`).join("");
    $("#project-list").innerHTML = data.projects.map((item, index) => {
      const path = `./projects/${String(index + 1).padStart(2, "0")}/`;
      const activeMarker = item.active ? ` <span class="secret-target active-project-marker" tabindex="0" aria-label="active project: currently working on this">✳<span class="secret-tip" aria-hidden="true">currently working on this : )</span></span>` : "";
      const links = Object.entries(item.links ?? {}).filter(([, url]) => safeUrl(url)).map(([label, url]) => `<a href="${escapeHTML(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.linkLabels?.[label] ?? `${label} ↗`)}</a>`).join("");
      const description = Array.isArray(item.description) ? item.description.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("") : escapeHTML(item.description);
      const history = Array.isArray(item.history) ? `<ol class="project-history-list">${item.history.map(({ version, note }) => `<li><strong>${escapeHTML(version)}</strong> — ${escapeHTML(note)}</li>`).join("")}</ol>` : escapeHTML(item.history);
      const field = (label, value, className = "") => value ? `<dt>${label}</dt><dd${className ? ` class="${className}"` : ""}>${value}</dd>` : "";
      return `<article class="project-entry${item.image ? "" : " project-entry-no-image"}"><div><div class="project-meta">drwxr-xr-x &nbsp; ${path} <span>♡</span></div><h3>${escapeHTML(item.name)}${activeMarker}</h3><dl class="project-details">${field("status", escapeHTML(item.status))}${field("year", escapeHTML(item.year))}${field("summary", escapeHTML(item.summary))}${field("details", description, "project-description")}${field("methods", (item.methods ?? []).map((method) => `<span>${escapeHTML(method)}</span>`).join(" "), "project-methods")}${field("links", links, "project-links")}${field("history", (item.history?.length ?? 0) ? history : "")}</dl>${item.ramble ? `<details class="project-ramble"><summary>(personal notes / writing)</summary><p>${escapeHTML(item.ramble)}</p></details>` : ""}</div>${item.image ? `<div class="project-image" role="img" aria-label="placeholder for a future project image">${escapeHTML(item.image)}</div>` : ""}</article>`;
    }).join("");
    $("#writing-list").innerHTML = data.writing.map((item) => `<li><span>${safeUrl(item.url) ? `<a href="${escapeHTML(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.title)} ↗</a>` : `<span class="archive-title">${escapeHTML(item.title)}</span>`}</span><span class="archive-kind">${escapeHTML(item.kind)}</span><time>${escapeHTML(item.date)}</time></li>`).join("");
    $("#writing-empty").hidden = data.writing.length > 0;
    $("#know-list").innerHTML = knowledgeRows(data.knowledge.know);
    $("#dont-know-list").innerHTML = knowledgeRows(data.knowledge.dontKnow);
    $("#want-know-list").innerHTML = knowledgeRows(data.knowledge.wantToKnow);
    $("#program-list").innerHTML = data.involvement.map((item, index) => {
      const invite = item.teammates;
      const email = invite ? safeUrl(`mailto:${data.contact.email}?subject=${encodeURIComponent(invite.emailSubject)}`) : "";
      const teammateNote = invite ? `<div class="teammate-invite"><button type="button" class="teammate-toggle" aria-expanded="false" aria-controls="teammate-message-${index}">${escapeHTML(invite.prompt)}</button><div class="teammate-message" id="teammate-message-${index}"><strong>${escapeHTML(invite.heading)}</strong><p>${escapeHTML(invite.message)}</p><a href="${escapeHTML(email)}">[email me ↗]</a></div></div>` : "";
      return `<li class="program-entry"><strong>${escapeHTML(item.name)}</strong> · ${escapeHTML(item.status)}<br><small>${escapeHTML(item.dates)} · ${escapeHTML(item.location)}</small>${teammateNote}</li>`;
    }).join("");
    $("#volunteer-list").innerHTML = data.volunteer.map((item) => `<li><strong>${escapeHTML(item.name)}</strong><br><small>${escapeHTML(item.role)} · ${escapeHTML(item.location)} · ${escapeHTML(item.dates)}</small></li>`).join("");
    $("#volunteer-note").textContent = data.volunteerNote;
    $("#changelog-list").innerHTML = data.changelog.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
    $("#future-rooms").innerHTML = data.futureRooms.map((name) => `<span class="future-room secret-target" tabindex="0" aria-label="${escapeHTML(name)}: not built yet">[${escapeHTML(name)}] <small>→ not built</small><span class="secret-tip" aria-hidden="true">[door locked for now]</span></span>`).join(" ");
    document.querySelectorAll("[data-quote-slot]").forEach((node) => {
      const quote = data.memotifs.quoteSlots[Number(node.dataset.quoteSlot)];
      node.textContent = quote ? `✧ “${quote.text}” — ${quote.author}` : "";
    });
    document.querySelectorAll("[data-motif]").forEach((node) => { node.textContent = data.memotifs.tooltips[node.dataset.motif] ?? ""; });
    $("#elsewhere-note").innerHTML = `elsewhere, preferably:<br>${escapeHTML(data.memotifs.elsewhereCities.join(" · "))}`;
    $("#motif-reveal").textContent = data.memotifs.hiddenStar;
    $("#email-link").href = `mailto:${data.contact.email}`;
    $("#github-link").href = safeUrl(data.contact.github);
    $("#huggingface-link").href = safeUrl(data.contact.huggingFace);
    [["instagram", "instagram"], ["substack", "substack"], ["x", "x / twitter"]].forEach(([key, label]) => {
      const url = safeUrl(data.contact[key]);
      $(`#${key}-slot`).innerHTML = url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>` : `<span class="contact-unbuilt">${label} <small>[link pending]</small></span>`;
    });
    const hasTracks = musicTracks.length > 0;
    $("#music-button").disabled = !hasTracks;
    $("#music-next").disabled = !hasTracks;
    if (hasTracks) selectMusicTrack(pickMusicIndex(-1));
  }

  function resumeSection(title, content) { return `<section class="resume-section"><h2>${title}</h2>${content}</section>`; }
  function renderResume() {
    $("#resume-name").textContent = data.profile.name;
    const contact = data.contact;
    $("#resume-contact").innerHTML = `<a href="mailto:${escapeHTML(contact.email)}">${escapeHTML(contact.email)}</a> · <a href="${escapeHTML(safeUrl(contact.github))}">${escapeHTML(contact.github)}</a> · <a href="${escapeHTML(safeUrl(contact.huggingFace))}">${escapeHTML(contact.huggingFace)}</a>`;
    const experience = data.experience.map((item) => `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.organization)}</strong><span>${escapeHTML(item.dates)}</span></div><div class="resume-entry-sub">${escapeHTML(item.role)}</div><ul>${item.bullets.map((bullet) => `<li>${escapeHTML(bullet)}</li>`).join("")}</ul></div>`).join("");
    const projects = data.projects.filter((item) => item.resume).map((item) => {
      if (item.resume) {
        const links = [["GitHub", item.links.github], ["Hugging Face CP2", item.links.huggingFace]].filter(([, url]) => safeUrl(url)).map(([label, url]) => `${escapeHTML(label)}: <a href="${escapeHTML(safeUrl(url))}">${escapeHTML(safeUrl(url).replace(/^https?:\/\//, ""))}</a>`).join(" · ");
        return `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.resume.dates)}</span></div><div class="resume-entry-sub">${escapeHTML(item.resume.focus)}</div><div>${escapeHTML(item.resume.details)}</div><div class="resume-project-links">${links}</div></div>`;
      }
      return `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.year)}</span></div><div>${escapeHTML(item.summary)} ${escapeHTML(item.description)}</div><div class="resume-note">${escapeHTML(item.methods.join(" · "))}</div></div>`;
    }).join("");
    const programs = data.involvement.filter((item) => item.category === "program").map((item) => `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.dates)}</span></div><div>${escapeHTML(item.status)} · ${escapeHTML(item.location)}</div></div>`).join("");
    const education = data.profile.resumeEducation;
    const educationContent = `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(education.school)}</strong><span>${escapeHTML(education.dates)}</span></div><div>${escapeHTML(education.credential)}</div></div><p><strong>AP / SAT:</strong> ${data.academics.coursework.map(escapeHTML).join(" · ")}</p><p><strong>Activities:</strong> ${data.academics.activities.map(escapeHTML).join(" ")}</p><p><strong>Distinctions:</strong> ${data.academics.distinctions.map(escapeHTML).join(" ")}</p>`;
    const volunteer = data.volunteer.map((item) => `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.dates)}</span></div><div>${escapeHTML(item.role)} · ${escapeHTML(item.location)}</div></div>`).join("");
    $("#resume-content").innerHTML = [
      resumeSection("professional summary", `<p>${escapeHTML(data.profile.professionalSummary)}</p>`),
      resumeSection("Education", educationContent),
      resumeSection("Experience", experience),
      resumeSection("Projects", projects),
      resumeSection("Skills", data.resume.skills.map(({ label, items }) => `<p><strong>${escapeHTML(label)}:</strong> ${items.map(escapeHTML).join(" · ")}</p>`).join("")),
      resumeSection("Programs / events", programs),
      resumeSection("Volunteer / community", volunteer)
    ].join("");
  }

  function setupDanaSlot() {
    const button = $("#dana-slot");
    const script = $("#dana-script");
    const forms = ["dana", "дана", "檀那", "दाना", "다나", "だんな", "דָּנָה"];
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let current = 0;
    let paused = false;
    let generation = 0;
    const show = (index) => { current = index; script.textContent = forms[index]; };
    const different = (index) => (index + 1 + Math.floor(Math.random() * (forms.length - 1))) % forms.length;
    function schedule() {
      if (paused || motion.matches) return;
      const run = ++generation;
      window.setTimeout(() => {
        if (paused || motion.matches || run !== generation) return;
        const landing = different(current);
        let frame = 0;
        function flicker() {
          if (paused || motion.matches || run !== generation) return;
          show(frame < 6 ? different(current) : landing);
          frame += 1;
          if (frame < 7) window.setTimeout(flicker, 55);
          else schedule();
        }
        flicker();
      }, 3000 + Math.random() * 2000);
    }
    button.addEventListener("click", () => {
      if (motion.matches) return;
      paused = !paused;
      button.setAttribute("aria-pressed", String(paused));
      generation += 1;
      if (!paused) schedule();
    });
    motion.addEventListener?.("change", () => {
      generation += 1;
      if (motion.matches) show(0);
      else if (!paused) schedule();
    });
    schedule();
  }

  function setupInteractions() {
    const biography = $("#about-biography");
    biography.addEventListener("click", (event) => {
      const button = event.target.closest(".bio-secret");
      if (!button || !biography.contains(button)) return;
      const expanding = button.getAttribute("aria-expanded") !== "true";
      biography.querySelectorAll(".bio-secret").forEach((secret) => secret.setAttribute("aria-expanded", "false"));
      button.setAttribute("aria-expanded", String(expanding));
    });
    const programList = $("#program-list");
    programList.addEventListener("click", (event) => {
      const button = event.target.closest(".teammate-toggle");
      if (!button || !programList.contains(button)) return;
      button.setAttribute("aria-expanded", String(button.getAttribute("aria-expanded") !== "true"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        biography.querySelectorAll(".bio-secret").forEach((secret) => secret.setAttribute("aria-expanded", "false"));
        programList.querySelectorAll(".teammate-toggle").forEach((button) => button.setAttribute("aria-expanded", "false"));
      }
    });
    $("#contents-toggle").addEventListener("click", () => { const list = $("#contents-list"); list.hidden = !list.hidden; $("#contents-toggle").textContent = list.hidden ? "[show]" : "[hide]"; $("#contents-toggle").setAttribute("aria-expanded", String(!list.hidden)); });
    $("#motif-button").addEventListener("click", () => { const reveal = $("#motif-reveal"); reveal.hidden = !reveal.hidden; $("#motif-button").setAttribute("aria-expanded", String(!reveal.hidden)); });
    $("#print-button").addEventListener("click", () => window.print());
    const resumeDialog = $("#resume-dialog");
    let resumeOpening = false;
    document.querySelectorAll('a[href="?resume=1"]').forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      if (resumeOpening || resumeDialog.open) return;
      const showDialog = () => { document.body.classList.remove("resume-shake"); resumeOpening = false; resumeDialog.showModal(); };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) showDialog();
      else { resumeOpening = true; document.body.classList.add("resume-shake"); window.setTimeout(showDialog, 165); }
    }));
    $("#resume-close").addEventListener("click", () => resumeDialog.close());
    $("#dialog-print").addEventListener("click", () => { resumeDialog.close(); window.print(); });
    $("#star-toggle").addEventListener("click", () => {
      const star = $("#star-toggle");
      const active = star.getAttribute("aria-pressed") !== "true";
      star.setAttribute("aria-pressed", String(active)); star.textContent = active ? "★" : "☆";
    });
    const debrisFaces = ["૮ ˶ᵔ ᵕ ᵔ˶ ა", ":3", "(¬‿¬)", "^_^", "(╥﹏╥)"];
    let debrisFaceIndex = 0;
    $("#debris-cycle").addEventListener("click", () => {
      debrisFaceIndex = (debrisFaceIndex + 1) % debrisFaces.length;
      $("#debris-face").textContent = debrisFaces[debrisFaceIndex];
    });
    const musicAudio = $("#music-audio");
    const musicButton = $("#music-button");
    async function playSelectedTrack() {
      try { await musicAudio.play(); musicButton.textContent = "[pause]"; $("#music-status").textContent = "playing ♪"; }
      catch { musicButton.textContent = "[play]"; $("#music-status").textContent = "couldn't play this file"; }
    }
    musicButton.addEventListener("click", async () => {
      if (musicButton.disabled) return;
      if (musicAudio.paused) {
        await playSelectedTrack();
      } else { musicAudio.pause(); musicButton.textContent = "[play]"; $("#music-status").textContent = "paused ♪"; }
    });
    $("#music-next").addEventListener("click", () => {
      if (!musicTracks.length) return;
      const continuePlaying = !musicAudio.paused;
      musicAudio.pause();
      selectMusicTrack(pickMusicIndex(currentTrackIndex));
      if (continuePlaying) playSelectedTrack();
    });
    musicAudio.addEventListener("ended", () => {
      if (!musicTracks.length) return;
      selectMusicTrack(pickMusicIndex(currentTrackIndex));
      playSelectedTrack();
    });
    $("#confetti-button").addEventListener("click", () => {
      const layer = $("#confetti-layer");
      const status = $("#party-status");
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const sparkle = document.createElement("div"); sparkle.className = "static-sparkle"; sparkle.textContent = "✧ 🪷 ♡ ☆ ✧"; layer.append(sparkle); status.textContent = "// static sparkle deployed ✧"; window.setTimeout(() => sparkle.remove(), 1800); return;
      }
      const colors = ["#d9347f", "#f69ac4", "#ffd4e5", "#191518", "#ffffff"];
      for (let index = 0; index < 72; index += 1) {
        const piece = document.createElement("span"); const glyph = index % 10 === 0;
        piece.className = `confetti-piece${glyph ? " glyph" : ""}`;
        if (glyph) piece.textContent = ["♡", "✧", "☆", "🪷"][Math.floor(index / 10) % 4];
        else piece.style.backgroundColor = colors[index % colors.length];
        piece.style.setProperty("--left", `${Math.random() * 100}vw`);
        piece.style.setProperty("--drift", `${(Math.random() - .5) * 180}px`);
        piece.style.setProperty("--duration", `${2.6 + Math.random() * 2.2}s`);
        piece.style.setProperty("--rotation", `${Math.random() * 90}deg`);
        layer.append(piece); piece.addEventListener("animationend", () => piece.remove(), { once: true });
      }
      status.textContent = "// confetti has been deployed :3";
    });
  }

  renderData(); renderResume(); setupInteractions(); setupDanaSlot(); scheduleAgeRefresh(); scheduleChicagoClock();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshAge(); refreshChicagoClock(); } });
  if (new URLSearchParams(location.search).get("resume") === "1") document.body.classList.add("resume-mode");
})();

(() => {
  "use strict";
  const data = window.siteContent;
  if (!data) throw new Error("content.js must load before script.js");
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const knowledgeGroups = (groups) => groups.map(({ label, items }) => `<li class="knowledge-group"><strong>${escapeHTML(label)}</strong><span>${items.map(escapeHTML).join(" · ")}</span></li>`).join("");
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
  const ageArticleFor = (age) => (age === 8 || age === 11 || age === 18 || age === 19 || (age >= 80 && age < 90) ? "an" : "a");
  function renderBiography() {
    renderedBiographyAge = ageAt(new Date());
    $("#about-biography").innerHTML = data.profile.about.paragraphs.map((paragraph, paragraphIndex) => {
      let content = escapeHTML(paragraph.replaceAll("{ageArticle}", ageArticleFor(renderedBiographyAge)).replaceAll("{age}", String(renderedBiographyAge))).replace(/\n/g, "<br>");
      data.profile.about.secrets.forEach((secret, secretIndex) => {
        const phrase = escapeHTML(secret.phrase);
        const tipId = `bio-tip-${secretIndex}`;
        content = content.replace(phrase, `<button type="button" class="bio-secret" aria-label="${phrase}" aria-describedby="${tipId}" aria-expanded="false">${phrase}<span id="${tipId}" class="secret-tip" role="tooltip">${escapeHTML(secret.note)}</span></button>`);
      });
      return `<p${paragraphIndex === 0 ? ' class="body-placeholder"' : ""}>${content}</p>`;
    }).join("");
  }
  function refreshAge() {
    const age = ageAt(new Date());
    $("#age").textContent = String(age);
    if (renderedBiographyAge !== age) renderBiography();
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
    $("#currently-list").innerHTML = data.currently.map(({ label, value, valueFrom, citation }) => ({ label, value: valueFrom ? pathValue(valueFrom) : value, citation })).filter(({ value }) => String(value ?? "").trim()).map(({ label, value, citation }) => `<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}${citation ? ` <span class="secret-target citation-needed" tabindex="0" aria-label="citation needed: evidence withheld :3">${escapeHTML(citation)}<span class="secret-tip" aria-hidden="true">evidence withheld :3</span></span>` : ""}</dd>`).join("");
    $("#project-list").innerHTML = data.projects.map((item, index) => {
      const links = Object.entries(item.links).filter(([, url]) => safeUrl(url)).map(([label, url]) => `<a href="${escapeHTML(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.linkLabels?.[label] ?? `${label} ↗`)}</a>`).join("");
      const path = `./projects/${String(index + 1).padStart(2, "0")}/`;
      const pathDisplay = index === 0 ? `<span class="secret-target project-path-secret" tabindex="0" aria-label="${path}: a note says missing image but emotionally present">${path}<span class="secret-tip" aria-hidden="true">// missing image but emotionally present</span></span>` : path;
      const description = Array.isArray(item.description) ? item.description.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("") : escapeHTML(item.description);
      const history = Array.isArray(item.history) ? `<ol class="project-history-list">${item.history.map(({ version, note }) => `<li><strong>${escapeHTML(version)}</strong> — ${escapeHTML(note)}</li>`).join("")}</ol>` : escapeHTML(item.history);
      const activeMarker = item.active ? ` <span class="secret-target active-project-marker" tabindex="0" aria-label="active project: currently working on this">✳<span class="secret-tip" aria-hidden="true">currently working on this : )</span></span>` : "";
      return `<article class="project-entry"><div><div class="project-meta">drwxr-xr-x &nbsp; ${pathDisplay} <span>♡</span></div><h3>${escapeHTML(item.name)}${activeMarker}</h3><dl class="project-details"><dt>status</dt><dd>${escapeHTML(item.status)}</dd><dt>year</dt><dd>${escapeHTML(item.year)}</dd><dt>summary</dt><dd>${escapeHTML(item.summary)}</dd><dt>details</dt><dd class="project-description">${description}</dd><dt>methods</dt><dd class="project-methods">${item.methods.map((method) => `<span>${escapeHTML(method)}</span>`).join(" ")}</dd>${links ? `<dt>links</dt><dd class="project-links">${links}</dd>` : ""}<dt>history</dt><dd>${history}</dd></dl><details class="project-ramble"><summary>(mindless rambles)</summary><p>${escapeHTML(item.ramble)}</p></details></div><div class="project-image" role="img" aria-label="placeholder for a future project image">${escapeHTML(item.image)}</div></article>`;
    }).join("");
    $("#writing-list").innerHTML = data.writing.map((item) => `<li><span>${safeUrl(item.url) ? `<a href="${escapeHTML(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.title)} ↗</a>` : `<span class="archive-title">${escapeHTML(item.title)}</span>`}</span><span class="archive-kind">${escapeHTML(item.kind)}</span><time>${escapeHTML(item.date)}</time></li>`).join("");
    $("#know-list").innerHTML = knowledgeGroups(data.knowledge.know);
    $("#dont-know-list").innerHTML = knowledgeGroups(data.knowledge.dontKnow);
    $("#want-know-list").innerHTML = data.knowledge.wantToKnow.questions.map((question) => `<li>${escapeHTML(question)}</li>`).join("");
    $("#program-list").innerHTML = data.involvement.map((item, index) => {
      const invite = item.teammates;
      const email = invite ? safeUrl(`mailto:${data.contact.email}?subject=${encodeURIComponent(invite.emailSubject)}`) : "";
      const teammateNote = invite ? `<div class="teammate-invite"><button type="button" class="teammate-toggle" aria-expanded="false" aria-controls="teammate-message-${index}">${escapeHTML(invite.prompt)}</button><div class="teammate-message" id="teammate-message-${index}"><strong>${escapeHTML(invite.heading)}</strong><p>${escapeHTML(invite.message)}</p><a href="${escapeHTML(email)}">[email me ↗]</a></div></div>` : "";
      return `<li class="program-entry"><strong>${escapeHTML(item.name)}</strong> · ${escapeHTML(item.status)}<br><small>${escapeHTML(item.dates)} · ${escapeHTML(item.location)}</small>${teammateNote}</li>`;
    }).join("");
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
    const projects = data.projects.map((item) => {
      if (item.resume) {
        const links = [["GitHub", item.links.github], ["Hugging Face CP2", item.links.huggingFace]].filter(([, url]) => safeUrl(url)).map(([label, url]) => `${escapeHTML(label)}: <a href="${escapeHTML(safeUrl(url))}">${escapeHTML(safeUrl(url).replace(/^https?:\/\//, ""))}</a>`).join(" · ");
        return `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.resume.dates)}</span></div><div class="resume-entry-sub">${escapeHTML(item.resume.focus)}</div><div>${escapeHTML(item.resume.details)}</div><div class="resume-project-links">${links}</div></div>`;
      }
      return `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.year)}</span></div><div>${escapeHTML(item.summary)} ${escapeHTML(item.description)}</div><div class="resume-note">${escapeHTML(item.methods.join(" · "))}</div></div>`;
    }).join("");
    const programs = data.involvement.filter((item) => item.category === "program").map((item) => `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.dates)}</span></div><div>${escapeHTML(item.status)} · ${escapeHTML(item.location)}</div></div>`).join("");
    const education = data.profile.resumeEducation;
    $("#resume-content").innerHTML = [
      resumeSection("professional summary", `<p>${escapeHTML(data.profile.professionalSummary)}</p>`),
      resumeSection("Education", `<div class="resume-entry"><div class="resume-entry-head"><strong>${escapeHTML(education.school)}</strong><span>${escapeHTML(education.dates)}</span></div><div>${escapeHTML(education.credential)}</div></div>`),
      resumeSection("Experience", experience),
      resumeSection("Projects", projects),
      resumeSection("Skills", data.resume.skills.map(({ label, items }) => `<p><strong>${escapeHTML(label)}:</strong> ${items.map(escapeHTML).join(" · ")}</p>`).join("")),
      resumeSection("Programs / events", programs),
      resumeSection("Volunteer / community", `<p>${escapeHTML(data.volunteer)}</p>`)
    ].join("");
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

  renderData(); renderResume(); setupInteractions(); scheduleAgeRefresh(); scheduleChicagoClock();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshAge(); refreshChicagoClock(); } });
  if (new URLSearchParams(location.search).get("resume") === "1") document.body.classList.add("resume-mode");
})();

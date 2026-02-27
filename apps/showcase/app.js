const DATA_FILES = {
  personas: "./data/persona-paths.json",
  evidence: "./data/evidence-snapshots.json",
  troubleshooting: "./data/troubleshooting.json"
};

const state = {
  personas: null,
  evidence: null,
  troubleshooting: null,
  personaId: "",
  evidenceId: ""
};

function live(message) {
  const region = document.getElementById("live-region");
  if (!region) {
    return;
  }
  region.textContent = message;
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function statusClass(status) {
  if (status === "good") {
    return "good";
  }
  if (status === "warn") {
    return "warn";
  }
  return "blocked";
}

function copyFallback(value) {
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "readonly");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(helper);
  return copied;
}

async function copyCommand(command, triggerLabel = "Command") {
  let copied = false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(command);
      copied = true;
    } else {
      copied = copyFallback(command);
    }
  } catch {
    copied = copyFallback(command);
  }

  if (copied) {
    live(`${triggerLabel} copied to clipboard.`);
  } else {
    live(`Could not copy ${triggerLabel}.`);
  }
}

function bindCopyButtons(root) {
  const buttons = root.querySelectorAll("[data-copy-command]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.getAttribute("data-copy-command");
      const label = button.getAttribute("data-copy-label") || "Command";
      if (!command) {
        return;
      }
      copyCommand(command, label);
    });
  });
}

function renderPersona(persona) {
  const card = document.getElementById("persona-card");
  const switcher = document.getElementById("persona-switcher");
  if (!card || !switcher) {
    return;
  }

  state.personaId = persona.id;

  const tabs = switcher.querySelectorAll("button[data-persona-id]");
  tabs.forEach((tab) => {
    tab.setAttribute("aria-selected", tab.getAttribute("data-persona-id") === persona.id ? "true" : "false");
  });

  const steps = persona.steps
    .map((step) => {
      const commandHtml = step.command
        ? `<pre class="command-block"><code>${step.command}</code></pre>
          <div class="copy-row">
            <button class="copy-button" type="button" data-copy-command="${step.command}" data-copy-label="${step.title}">Copy command</button>
          </div>`
        : "";

      return `<li>
        <strong>${step.title}</strong>
        <p>${step.outcome}</p>
        ${commandHtml}
      </li>`;
    })
    .join("");

  card.innerHTML = `
    <div>
      <h3>${persona.label}</h3>
      <p>${persona.headline}</p>
      <div class="journey-meta">
        <span class="badge">First success: ${persona.timeToSuccess}</span>
        <span class="badge">Path: ${persona.pathName}</span>
      </div>
    </div>
    <ol class="command-list">${steps}</ol>
    <div class="section-actions">
      <a class="button button-primary" href="${persona.primaryCta.href}">${persona.primaryCta.label}</a>
      <a class="button button-secondary" href="${persona.secondaryCta.href}">${persona.secondaryCta.label}</a>
    </div>
  `;

  bindCopyButtons(card);
}

function renderEvidenceScenario(scenario) {
  const summary = document.getElementById("evidence-summary");
  const stages = document.getElementById("evidence-stage-list");
  const changeList = document.getElementById("evidence-change-list");
  const actionList = document.getElementById("evidence-action-list");
  const provenance = document.getElementById("evidence-provenance");
  if (!summary || !stages || !changeList || !actionList || !provenance || !state.evidence) {
    return;
  }

  state.evidenceId = scenario.id;

  summary.innerHTML = `
    <h3>${scenario.label}</h3>
    <p>${scenario.summary}</p>
    <div class="journey-meta">
      <span class="badge ${statusClass(scenario.status)}">Status: ${scenario.status.toUpperCase()}</span>
      <span class="badge">Eval score: ${scenario.evalScore}</span>
      <span class="badge">Snapshot freshness: ${scenario.snapshotState}</span>
    </div>
  `;

  stages.innerHTML = scenario.stages
    .map((stage) => {
      return `<article class="stage-card" role="listitem">
        <h3>${stage.name}</h3>
        <span class="badge ${statusClass(stage.status)}">${stage.status.toUpperCase()}</span>
        <p class="stage-meta">${stage.detail}</p>
        <p class="stage-meta">Duration: ${stage.duration}</p>
      </article>`;
    })
    .join("");

  changeList.innerHTML = scenario.changes.map((item) => `<li>${item}</li>`).join("");
  actionList.innerHTML = scenario.nextActions.map((item) => `<li>${item}</li>`).join("");
  provenance.textContent = `Snapshot generated ${state.evidence.generatedAt}. Source: ${state.evidence.source}.`;
}

function renderTroubleshooting(items) {
  const grid = document.getElementById("troubleshooting-grid");
  if (!grid) {
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      return `<article class="issue-card" role="listitem">
        <div>
          <h3>${item.symptom}</h3>
          <p class="issue-meta">Signal: ${item.signal}</p>
          <p class="issue-meta">Impact: ${item.impact}</p>
        </div>
        <div>
          <p><strong>Fix command</strong></p>
          <pre class="command-block"><code>${item.fixCommand}</code></pre>
          <div class="copy-row">
            <button class="copy-button" type="button" data-copy-command="${item.fixCommand}" data-copy-label="Fix command">Copy fix</button>
          </div>
        </div>
        <div>
          <p><strong>Verify command</strong></p>
          <pre class="command-block"><code>${item.verifyCommand}</code></pre>
          <div class="copy-row">
            <button class="copy-button" type="button" data-copy-command="${item.verifyCommand}" data-copy-label="Verify command">Copy verify</button>
          </div>
          <p><a href="${item.docHref}">Open recovery guide</a></p>
        </div>
      </article>`;
    })
    .join("");

  bindCopyButtons(grid);
}

function buildPersonaSwitcher(personas) {
  const switcher = document.getElementById("persona-switcher");
  if (!switcher) {
    return;
  }

  switcher.innerHTML = personas
    .map(
      (persona) =>
        `<button type="button" role="tab" aria-selected="false" data-persona-id="${persona.id}">${persona.label}</button>`
    )
    .join("");

  const tabs = switcher.querySelectorAll("button[data-persona-id]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const nextId = tab.getAttribute("data-persona-id");
      if (!nextId || !state.personas) {
        return;
      }
      const nextPersona = state.personas.personas.find((persona) => persona.id === nextId);
      if (!nextPersona) {
        return;
      }
      renderPersona(nextPersona);
    });
  });
}

function buildEvidenceSwitcher(scenarios) {
  const select = document.getElementById("evidence-switcher");
  if (!select) {
    return;
  }

  select.innerHTML = scenarios
    .map((scenario) => `<option value="${scenario.id}">${scenario.label}</option>`)
    .join("");

  select.addEventListener("change", () => {
    const nextId = select.value;
    if (!state.evidence) {
      return;
    }
    const nextScenario = state.evidence.scenarios.find((scenario) => scenario.id === nextId);
    if (!nextScenario) {
      return;
    }
    renderEvidenceScenario(nextScenario);
  });
}

function renderLoadFailure(message) {
  const targets = ["persona-card", "evidence-summary", "troubleshooting-grid"];
  targets.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.innerHTML = `<p>${message}</p>`;
  });
}

async function init() {
  try {
    const [personas, evidence, troubleshooting] = await Promise.all([
      loadJson(DATA_FILES.personas),
      loadJson(DATA_FILES.evidence),
      loadJson(DATA_FILES.troubleshooting)
    ]);

    state.personas = personas;
    state.evidence = evidence;
    state.troubleshooting = troubleshooting;

    buildPersonaSwitcher(personas.personas);
    buildEvidenceSwitcher(evidence.scenarios);

    renderPersona(personas.personas[0]);
    renderEvidenceScenario(evidence.scenarios[0]);
    renderTroubleshooting(troubleshooting.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown showcase load error";
    renderLoadFailure(`Could not load showcase data. ${message}`);
  }
}

init();

window.skillsetShowcase = {
  renderPersona,
  renderEvidenceScenario,
  renderTroubleshooting,
  copyCommand
};

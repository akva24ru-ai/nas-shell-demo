(function () {
  "use strict";

  const Diagnostic = window.NasShellDiagnostic;
  const Catalogs = window.NasShellCatalogs;
  const Compatibility = window.NasShellCompatibility;
  const Setup = window.NasShellSetupProject;
  const BrowserSession = window.NasShellBrowserSession;
  const titles = {
    home: ["Добро пожаловать в NAS Shell", "Понятная настройка NAS без сложных технических меню."],
    wizard: ["Мастер настройки", "Пошаговая подготовка с безопасными проверками."],
    hardware: ["Оборудование", "DEMO · сведения диагностики и локальный импорт отчёта."],
    report: ["Диагностика", "DEMO · пример отчёта без данных реального устройства."],
    compat: ["Совместимость", "Результаты остаются неподтверждёнными без достоверных данных."],
  };
  const demoReport = Diagnostic.DEMO_REPORT;
  const diagnosticSession = Diagnostic.createSession();
  let browserStorage = null;
  try { browserStorage = window.sessionStorage; } catch (_) { /* storage can be unavailable */ }
  let wizardState = BrowserSession.load(browserStorage);
  if (wizardState.report) diagnosticSession.importReport(wizardState.report);
  let wizardRunning = false;

  function show(view) {
    for (const section of document.querySelectorAll("main section[id]")) {
      section.classList.toggle("hidden", section.id !== view);
    }
    for (const button of document.querySelectorAll("nav button")) {
      button.classList.toggle("active", button.dataset.view === view);
    }
    document.getElementById("heading").textContent = titles[view][0];
    document.getElementById("subtitle").textContent = titles[view][1];
  }

  function setDefinitions(id, rows) {
    const list = document.getElementById(id);
    const nodes = [];
    for (const [label, text] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = text || "Не определено";
      nodes.push(dt, dd);
    }
    list.replaceChildren(...nodes);
  }

  function showHardware(report) {
    const data = Diagnostic.normalize(report);
    const labels = [["cpu", "Процессор"], ["ram", "Оперативная память"],
      ["nic", "Сетевой адаптер"], ["storage", "Накопители"]];
    setDefinitions("hardwareImportedList", labels.map(([key, label]) => [label, data.hardware[key]]));
    document.getElementById("hardwareSample").classList.add("hidden");
    document.getElementById("hardwareImported").classList.remove("hidden");
  }

  function showDetails(report) {
    const compatApi = Compatibility;
    setDefinitions("diagnosticsDetailsList", Diagnostic.detailsRows(report, compatApi));
  }

  function download(data, name) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fillSelect(select, items, placeholder, label) {
    const options = [new Option(placeholder, "")];
    for (const item of items) options.push(new Option(`${label}${item.label}`, item.id));
    select.replaceChildren(...options);
  }

  function setupReport() {
    return diagnosticSession.getReport();
  }

  function persistWizardSession() {
    BrowserSession.save(browserStorage, wizardState, setupReport());
  }

  function renderWizard() {
    for (let i = 1; i <= Setup.LAST_STEP; i++) {
      document.getElementById(`wizard${i}`).classList.toggle("hidden", wizardState.step !== i);
      document.getElementById(`step${i}`).classList.toggle("current", wizardState.step === i);
    }
    document.getElementById("back").disabled = wizardState.step === 1 || wizardRunning;
    document.getElementById("next").disabled = wizardRunning;
    document.getElementById("next").classList.toggle("hidden", wizardState.completed === true);
    document.getElementById("wizardCompletion").classList.toggle("hidden", wizardState.completed !== true);
    document.getElementById("returnHome").classList.toggle("hidden", wizardState.completed !== true);
    document.getElementById("wizardCompletion").textContent = BrowserSession.DEFAULT_MESSAGE;
    document.getElementById("next").textContent = wizardState.step === Setup.LAST_STEP ? "Завершить" : "Продолжить →";
    document.getElementById("setupError").textContent = wizardState.error;
    const report = setupReport();
    const equipmentRows = report
      ? Setup.summaryRows({ ...wizardState, model: "", dsm: "" }, report).slice(2, 7)
      : [["Источник диагностики", "Не определено"], ["Оборудование", "Не определено"]];
    setDefinitions("setupHardwareSummary", equipmentRows);
    const compatibility = Setup.compatibilityFor(wizardState);
    const compatBox = document.getElementById("wizardCompatibility");
    compatBox.textContent = `${compatibility.label}. ${compatibility.reason}`;
    setDefinitions("setupProjectSummary", Setup.summaryRows(wizardState, report || demoReport));
  }

  function updateCompatibility() {
    const model = document.getElementById("modelChoice").value;
    const dsm = document.getElementById("dsmChoice").value;
    const result = Compatibility.evaluate(model, dsm, null);
    const modelName = model ? Catalogs.labelForModel(model) : "Не определено";
    const dsmName = dsm ? Catalogs.labelForVersion(dsm) : "Не определено";
    document.getElementById("compatResult").textContent =
      `DEMO · ${modelName} / ${dsmName}. ${result.label}. ${result.reason} Не используйте для обновления NAS.`;
  }

  function updateWizardCompatibility() {
    const modelChoice = document.getElementById("wizardModel").value;
    const dsmChoice = document.getElementById("wizardDsm").value;
    wizardState = Setup.selectModel(wizardState, modelChoice);
    wizardState = Setup.selectVersion(wizardState, dsmChoice);
    wizardState = { ...wizardState, error: "" };
    persistWizardSession();
    renderWizard();
  }

  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => show(button.dataset.view));
  });
  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => show(button.dataset.goto));
  });

  fillSelect(document.getElementById("wizardModel"), Catalogs.models, "Выберите модель", "");
  fillSelect(document.getElementById("modelChoice"), Catalogs.models, "Выберите модель", "DEMO · ");
  fillSelect(document.getElementById("wizardDsm"), Catalogs.dsmVersions, "Выберите версию", "");
  fillSelect(document.getElementById("dsmChoice"), Catalogs.dsmVersions, "Выберите версию", "DEMO · ");
  document.getElementById("wizardModel").value = wizardState.model;
  document.getElementById("wizardDsm").value = wizardState.dsm;
  document.getElementById("modelChoice").options[1].selected = true;
  document.getElementById("dsmChoice").options[1].selected = true;

  document.getElementById("wizardModel").addEventListener("change", () => {
    wizardState = Setup.selectModel(wizardState, document.getElementById("wizardModel").value);
    persistWizardSession();
    renderWizard();
  });
  document.getElementById("wizardDsm").addEventListener("change", () => {
    wizardState = Setup.selectVersion(wizardState, document.getElementById("wizardDsm").value);
    persistWizardSession();
    renderWizard();
  });
  document.getElementById("next").addEventListener("click", () => {
    if (wizardState.step === Setup.LAST_STEP) {
      wizardState = { ...wizardState, completed: true, error: "" };
      persistWizardSession();
      renderWizard();
      return;
    }
    wizardState = Setup.next(wizardState);
    persistWizardSession();
    renderWizard();
  });
  document.getElementById("back").addEventListener("click", () => {
    wizardState = { ...Setup.back(wizardState), completed: false };
    persistWizardSession();
    renderWizard();
  });
  document.getElementById("exportPlan").addEventListener("click", () => {
    download(Setup.buildProject({ ...wizardState, report: setupReport() || demoReport }), "nas-shell-setup-project-demo.json");
  });
  document.getElementById("returnHome").addEventListener("click", () => show("home"));

  document.getElementById("scanHardware").addEventListener("click", async event => {
    if (wizardRunning) return;
    wizardRunning = true;
    const button = event.currentTarget;
    button.disabled = true;
    const progressBox = document.getElementById("scanProgressBox");
    progressBox.classList.remove("hidden");
    document.getElementById("scanStatus").classList.add("hidden");
    const progress = document.getElementById("scanProgress");
    try {
      // runDemoScan returns a fixture locally. No network or CGI calls.
      const report = await Diagnostic.runDemoScan(state => {
        document.getElementById(`scanStep${state.step}`).classList.add("current");
        progress.value = state.step - 1;
        document.getElementById("scanStatus").textContent = state.message;
        document.getElementById("scanStatus").classList.remove("hidden");
      });
      progress.value = 4;
      diagnosticSession.recordScan(report);
      wizardState = { ...wizardState, report };
      persistWizardSession();
      showHardware(report);
      showDetails(report);
      document.getElementById("scanStatus").textContent = "Демонстрационная диагностика завершена. Данные оборудования получены автоматически";
      document.getElementById("scanStatus").classList.remove("hidden");
      document.getElementById("lastScanAt").textContent = "Последнее сканирование: " +
        new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(diagnosticSession.getLastScanAt()));
      document.getElementById("hardwareImportStatus").textContent = "Ручной импорт JSON доступен отдельно.";
      renderWizard();
    } catch (error) {
      const states = {
        "invalid-format": "Ошибка DEMO: получен JSON неверного формата.",
        "too-large": "Ошибка DEMO: размер JSON превышает 64 КиБ.",
        "unavailable": "DEMO · Диагностика недоступна. Повторите сканирование позднее.",
      };
      const status = document.getElementById("scanStatus");
      status.textContent = states[error && error.code] || states.unavailable;
      status.classList.remove("hidden");
    } finally {
      wizardRunning = false;
      button.disabled = false;
      for (let i = 1; i <= 4; i++) document.getElementById(`scanStep${i}`).classList.remove("current");
    }
  });

  document.getElementById("detailsButton").addEventListener("click", event => {
    const panel = document.getElementById("diagnosticsDetails");
    const opening = panel.classList.contains("hidden");
    if (opening) showDetails(diagnosticSession.getReport() || demoReport);
    panel.classList.toggle("hidden", !opening);
    event.currentTarget.setAttribute("aria-expanded", String(opening));
  });
  document.getElementById("exportDiagnostic").addEventListener("click", () => {
    download(diagnosticSession.getReport() || demoReport, "nas-shell-hardware-demo.json");
  });

  document.getElementById("hardwareFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById("hardwareImportStatus");
    if (file.size > Diagnostic.MAX_REPORT_BYTES) {
      status.textContent = "Ошибка импорта: размер отчёта превышает 64 КиБ.";
      return;
    }
    try {
      const report = Diagnostic.parseReport(await file.text());
      diagnosticSession.importReport(report);
      wizardState = { ...wizardState, report };
      persistWizardSession();
      showHardware(report);
      showDetails(report);
      status.textContent = "Диагностический отчёт успешно загружен из файла";
      renderWizard();
    } catch (error) {
      status.textContent = "Ошибка импорта: " + error.message;
    }
  });
  document.getElementById("clearHardware").addEventListener("click", () => {
    diagnosticSession.clear();
    wizardState = { ...wizardState, report: null };
    persistWizardSession();
    document.getElementById("hardwareFile").value = "";
    document.getElementById("hardwareSample").classList.remove("hidden");
    document.getElementById("hardwareImported").classList.add("hidden");
    document.getElementById("hardwareImportStatus").textContent = "Реальная диагностика не подключена. DEMO-пример ниже.";
    renderWizard();
  });

  document.getElementById("modelChoice").addEventListener("change", updateCompatibility);
  document.getElementById("dsmChoice").addEventListener("change", updateCompatibility);
  document.getElementById("exportCompat").addEventListener("click", () => {
    const model = document.getElementById("modelChoice").value;
    const dsm = document.getElementById("dsmChoice").value;
    download({ mode: "DEMO", model: model || "Не определено", dsmVersion: dsm || "Не определено",
      compatibility: Compatibility.evaluate(model, dsm, null), safeToUpgrade: false, writesEnabled: false },
    "nas-shell-compatibility-demo.json");
  });
  document.getElementById("exportReport").addEventListener("click", () => {
    download(diagnosticSession.getReport() || demoReport, "nas-shell-demo-report.json");
  });

  document.getElementById("reportText").textContent = JSON.stringify(demoReport, null, 2);
  updateCompatibility();
  renderWizard();
})();

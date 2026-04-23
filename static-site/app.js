const QR_TYPES = [
  ["website", "Website"],
  ["text", "Text"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["wifi", "Wi-Fi"],
  ["custom", "Custom"],
];

const DEFAULT_FIELDS = {
  website: "https://qrforge.example",
  text: "",
  email: "",
  emailSubject: "",
  emailBody: "",
  phone: "",
  wifiSsid: "",
  wifiPassword: "",
  wifiEncryption: "WPA",
  custom: "",
};

const DEFAULT_CUSTOM = {
  size: 1200,
  margin: 56,
  foreground: "#111827",
  background: "#ffffff",
  dotStyle: "dots",
  cornerStyle: "extra-rounded",
};

const DOT_STYLES = [
  ["dots", "Dots"],
  ["rounded", "Rounded"],
  ["square", "Square"],
  ["classy-rounded", "Classy"],
];

const CORNER_STYLES = [
  ["extra-rounded", "Rounded"],
  ["dot", "Dot"],
  ["square", "Square"],
];

const toast = document.getElementById("toast");

document.querySelectorAll("[data-generator]").forEach((node) => {
  createGenerator(node);
});

function createGenerator(root) {
  const state = {
    type: "website",
    fields: { ...DEFAULT_FIELDS },
    custom: { ...DEFAULT_CUSTOM },
    qr: null,
  };

  root.innerHTML = `
    <div class="panel">
      <div>
        <span class="label">Content type</span>
        <div class="type-grid" data-type-grid></div>
      </div>
      <div class="field-grid" data-fields></div>
      <p class="validation" data-validation></p>
      <div class="form-actions">
        <button class="button button-light" data-copy type="button">Copy content</button>
        <button class="button button-light" data-reset type="button">Reset</button>
      </div>
    </div>
    <div class="panel">
      <div class="preview-card">
        <div class="preview-head">
          <div>
            <span class="label">Live preview</span>
            <p>Generated in your browser</p>
          </div>
          <span class="status" data-status>Waiting</span>
        </div>
        <div class="qr-preview" data-preview></div>
      </div>
      <div class="custom-card">
        <div class="two-col">
          ${rangeControl("size", "Size", 512, 2400, 128)}
          ${rangeControl("margin", "Margin", 0, 160, 8)}
        </div>
        <div class="two-col">
          ${colorControl("foreground", "Foreground")}
          ${colorControl("background", "Background")}
        </div>
        ${selectControl("dotStyle", "Dot style", DOT_STYLES)}
        ${selectControl("cornerStyle", "Corner style", CORNER_STYLES)}
      </div>
      <div class="export-actions">
        <button class="button button-dark" data-download="svg" type="button">SVG</button>
        <button class="button button-dark" data-download="png" type="button">PNG</button>
        <button class="button button-dark" data-download="jpeg" type="button">JPG</button>
      </div>
    </div>
  `;

  const refs = {
    typeGrid: root.querySelector("[data-type-grid]"),
    fields: root.querySelector("[data-fields]"),
    validation: root.querySelector("[data-validation]"),
    preview: root.querySelector("[data-preview]"),
    status: root.querySelector("[data-status]"),
    copy: root.querySelector("[data-copy]"),
    reset: root.querySelector("[data-reset]"),
    downloads: root.querySelectorAll("[data-download]"),
  };

  refs.typeGrid.innerHTML = QR_TYPES.map(
    ([id, label]) => `<button class="type-button" data-type="${id}" type="button">${label}</button>`,
  ).join("");

  refs.typeGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    state.type = button.dataset.type;
    renderGenerator(root, state);
    updateQrForRoot(root, state);
  });

  refs.fields.addEventListener("input", (event) => {
    const input = event.target.closest("[data-field]");
    if (!input) return;
    state.fields[input.dataset.field] = input.value;
    updateQr();
  });

  refs.fields.addEventListener("change", (event) => {
    const input = event.target.closest("[data-field]");
    if (!input) return;
    state.fields[input.dataset.field] = input.value;
    updateQr();
  });

  root.querySelectorAll("[data-custom]").forEach((input) => {
    input.addEventListener("input", () => {
      state.custom[input.dataset.custom] =
        input.type === "range" ? Number(input.value) : input.value;
      syncCustomInputs(root, state);
      updateQr();
    });
  });

  refs.copy.addEventListener("click", async () => {
    const validation = validateQRContent(state.type, state.fields);
    if (validation) return;
    await copyText(buildQRContent(state.type, state.fields));
    showToast("Content copied");
  });

  refs.reset.addEventListener("click", () => {
    state.type = "website";
    state.fields = { ...DEFAULT_FIELDS };
    state.custom = { ...DEFAULT_CUSTOM };
    showToast("Generator reset");
    renderGenerator(root, state);
    updateQrForRoot(root, state);
  });

  refs.downloads.forEach((button) => {
    button.addEventListener("click", () => downloadQr(button.dataset.download, state));
  });

  state.qr = new QRCodeStyling(createGithubQROptions(buildQRContent(state.type, state.fields), state.custom));
  state.qr.append(refs.preview);
  root.__state = state;
  renderGenerator(root, state);
  updateQrForRoot(root, state);
  fitQrElement(refs.preview, state.custom.size);
}

function renderGenerator(root, state) {
  root.querySelectorAll("[data-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === state.type);
  });
  root.querySelector("[data-fields]").innerHTML = fieldTemplate(state.type, state.fields);
  const encryption = root.querySelector('[data-field="wifiEncryption"]');
  if (encryption) encryption.value = state.fields.wifiEncryption;
  syncCustomInputs(root, state);
}

function rangeControl(key, label, min, max, step) {
  return `
    <label>
      <span class="label">${label}</span>
      <input class="range" data-custom="${key}" type="range" min="${min}" max="${max}" step="${step}" />
      <span class="value-text" data-value="${key}"></span>
    </label>
  `;
}

function colorControl(key, label) {
  return `
    <label>
      <span class="label">${label}</span>
      <span class="color-row">
        <input data-custom="${key}" data-color="${key}" type="color" />
        <input data-custom="${key}" data-text-color="${key}" type="text" />
      </span>
    </label>
  `;
}

function selectControl(key, label, options) {
  return `
    <label>
      <span class="label">${label}</span>
      <select class="select" data-custom="${key}">
        ${options.map(([value, optionLabel]) => `<option value="${value}">${optionLabel}</option>`).join("")}
      </select>
    </label>
  `;
}

function fieldTemplate(type, fields) {
  if (type === "website") {
    return textInput("website", "Website URL", fields.website, "https://example.com", "url");
  }

  if (type === "email") {
    return [
      textInput("email", "Email address", fields.email, "hello@example.com", "email"),
      textInput("emailSubject", "Subject", fields.emailSubject, "Quick question"),
      textareaInput("emailBody", "Body", fields.emailBody, "Write a prefilled email message"),
    ].join("");
  }

  if (type === "phone") {
    return textInput("phone", "Phone number", fields.phone, "+1 555 012 3456", "tel");
  }

  if (type === "wifi") {
    return [
      textInput("wifiSsid", "Network name", fields.wifiSsid, "Studio Wi-Fi"),
      textInput("wifiPassword", "Password", fields.wifiPassword, "Network password"),
      `<label><span class="label">Encryption</span><select class="select" data-field="wifiEncryption">
        <option value="WPA">WPA/WPA2</option>
        <option value="WEP">WEP</option>
        <option value="nopass">Open</option>
      </select></label>`,
    ].join("");
  }

  const key = type === "text" ? "text" : "custom";
  return textareaInput(key, type === "text" ? "Text" : "Custom string", fields[key], "Paste any content you want to encode");
}

function textInput(key, label, value, placeholder, mode = "text") {
  return `
    <label>
      <span class="label">${label}</span>
      <input class="input" data-field="${key}" value="${escapeAttribute(value)}" placeholder="${placeholder}" inputmode="${mode}" />
    </label>
  `;
}

function textareaInput(key, label, value, placeholder) {
  return `
    <label>
      <span class="label">${label}</span>
      <textarea class="textarea" data-field="${key}" placeholder="${placeholder}">${escapeText(value)}</textarea>
    </label>
  `;
}

function updateQrForRoot(root, state) {
  const validation = validateQRContent(state.type, state.fields);
  const content = buildQRContent(state.type, state.fields);
  const canGenerate = !validation && Boolean(content);
  const validationNode = root.querySelector("[data-validation]");
  const statusNode = root.querySelector("[data-status]");
  const previewNode = root.querySelector("[data-preview]");

  validationNode.textContent = validation || "Ready to export.";
  validationNode.classList.toggle("ready", canGenerate);
  statusNode.textContent = canGenerate ? "Valid" : "Waiting";
  statusNode.classList.toggle("valid", canGenerate);
  previewNode.classList.toggle("waiting", !canGenerate);

  root.querySelector("[data-copy]").disabled = !canGenerate;
  root.querySelectorAll("[data-download]").forEach((button) => {
    button.disabled = !canGenerate;
  });

  state.qr.update(createGithubQROptions(canGenerate ? content : "https://qrforge.example", state.custom));
  requestAnimationFrame(() => fitQrElement(previewNode, state.custom.size));
}

function updateQr() {
  document.querySelectorAll("[data-generator]").forEach((root) => {
    if (root.__state) updateQrForRoot(root, root.__state);
  });
}

function syncCustomInputs(root, state) {
  root.querySelectorAll("[data-custom]").forEach((input) => {
    const key = input.dataset.custom;
    if (input.value !== String(state.custom[key])) input.value = state.custom[key];
  });
  root.querySelectorAll("[data-value]").forEach((node) => {
    node.textContent = `${state.custom[node.dataset.value]}px`;
  });
}

function createGithubQROptions(data, custom, type = "svg") {
  return {
    width: custom.size,
    height: custom.size,
    type,
    data,
    margin: custom.margin,
    qrOptions: { errorCorrectionLevel: "H" },
    backgroundOptions: { color: custom.background },
    cornersSquareOptions: {
      color: custom.foreground,
      type: custom.cornerStyle,
    },
    cornersDotOptions: {
      color: custom.foreground,
      type: custom.cornerStyle === "dot" ? "dot" : "square",
    },
    dotsOptions: {
      color: custom.foreground,
      type: custom.dotStyle,
    },
    imageOptions: {
      imageSize: 0.5,
      margin: 10,
    },
  };
}

function buildQRContent(type, fields) {
  if (type === "website") return normalizeUrl(fields.website);
  if (type === "text") return fields.text.trim();
  if (type === "email") {
    const params = new URLSearchParams();
    if (fields.emailSubject.trim()) params.set("subject", fields.emailSubject.trim());
    if (fields.emailBody.trim()) params.set("body", fields.emailBody.trim());
    const query = params.toString();
    return `mailto:${fields.email.trim()}${query ? `?${query}` : ""}`;
  }
  if (type === "phone") return `tel:${fields.phone.replace(/[^\d+]/g, "")}`;
  if (type === "wifi") {
    return `WIFI:T:${fields.wifiEncryption};S:${escapeWifi(fields.wifiSsid)};P:${escapeWifi(fields.wifiPassword)};;`;
  }
  return fields.custom.trim();
}

function validateQRContent(type, fields) {
  if (type === "website") {
    if (!fields.website.trim()) return "Enter a website URL.";
    try {
      const url = new URL(normalizeUrl(fields.website));
      if (!["http:", "https:"].includes(url.protocol)) return "Use an http or https URL.";
      return null;
    } catch {
      return "Enter a valid URL, like https://example.com.";
    }
  }
  if (type === "email") {
    if (!fields.email.trim()) return "Enter an email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) return "Enter a valid email address.";
    return null;
  }
  if (type === "phone") {
    const cleaned = fields.phone.replace(/[^\d+]/g, "");
    if (!cleaned) return "Enter a phone number.";
    if (cleaned.replace(/[^\d]/g, "").length < 7) return "Enter a complete phone number.";
    return null;
  }
  if (type === "wifi") {
    if (!fields.wifiSsid.trim()) return "Enter the Wi-Fi network name.";
    if (fields.wifiEncryption !== "nopass" && !fields.wifiPassword.trim()) {
      return "Enter the Wi-Fi password, or choose Open.";
    }
    return null;
  }
  return buildQRContent(type, fields) ? null : "Enter content to generate a QR code.";
}

async function downloadQr(format, state) {
  const validation = validateQRContent(state.type, state.fields);
  if (validation) return;
  const content = buildQRContent(state.type, state.fields);
  const options =
    format === "jpeg"
      ? createGithubQROptions(content, { ...state.custom, background: "#ffffff" }, "canvas")
      : createGithubQROptions(content, state.custom, format === "svg" ? "svg" : "canvas");
  const exporter = new QRCodeStyling(options);
  const blob = await exporter.getRawData(format);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `qrforge-${state.type}.${format === "jpeg" ? "jpg" : format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${format === "jpeg" ? "JPG" : format.toUpperCase()} downloaded`);
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function escapeWifi(value) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function fitQrElement(previewNode, size) {
  const element = previewNode.querySelector("svg, canvas");
  if (!element) return;

  if (element.tagName.toLowerCase() === "svg") {
    element.setAttribute("viewBox", `0 0 ${size} ${size}`);
    element.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  element.removeAttribute("width");
  element.removeAttribute("height");
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.maxWidth = "280px";
  element.style.maxHeight = "280px";
  element.style.display = "block";
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

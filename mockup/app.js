const demoFiles = {
  "secret.bla": {
    apple: [
      "Remember to keep the encryption line-based.",
      "Each line has its own nonce.",
      "This one belongs to apple."
    ],
    banana: [
      "qA7!mZ2_xP9",
      "Lk$2vN8@tR4",
      "fD3%Qw1*Yp7"
    ]
  },
  "ideas.dat": {
    apple: [
      "Browser UI first.",
      "Python backend second.",
      "Keep the vault local.",
      "Make the interface unnecessarily stylish."
    ],
    banana: [
      "Build a second hidden interpretation.",
      "Different password, different readable lines.",
      "No password-validity indicator.",
      "Same file. Different words."
    ]
  },
  "journal.enc": {
    apple: [
      "The city outside is loud.",
      "The editor is quiet.",
      "That is enough for tonight.",
      "",
      "2026-09-26"
    ],
    banana: [
      "mZ#9v Qk*L 7!aP$",
      "xJ3_pL0@uK8",
      "8f^rTq$nV!2",
      "H@l0xF2/qM#",
      "<different password>"
    ]
  }
};

let activeFile = "secret.bla";

const editor = document.getElementById("editor");
const masterPasswordInput = document.getElementById("masterPassword");
const secondaryKeyInput = document.getElementById("secondaryKey");
const activeFilename = document.getElementById("activeFilename");
const statusText = document.getElementById("statusText");
const toggleMasterPassword = document.getElementById("toggleMasterPassword");
const toggleSecondaryKey = document.getElementById("toggleSecondaryKey");

function getCombinedCredential() {
  return masterPasswordInput.value + "\0" + secondaryKeyInput.value;
}

function getProfileKey() {
  return secondaryKeyInput.value;
}

function pseudoGibberish(text, password) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/!.,:;()[]{}_?=@#$%&";
  let seed = 0;

  for (const char of password + text) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  let output = "";

  for (let i = 0; i < Math.max(text.length, 12); i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    output += alphabet[seed % alphabet.length];
  }

  return output;
}

function getVisibleLines() {
  const profileKey = getProfileKey();
  const combinedCredential = getCombinedCredential();
  const file = demoFiles[activeFile];

  if (masterPasswordInput.value === "master" && file[profileKey]) {
    return {
      lines: file[profileKey],
      knownProfile: true
    };
  }

  const source = file.apple || Object.values(file)[0];

  return {
    lines: source.map(line => pseudoGibberish(line, combinedCredential)),
    knownProfile: false
  };
}

function render() {
  const result = getVisibleLines();

  editor.innerHTML = "";

  result.lines.forEach((text, index) => {
    const row = document.createElement("div");
    row.className = "line";

    const number = document.createElement("div");
    number.className = "line-number";
    number.textContent = index + 1;

    const content = document.createElement("div");
    content.className = "line-text" + (result.knownProfile ? "" : " gibberish");
    content.textContent = text || " ";

    row.append(number, content);
    editor.appendChild(row);
  });

  activeFilename.textContent = activeFile;
  statusText.textContent = result.knownProfile
    ? "Key profile: " + secondaryKeyInput.value
    : "Unrecognized credential pair → deterministic mock gibberish";
}

document.querySelectorAll(".file-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".file-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activeFile = button.dataset.file;
    render();
  });
});

masterPasswordInput.addEventListener("input", render);
secondaryKeyInput.addEventListener("input", render);

toggleMasterPassword.addEventListener("click", () => {
  const hidden = masterPasswordInput.type === "password";
  masterPasswordInput.type = hidden ? "text" : "password";
  toggleMasterPassword.textContent = hidden ? "HIDE" : "SHOW";
});

toggleSecondaryKey.addEventListener("click", () => {
  const hidden = secondaryKeyInput.type === "password";
  secondaryKeyInput.type = hidden ? "text" : "password";
  toggleSecondaryKey.textContent = hidden ? "HIDE" : "SHOW";
});

render();


const transparencySlider = document.getElementById("transparencySlider");
const transparencyValue = document.getElementById("transparencyValue");

function updateTransparency() {
  const percent = Number(transparencySlider.value);
  const alpha = percent / 100;

  document.documentElement.style.setProperty("--glass-alpha", alpha.toFixed(2));
  transparencyValue.textContent = percent + "%";
}

transparencySlider.addEventListener("input", updateTransparency);
updateTransparency();


const backgroundButton = document.getElementById("backgroundButton");
const textColor = document.getElementById("textColor");
const fileColor = document.getElementById("fileColor");

const backgroundOptions = [
  { id: "dark", label: "DARK", url: null },
  { id: "background-cyberpunk-room.png", label: "BG 1", url: "assets/background-cyberpunk-room.png" },
  { id: "background-cyberpunk-room_2.png", label: "BG 2", url: "assets/background-cyberpunk-room_2.png" },
  { id: "background-cyberpunk-room_3.png", label: "BG 3", url: "assets/background-cyberpunk-room_3.png" }
];

let selectedBackgroundId = "background-cyberpunk-room.png";

function preferenceKey(filename) {
  return "endecrypt-demo:" + filename;
}

function getBackgroundById(id) {
  return backgroundOptions.find(bg => bg.id === id) || null;
}

function getCurrentBackgroundIndex() {
  return backgroundOptions.findIndex(bg => bg.id === selectedBackgroundId);
}

function loadPreferences() {
  const saved = JSON.parse(localStorage.getItem(preferenceKey(activeFile)) || "{}");

  if (saved.glass !== undefined) transparencySlider.value = saved.glass;
  if (saved.textColor) textColor.value = saved.textColor;
  if (saved.fileColor) fileColor.value = saved.fileColor;
  if (saved.background) selectedBackgroundId = saved.background;

  // Fallback if saved background no longer exists
  if (!getBackgroundById(selectedBackgroundId)) {
    if (backgroundOptions.length > 0) {
      selectedBackgroundId = backgroundOptions[0].id;
    } else {
      selectedBackgroundId = "dark";
    }
  }

  applyAppearance(false);
}

function savePreferences() {
  localStorage.setItem(
    preferenceKey(activeFile),
    JSON.stringify({
      glass: Number(transparencySlider.value),
      textColor: textColor.value,
      fileColor: fileColor.value,
      background: selectedBackgroundId
    })
  );
  updateFileListColors();
}

function applyAppearance(save = true) {
  updateTransparency();

  document.documentElement.style.setProperty("--text-user", textColor.value);
  document.documentElement.style.setProperty("--file-user", fileColor.value);

  let selected = getBackgroundById(selectedBackgroundId);

  // Fallback if a background was removed
  if (!selected) {
    selected = backgroundOptions[0] || { id: "dark", label: "DARK", url: null };
    selectedBackgroundId = selected.id;
  }

  if (!selected.url) {
    document.body.style.background =
      "linear-gradient(135deg, #040507 0%, #090b12 55%, #080510 100%)";
    backgroundButton.textContent = "BACKGROUND: " + selected.label;
  } else {
    document.body.style.background =
      'linear-gradient(rgba(2,5,10,.28), rgba(2,5,10,.42)), url("' + selected.url + '") center center / cover fixed no-repeat';
    backgroundButton.textContent = "BACKGROUND: " + selected.label;
  }

  if (save) savePreferences();
}

function updateFileListColors() {
  document.querySelectorAll(".file-item").forEach(button => {
    const filename = button.dataset.file;

    const saved = JSON.parse(
      localStorage.getItem(preferenceKey(filename)) || "{}"
    );

    const color = saved.fileColor || "#ff4fd8";

    const nameElement = button.querySelector("span");

    if (nameElement) {
      nameElement.style.color = color;
    }
  });
}

backgroundButton.addEventListener("click", () => {
  const currentIndex = getCurrentBackgroundIndex();
  const nextIndex = (currentIndex + 1) % backgroundOptions.length;
  selectedBackgroundId = backgroundOptions[nextIndex].id;
  applyAppearance();
});

textColor.addEventListener("input", () => applyAppearance());
fileColor.addEventListener("input", () => applyAppearance());
transparencySlider.addEventListener("input", savePreferences);

document.querySelectorAll(".file-item").forEach(button => {
  button.addEventListener("click", () => {
    setTimeout(loadPreferences, 0);
  });
});

loadPreferences();
updateFileListColors();


const clockDisplay = document.getElementById("clockDisplay");
let clockMode = Number(localStorage.getItem("endecrypt-demo:clock-mode") || 0);

function pad2(value) {
  return String(value).padStart(2, "0");
}

function groupedYear(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function updateClock() {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mi = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());

  if (clockMode === 0) {
    clockDisplay.textContent = hh + ":" + mi;
  } else if (clockMode === 1) {
    clockDisplay.textContent = hh + ":" + mi + ":" + ss;
  } else if (clockMode === 2) {
    clockDisplay.textContent =
      yyyy + "-" + mm + "-" + dd + " " + hh + ":" + mi + ":" + ss;
  } else {
    const bigBangYear = 13800010000 + yyyy;
    clockDisplay.textContent =
      groupedYear(bigBangYear) + " " + hh + ":" + mi + ":" + ss;
  }
}

clockDisplay.addEventListener("click", () => {
  clockMode = (clockMode + 1) % 4;
  localStorage.setItem("endecrypt-demo:clock-mode", clockMode);
  updateClock();
});

updateClock();
setInterval(updateClock, 1000);

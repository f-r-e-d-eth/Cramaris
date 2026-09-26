let vaultFiles = [];
let vaultImages = [];
let vaultPath = "";
let activeFile = null;

async function loadVault() {
  const response = await fetch("/api/vault");
  if (!response.ok) {
    throw new Error("Could not load vault");
  }

  const data = await response.json();
  vaultFiles = data.files || [];
  vaultImages = data.images || [];
  vaultPath = data.path || "";

  const vaultPathElement = document.getElementById("vaultPath");
  if (vaultPathElement) {
    vaultPathElement.textContent = vaultPath;
  }

  if (!activeFile || !vaultFiles.some(file => file.name === activeFile)) {
    activeFile = vaultFiles.length ? vaultFiles[0].name : null;
  }

  if (activeFile && !demoFiles[activeFile]) {
    try {
      await loadRealFile(activeFile);
    } catch (error) {
      console.error(error);
      statusText.textContent = error.message;
    }
  }

  renderFileList();
  refreshBackgroundOptions();
  loadPreferences();
  render();
}

function renderFileList() {
  const fileList = document.getElementById("fileList");
  fileList.innerHTML = "";

  if (!vaultFiles.length) {
    const empty = document.createElement("div");
    empty.className = "empty-vault";
    empty.textContent = "Vault is empty";
    fileList.appendChild(empty);
    return;
  }

  vaultFiles.forEach(file => {
    const button = document.createElement("button");
    button.className = "file-item" + (file.name === activeFile ? " active" : "");
    button.dataset.file = file.name;

    const name = document.createElement("span");
    name.textContent = file.name;

    const info = document.createElement("small");
    info.textContent = file.lines + (file.lines === 1 ? " line" : " lines");

    button.append(name, info);

    button.addEventListener("click", async () => {
      activeFile = file.name;
      editingLineIndex = null;

      if (!demoFiles[activeFile]) {
        try {
          await loadRealFile(activeFile);
        } catch (error) {
          console.error(error);
          statusText.textContent = error.message;
        }
      }

      renderFileList();
      loadPreferences();
      render();
      updateFileListColors();
    });

    fileList.appendChild(button);
  });

  updateFileListColors();
}

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

const editedFiles = {};
const realFileLines = {};
let editingLineIndex = null;

async function loadRealFile(filename) {
  const response = await fetch("/api/file/" + encodeURIComponent(filename));
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load file");
  }

  realFileLines[filename] = data.lines || [];
  delete editedFiles[filename];
}

async function saveRealFile(filename, lines) {
  const response = await fetch("/api/file/" + encodeURIComponent(filename), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ lines })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not save file");
  }

  realFileLines[filename] = [...lines];
}

function getEditableLinesForActiveFile() {
  if (!editedFiles[activeFile]) {
    const visible = getVisibleLines();
    editedFiles[activeFile] = [...visible.lines];
  }
  return editedFiles[activeFile];
}

const editor = document.getElementById("editor");
const masterPasswordInput = document.getElementById("masterPassword");
const secondaryKeyInput = document.getElementById("secondaryKey");
const activeFilename = document.getElementById("activeFilename");
const statusText = document.getElementById("statusText");
const toggleMasterPassword = document.getElementById("toggleMasterPassword");
const toggleSecondaryKey = document.getElementById("toggleSecondaryKey");
const cryptoToggle = document.getElementById("cryptoToggle");
const chooseFolderButton = document.getElementById("chooseFolderButton");

let cryptoEnabled = localStorage.getItem("endecrypt-demo:crypto-enabled") !== "false";

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
  if (!activeFile) {
    return {
      lines: ["No editable files found in the vault.", "Add a text/encrypted file to the vault folder and refresh."],
      knownProfile: true,
      plainMode: true
    };
  }

  const profileKey = getProfileKey();
  const combinedCredential = getCombinedCredential();
  const file = demoFiles[activeFile];

  if (!file) {
    const source = realFileLines[activeFile] || [];

    if (!cryptoEnabled) {
      return {
        lines: source,
        knownProfile: true,
        plainMode: true
      };
    }

    const placeholder = source.length
      ? source
      : ["Encrypted mode for real files will be connected in Step 4."];

    return {
      lines: placeholder.map(line => pseudoGibberish(line, combinedCredential)),
      knownProfile: false,
      plainMode: false
    };
  }

  const source = file.apple || Object.values(file)[0];

  if (!cryptoEnabled) {
    return {
      lines: source,
      knownProfile: true,
      plainMode: true
    };
  }

  if (masterPasswordInput.value === "master" && file[profileKey]) {
    return {
      lines: file[profileKey],
      knownProfile: true,
      plainMode: false
    };
  }

  return {
    lines: source.map(line => pseudoGibberish(line, combinedCredential)),
    knownProfile: false,
    plainMode: false
  };
}

function render() {
  const result = getVisibleLines();
  const lines = editedFiles[activeFile] || result.lines;

  editor.innerHTML = "";

  lines.forEach((text, index) => {
    const row = document.createElement("div");
    row.className = "line";

    if (editingLineIndex === index) {
      row.classList.add("editing");

      const main = document.createElement("div");
      main.className = "line-editor-main";

      const lineNumber = document.createElement("div");
      lineNumber.className = "line-editor-number";
      lineNumber.textContent = index + 1;

      const body = document.createElement("div");
      body.className = "line-editor-body";

      const input = document.createElement("textarea");
      input.className = "line-editor-input";
      input.value = text;

      const hint = document.createElement("div");
      hint.className = "line-editor-hint";
      hint.textContent = "ENTER = SAVE · ESC = CANCEL";

      body.append(input);

      const footer = document.createElement("div");
      footer.className = "line-editor-footer";

      main.append(lineNumber, body);

      const actions = document.createElement("div");
      actions.className = "line-editor-actions";

      const addButton = document.createElement("button");
      addButton.textContent = "+ NEW LINE";
      addButton.type = "button";

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "DELETE";
      deleteButton.type = "button";
      deleteButton.className = "delete-line";

      const cancelButton = document.createElement("button");
      cancelButton.textContent = "CANCEL";
      cancelButton.type = "button";
      
      actions.append(
          addButton,
          deleteButton,
          cancelButton
      );
      
      footer.append(actions, hint);
      body.append(footer);

      async function saveAndClose() {
        const mutable = getEditableLinesForActiveFile();
        mutable[index] = input.value;

        if (!cryptoEnabled && activeFile && !demoFiles[activeFile]) {
          try {
            await saveRealFile(activeFile, mutable);
            await loadVault();
          } catch (error) {
            console.error(error);
            statusText.textContent = error.message;
            return;
          }
        }

        editingLineIndex = null;
        render();
      }

      input.addEventListener("keydown", async event => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          await saveAndClose();
        } else if (event.key === "Escape") {
          event.preventDefault();
          editingLineIndex = null;
          render();
        }
      });

      addButton.addEventListener("click", async () => {
        const mutable = getEditableLinesForActiveFile();
        mutable[index] = input.value;
        mutable.splice(index + 1, 0, "");

        if (!cryptoEnabled && activeFile && !demoFiles[activeFile]) {
          try {
            await saveRealFile(activeFile, mutable);
            await loadVault();
          } catch (error) {
            console.error(error);
            statusText.textContent = error.message;
            return;
          }
        }

        editingLineIndex = index + 1;
        render();
      });

      deleteButton.addEventListener("click", async () => {
        const mutable = getEditableLinesForActiveFile();
        mutable.splice(index, 1);

        if (!cryptoEnabled && activeFile && !demoFiles[activeFile]) {
          try {
            await saveRealFile(activeFile, mutable);
            await loadVault();
          } catch (error) {
            console.error(error);
            statusText.textContent = error.message;
            return;
          }
        }

        editingLineIndex = null;
        render();
      });

      cancelButton.addEventListener("click", () => {
        editingLineIndex = null;
        render();
      });

      row.append(main);
      editor.appendChild(row);

      setTimeout(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }, 0);

      return;
    }

    const number = document.createElement("div");
    number.className = "line-number";
    number.textContent = index + 1;

    const content = document.createElement("div");
    content.className = "line-text" + (result.knownProfile ? "" : " gibberish");
    content.textContent = text || " ";

    row.append(number, content);

    row.addEventListener("dblclick", () => {
      editingLineIndex = index;
      getEditableLinesForActiveFile();
      render();
    });

    editor.appendChild(row);
  });

  activeFilename.textContent = activeFile || "no file";
  statusText.textContent = result.plainMode
    ? "Plain text mode — encryption disabled"
    : result.knownProfile
      ? "Key profile: " + secondaryKeyInput.value
      : "Unrecognized credential pair → deterministic mock gibberish";
}

document.querySelectorAll(".file-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".file-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activeFile = button.dataset.file;
    editingLineIndex = null;
    render();
  });
});

masterPasswordInput.addEventListener("input", () => {
  delete editedFiles[activeFile];
  editingLineIndex = null;
  render();
});
secondaryKeyInput.addEventListener("input", () => {
  delete editedFiles[activeFile];
  editingLineIndex = null;
  render();
});

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

function updateCryptoToggle() {
  cryptoToggle.textContent = cryptoEnabled ? "CRYPT ON" : "CRYPT OFF";
  cryptoToggle.classList.toggle("active", cryptoEnabled);
}

cryptoToggle.addEventListener("click", () => {
  cryptoEnabled = !cryptoEnabled;
  localStorage.setItem("endecrypt-demo:crypto-enabled", cryptoEnabled);
  updateCryptoToggle();

chooseFolderButton.addEventListener("click", async () => {
  const requestedPath = window.prompt(
    "Vault folder path:",
    vaultPath || ""
  );

  if (!requestedPath) {
    return;
  }

  const response = await fetch("/api/vault", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: requestedPath
    })
  });

  const data = await response.json();

  if (!response.ok) {
    window.alert(data.error || "Could not change vault folder.");
    return;
  }

  activeFile = null;
  editingLineIndex = null;
  Object.keys(editedFiles).forEach(key => delete editedFiles[key]);
  Object.keys(realFileLines).forEach(key => delete realFileLines[key]);

  await loadVault();
});
  render();
});

updateCryptoToggle();


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
const contentColor = document.getElementById("contentColor");

let backgroundOptions = [];
let selectedBackgroundId = "dark";

function refreshBackgroundOptions() {
  backgroundOptions = [
    { id: "dark", label: "DARK", url: null },
    ...vaultImages.map((image, index) => ({
      id: image.name,
      label: "BG " + (index + 1),
      url: image.url
    }))
  ];

  if (!getBackgroundById(selectedBackgroundId)) {
    selectedBackgroundId = backgroundOptions.length > 1
      ? backgroundOptions[1].id
      : "dark";
  }
}

function preferenceKey(filename) {
  return "endecrypt-demo:" + (filename || "__vault__");
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
  if (saved.contentColor) {
    contentColor.value = saved.contentColor;
  } else if (saved.textColor || saved.fileColor) {
    contentColor.value = saved.fileColor || saved.textColor;
  }
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
      contentColor: contentColor.value,
      background: selectedBackgroundId
    })
  );
  updateFileListColors();
}

function applyAppearance(save = true) {
  updateTransparency();

  document.documentElement.style.setProperty("--content-user", contentColor.value);
  document.documentElement.style.setProperty("--text-user", contentColor.value);
  document.documentElement.style.setProperty("--file-user", contentColor.value);

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

    const color = saved.contentColor || saved.fileColor || saved.textColor || "#55f3ff";

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

contentColor.addEventListener("input", () => applyAppearance());
transparencySlider.addEventListener("input", savePreferences);

document.querySelectorAll(".file-item").forEach(button => {
  button.addEventListener("click", () => {
    setTimeout(loadPreferences, 0);
  });
});

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
      groupedYear(bigBangYear) + "-" + mm + "-" + dd + " " + hh + ":" + mi + ":" + ss;
  }
}

clockDisplay.addEventListener("click", () => {
  clockMode = (clockMode + 1) % 4;
  localStorage.setItem("endecrypt-demo:clock-mode", clockMode);
  updateClock();
});

updateClock();
setInterval(updateClock, 1000);


loadVault().catch(error => {
  console.error(error);
  statusText.textContent = "Could not load vault";
  activeFilename.textContent = "error";
});

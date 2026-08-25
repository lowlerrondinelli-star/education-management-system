const localFileStoreDbName = `${storageKey}-file-store`;
const localFileStoreName = "handles";
const localFileHandleKey = "main-data-file";

let localDataFileHandle = null;
let localDataFileName = "";
let localDataFileStatus = "未绑定本地数据文件";
let localDataFileTone = "";
let localDataFileSaveTimer = null;
let localDataFileSaving = false;
let localDataFileInitialized = false;

const localFileStyle = document.createElement("style");
localFileStyle.textContent = `
  .local-file-panel{border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:14px;background:#f8fbff;display:grid;gap:12px}
  .local-file-panel>div:first-child{display:grid;gap:6px}
  .local-file-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .local-file-status{border-radius:999px;background:var(--soft);color:#31506f;font-size:12px;font-weight:700;padding:5px 9px}
  .local-file-status.green{background:#e8f7ef;color:var(--green)}
  .local-file-status.amber{background:#fff4df;color:var(--amber)}
  .local-file-status.red{background:#fff0e8;color:var(--red)}
  @media (max-width:650px){.local-file-panel .action-row,.local-file-panel .primary-action,.local-file-panel .small-button{width:100%}}
`;
document.head.appendChild(localFileStyle);

function localFileSupported() {
  return Boolean(window.showOpenFilePicker && window.showSaveFilePicker && window.indexedDB);
}

function openLocalFileDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(localFileStoreDbName, 1);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(localFileStoreName);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function localFileDbGet(key) {
  const db = await openLocalFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(localFileStoreName, "readonly");
    const request = tx.objectStore(localFileStoreName).get(key);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
    tx.addEventListener("complete", () => db.close());
  });
}

async function localFileDbSet(key, value) {
  const db = await openLocalFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(localFileStoreName, "readwrite");
    tx.objectStore(localFileStoreName).put(value, key);
    tx.addEventListener("complete", () => {
      db.close();
      resolve();
    });
    tx.addEventListener("error", () => reject(tx.error));
  });
}

async function localFileDbDelete(key) {
  const db = await openLocalFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(localFileStoreName, "readwrite");
    tx.objectStore(localFileStoreName).delete(key);
    tx.addEventListener("complete", () => {
      db.close();
      resolve();
    });
    tx.addEventListener("error", () => reject(tx.error));
  });
}

function buildLocalFilePayload() {
  return {
    app: "教务管理系统本地原型",
    version: 2,
    savedAt: new Date().toISOString(),
    storage: "local-file",
    state: appState
  };
}

async function requestLocalFilePermission(handle, mode = "readwrite") {
  const options = { mode };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

function setLocalFileStatus(message, tone = "") {
  localDataFileStatus = message;
  localDataFileTone = tone;
  updateLocalFilePanel();
}

function updateLocalFilePanel() {
  const panel = document.querySelector("#localFilePanel");
  if (!panel) return;
  const status = panel.querySelector("#localFileStatus");
  const fileName = panel.querySelector("#localFileName");
  if (status) {
    status.textContent = localDataFileStatus;
    status.className = `local-file-status ${localDataFileTone}`.trim();
  }
  if (fileName) fileName.textContent = localDataFileName || "尚未选择";
}

async function writeLocalDataFile(reason = "manual") {
  if (!localDataFileHandle || localDataFileSaving) return false;
  try {
    localDataFileSaving = true;
    const granted = await requestLocalFilePermission(localDataFileHandle, "readwrite");
    if (!granted) {
      setLocalFileStatus("浏览器尚未授权写入，请点击“立即保存到文件”重新授权。", "amber");
      return false;
    }
    const writable = await localDataFileHandle.createWritable();
    await writable.write(JSON.stringify(buildLocalFilePayload(), null, 2));
    await writable.close();
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLocalFileStatus(`${reason === "auto" ? "自动保存" : "手动保存"}成功：${time}`, "green");
    return true;
  } catch (error) {
    setLocalFileStatus(`保存失败：${error.message || "请确认文件没有被占用"}`, "red");
    return false;
  } finally {
    localDataFileSaving = false;
  }
}

function queueLocalDataFileSave() {
  if (!localDataFileInitialized || !localDataFileHandle) return;
  clearTimeout(localDataFileSaveTimer);
  localDataFileSaveTimer = setTimeout(() => {
    writeLocalDataFile("auto");
  }, 900);
}

async function readLocalDataFile(handle) {
  const granted = await requestLocalFilePermission(handle, "read");
  if (!granted) throw new Error("没有读取权限");
  const file = await handle.getFile();
  const parsed = JSON.parse(await file.text());
  return normalizeState(parsed.state || parsed);
}

async function connectNewLocalDataFile() {
  if (!localFileSupported()) {
    setLocalFileStatus("当前浏览器不支持自动写入本地文件，请继续使用完整备份。", "amber");
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "教务管理系统本地数据.json",
      types: [
        {
          description: "教务管理系统数据文件",
          accept: { "application/json": [".json"] }
        }
      ]
    });
    localDataFileHandle = handle;
    localDataFileName = handle.name;
    await localFileDbSet(localFileHandleKey, handle);
    await writeLocalDataFile("manual");
    setNotice("data", `已绑定本地数据文件：${handle.name}`);
    renderView();
  } catch (error) {
    if (error.name !== "AbortError") setLocalFileStatus(`绑定失败：${error.message || "请选择可写入的位置"}`, "red");
  }
}

async function openExistingLocalDataFile() {
  if (!localFileSupported()) {
    setLocalFileStatus("当前浏览器不支持读取绑定文件，请使用“恢复备份”。", "amber");
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "教务管理系统数据文件",
          accept: { "application/json": [".json"] }
        }
      ]
    });
    const nextState = await readLocalDataFile(handle);
    await requestLocalFilePermission(handle, "readwrite");
    localDataFileHandle = handle;
    localDataFileName = handle.name;
    await localFileDbSet(localFileHandleKey, handle);
    appState = nextState;
    operationNotice = { view: "data", text: `已读取并绑定本地数据文件：${handle.name}`, tone: "green" };
    saveState();
    setView("data");
  } catch (error) {
    if (error.name !== "AbortError") setLocalFileStatus(`读取失败：${error.message || "文件内容不符合系统格式"}`, "red");
  }
}

async function saveLocalDataFileNow() {
  if (!localDataFileHandle) {
    await connectNewLocalDataFile();
    return;
  }
  await writeLocalDataFile("manual");
}

async function disconnectLocalDataFile() {
  localDataFileHandle = null;
  localDataFileName = "";
  await localFileDbDelete(localFileHandleKey);
  setLocalFileStatus("已断开本地数据文件，后续仅保存到浏览器本地。", "amber");
}

function renderLocalFilePanel() {
  const supported = localFileSupported();
  return `
    <div class="local-file-panel" id="localFilePanel">
      <div>
        <strong>本地数据文件</strong>
        <span class="muted">绑定后，每次保存业务数据都会同步写入一个 JSON 文件，适合单机长期试用。</span>
      </div>
      <div class="local-file-meta">
        <span>绑定文件：<strong id="localFileName">${escapeHtml(localDataFileName || "尚未选择")}</strong></span>
        <span id="localFileStatus" class="local-file-status ${localDataFileTone}">${escapeHtml(localDataFileStatus)}</span>
      </div>
      <div class="action-row">
        <button class="primary-action" type="button" id="connectDataFile" ${supported ? "" : "disabled"}>创建/绑定文件</button>
        <button class="small-button" type="button" id="openDataFile" ${supported ? "" : "disabled"}>读取已有文件</button>
        <button class="small-button" type="button" id="saveDataFileNow" ${supported ? "" : "disabled"}>立即保存到文件</button>
        <button class="small-button" type="button" id="disconnectDataFile" ${localDataFileHandle ? "" : "disabled"}>断开文件</button>
      </div>
      ${supported ? "" : `<span class="muted">当前浏览器没有开放本地文件写入能力；仍可使用下方“完整备份/恢复备份”。</span>`}
    </div>`;
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForLocalFile = renderDataCenter;
  renderDataCenter = function renderDataCenterWithLocalFile() {
    baseRenderDataCenterForLocalFile();
    const sectionBody = appContent.querySelector(".section-body");
    if (!sectionBody || sectionBody.querySelector("#localFilePanel")) return;
    const importPanel = sectionBody.querySelector(".import-panel");
    if (importPanel) {
      importPanel.insertAdjacentHTML("afterend", renderLocalFilePanel());
    } else {
      sectionBody.insertAdjacentHTML("afterbegin", renderLocalFilePanel());
    }
  };
}

const baseSaveStateForLocalFile = saveState;
saveState = function saveStateWithLocalFile() {
  baseSaveStateForLocalFile();
  queueLocalDataFileSave();
};

if (typeof authClickPolicies !== "undefined" && Array.isArray(authClickPolicies)) {
  authClickPolicies.push(["#connectDataFile, #openDataFile, #saveDataFileNow, #disconnectDataFile", "data", "本地数据文件"]);
}

document.addEventListener("click", (event) => {
  if (event.target.id === "connectDataFile") connectNewLocalDataFile();
  if (event.target.id === "openDataFile") openExistingLocalDataFile();
  if (event.target.id === "saveDataFileNow") saveLocalDataFileNow();
  if (event.target.id === "disconnectDataFile") disconnectLocalDataFile();
});

(async function initLocalFileStore() {
  if (!localFileSupported()) {
    localDataFileStatus = "当前浏览器不支持自动写入文件";
    localDataFileTone = "amber";
    localDataFileInitialized = true;
    return;
  }
  try {
    localDataFileHandle = await localFileDbGet(localFileHandleKey);
    localDataFileName = localDataFileHandle?.name || "";
    localDataFileStatus = localDataFileHandle ? "已记住绑定文件，首次自动保存时可能需要授权。" : "未绑定本地数据文件";
  } catch {
    localDataFileStatus = "读取文件绑定状态失败，可重新绑定。";
    localDataFileTone = "amber";
  } finally {
    localDataFileInitialized = true;
    updateLocalFilePanel();
  }
})();

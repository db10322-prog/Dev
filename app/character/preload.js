const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentAPI", {
  analyzeCurrentTab: () => ipcRenderer.invoke("analyze-current-tab"),
  onReportReady: (callback) => ipcRenderer.on("report-ready", (_event, report) => callback(report)),
  openSettings: () => ipcRenderer.invoke("open-settings"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (values) => ipcRenderer.invoke("save-settings", values),
});

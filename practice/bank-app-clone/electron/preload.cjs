const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  saveRecording: (buffer, ext) => ipcRenderer.invoke("recording:save", { buffer, ext }),
});

const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  onData: cb => ipcRenderer.on('data', (_e, d) => cb(d)),
  onExpanded: cb => ipcRenderer.on('expanded', (_e, v) => cb(v)),
  toggleExpand: () => ipcRenderer.send('toggle-expand'),
  setSort: v => ipcRenderer.send('set-sort', v),
  setOpacity: v => ipcRenderer.send('set-opacity', v),
  onOpacity: cb => ipcRenderer.on('opacity', (_e, v) => cb(v)),
  onClickThrough: cb => ipcRenderer.on('click-through', (_e, v) => cb(v)),
  quit: () => ipcRenderer.send('quit'),
});

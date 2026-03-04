const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong',
});

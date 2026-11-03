// VS Code owns this state per webview, including across Reload Window.
// Use its already-acquired API; preserve all native state and scope to roots.
if (typeof window !== 'undefined') {
  let scope;
  const key = 'crtlPanelRouteV1';
  window.__crtlPanelState = {
    async read() {
      crtlInitPanelApi();
      crtlInitPanelRoots();
      const result = await crtlReadPanelRoots({hostId: 'local'});
      if (!Array.isArray(result?.roots)) return null;
      scope = JSON.stringify(result.roots.map(crtlFolderPath).sort());
      const saved = crtlPanelApi.getState()?.[key];
      return saved?.scope === scope ? saved.path : null;
    },
    write(path) {
      if (scope === undefined) return;
      const current = crtlPanelApi.getState();
      crtlPanelApi.setState({...current, [key]: {scope, path}});
    }
  };
}

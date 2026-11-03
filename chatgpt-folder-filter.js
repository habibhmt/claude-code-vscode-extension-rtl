// Read-only filtering of the recent-chat view. Native stores keep every thread.
// The installer supplies imports from the inspected extension's own modules.
function crtlFolderPath(path) {
  if (typeof path !== 'string' || !path) return null;
  // Normalize separators/trailing slashes without treating sibling prefixes as the same folder.
  // The same folder also comes spelled differently (Unicode form, macOS /private and case): a chat
  // of this folder hidden for that breaks Habib's condition for this filter.
  const clean = path.normalize('NFC').replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\/private\/(tmp|var|etc)(?=\/|$)/, '/$1') || '/';
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || '') ? clean.toLowerCase() : clean;
}

export function crtlFilterFolderRows(rows, roots, merged = false) {
  if (!Array.isArray(rows)) return rows;
  // While the host is loading its folders, don't flash another project's chats.
  if (!Array.isArray(roots)) return [];
  // An empty VS Code window has no folder to filter by; preserve its native list.
  if (roots.length === 0) return rows;
  const paths = new Set(roots.map(crtlFolderPath).filter(Boolean));
  return rows.filter(row => {
    if (merged && row.kind !== 'local') return false;
    const thread = merged ? row.conversation : row;
    if (thread) {
      return (thread.hostId == null || thread.hostId === 'local') &&
        paths.has(crtlFolderPath(thread.cwd));
    }
    const pending = row.pendingWorktree || row.pendingThreadStart;
    if (!pending || (pending.hostId != null && pending.hostId !== 'local')) return false;
    return paths.has(crtlFolderPath(pending.sourceWorkspaceRoot ?? pending.task?.cwd));
  });
}

export function crtlUseFolderRows(rows, merged = false) {
  crtlInitInputs();
  const query = crtlUseQuery(crtlWorkspaceRoots, {hostId: 'local'});
  const roots = query.data?.roots;
  const React = crtlReact();
  // The folders could not be read: an empty list reads as «no chats», so the native list stays.
  const failed = query.isError === true;
  return React.useMemo(() => failed ? rows : crtlFilterFolderRows(rows, roots, merged), [rows, roots, merged, failed]);
}

export function crtlUseFolderResult(result) {
  const data = crtlUseFolderRows(result.data);
  return crtlReact().useMemo(() => ({...result, data}), [result, data]);
}

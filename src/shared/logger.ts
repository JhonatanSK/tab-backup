// Codes only: no exception objects, messages, URLs, titles, or snapshots.
export const logger = {
  error(code: 'background' | 'capture' | 'message') {
    if (import.meta.env.DEV) console.warn(`[TabBackup] ${code}`);
  },
};

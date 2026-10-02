const secretKey =
  /^(access_?token|refresh_?token|id_?token|token|auth|authorization|password|passwd|secret|api_?key|code|session_?id|signature|sig)$/i;
export function sanitizeUrl(raw: string): string | null {
  if (
    !raw ||
    raw.length > 8192 ||
    [...raw].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)
  )
    return null;
  try {
    const url = new URL(raw);
    if (
      ![
        'http:',
        'https:',
        'chrome:',
        'chrome-extension:',
        'about:',
        'file:',
      ].includes(url.protocol)
    )
      return null;
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()])
      if (secretKey.test(key)) url.searchParams.delete(key);
    if (
      /(?:access_?token|refresh_?token|id_?token|token|password|secret|api_?key|authorization)=/i.test(
        url.hash,
      )
    )
      url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
export function canRestore(raw: string): boolean {
  const clean = sanitizeUrl(raw);
  return (
    clean === raw &&
    (raw.startsWith('https://') ||
      raw.startsWith('http://') ||
      raw === 'about:blank')
  );
}

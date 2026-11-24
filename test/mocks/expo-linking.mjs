export function parse(url) {
  if (!url) return { scheme: null, hostname: null, path: null, queryParams: {} };
  try {
    const u = new URL(url);
    const queryParams = {};
    u.searchParams.forEach((v, k) => {
      queryParams[k] = v;
    });
    return {
      scheme: u.protocol.replace(':', ''),
      hostname: u.hostname,
      path: u.pathname.replace(/^\//, ''),
      queryParams,
    };
  } catch {
    return { scheme: null, hostname: null, path: null, queryParams: {} };
  }
}

export function addEventListener() {
  return { remove: () => {} };
}

export async function getInitialURL() {
  return null;
}

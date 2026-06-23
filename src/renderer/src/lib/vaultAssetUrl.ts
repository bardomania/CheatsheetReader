export function vaultAssetUrl(absolutePath: string): string {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(absolutePath) || /^(data|blob):/.test(absolutePath)) return absolutePath

  const normalized = absolutePath.replace(/\\/g, '/')
  return `app://vault-asset/${encodeURI(normalized)}`
}

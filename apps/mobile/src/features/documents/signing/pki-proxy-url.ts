/**
 * PKI CORS proxy origin for Nitro HTTP callbacks (SHO-255 / SHO-260).
 * Path matches `@showzy/document-signing` `PKI_PROXY_PATH` (`/pki/proxy`).
 */
export function pkiProxyUrl(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/+$/, "")}/pki/proxy`;
}

/**
 * Sign-In With Solana message. The wallet signs this text (signMessage); it
 * authorizes nothing on-chain. Shared by the server (which issues and checks
 * it) and the browser (which shows it).
 */
export function buildSignInMessage(params: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    `${params.domain} wants you to sign in with your Solana account:`,
    params.address,
    "",
    "Sign in to Orchestra to manage your investments. This signature does not move funds or approve any transaction.",
    "",
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt.toISOString()}`,
    `Expiration Time: ${params.expiresAt.toISOString()}`,
  ].join("\n");
}

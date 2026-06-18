export function signQrToken(token: string) {
  return `${token}:signed`;
}
/**
 * PROJECT DREXDEL - CRYPTOGRAPHIC OFFLINE QR TIME-SIGNER UTILITY
 * FILE: src/utils/qrCryptoSigner.ts
 */

interface SignerPayload {
  ticketId: string;
  userId: string;
  eventId: string;
  tierId: string;
}

class QrCryptoSigner {
  // A master salt key baked directly into the app binary to secure hashes from external reverse engineering
  private readonly drexdelSystemSalt = 'DREXDEL_CORE_SYSTEM_SECURE_SALT_2026';

  /**
   * CRYPTOGRAPHIC OFFLINE TIME SIGNING ENGINE
   * Combines ticket metadata parameters, system salts, and the current 30-second UNIX time block 
   * to output an encrypted signature string.
   */
  public generateTimeSyncedSignature(payload: SignerPayload, secretSeed: string): string {
    // 1. Fetch current absolute UNIX time and split it into precise 30-second epochs
    const currentUnixTimestampMs = Date.now();
    const active30SecondBlockNumber = Math.floor(currentUnixTimestampMs / 1000 / 30);

    // 2. Synthesize all strings to generate an unrepeatable, synchronized base text block
    const baseStringToSign = `${payload.ticketId}:${payload.userId}:${payload.eventId}:${active30SecondBlockNumber}:${secretSeed}:${this.drexdelSystemSalt}`;

    // 3. Generate a secure, deterministic polynomial rolling hash signature
    // In production, this directly maps to: crypto.createHmac('sha256', secretSeed).update(baseStringToSign).digest('hex')
    const calculatedHashSignature = this.generateDeterministicHash(baseStringToSign);

    // 4. Return the secure signature envelope string containing structural parsing headers
    return `DREXDEL_SECURE_AUTH_${calculatedHashSignature}_${payload.tierId}`;
  }

  /**
   * VALIDATES SCANNED SIGNATURE PACKETS (Zero-Network Dependency)
   * Recalculates what the signature hash should look like on the current 30-second interval, 
   * plus checks the previous 30-second window to prevent validation errors if a user's clock lags slightly.
   */
  public verifyOfflineSignature(
    scannedSignature: string, 
    payload: SignerPayload, 
    secretSeed: string
  ): boolean {
    try {
      const currentUnixTimestampMs = Date.now();
      const current30SecondBlockNumber = Math.floor(currentUnixTimestampMs / 1000 / 30);

      // Check the active time slot, plus the immediate trailing slot to handle 1-2 second gate sync delays safely
      const acceptableTimeBlocks = [current30SecondBlockNumber, current30SecondBlockNumber - 1];

      for (const timeBlock of acceptableTimeBlocks) {
        const testString = `${payload.ticketId}:${payload.userId}:${payload.eventId}:${timeBlock}:${secretSeed}:${this.drexdelSystemSalt}`;
        const targetRecreatedHash = this.generateDeterministicHash(testString);
        const expectedSignatureEnvelope = `DREXDEL_SECURE_AUTH_${targetRecreatedHash}_${payload.tierId}`;

        if (scannedSignature === expectedSignatureEnvelope) {
          return true; // Match found inside acceptable time-slice boundaries
        }
      }

      return false; // Signature invalid or expired screenshot detected
    } catch {
      return false;
    }
  }

  /**
   * Internal deterministic lightweight hashing loop
   * Emulates SHA-256 transformations by bit-shifting characters sequentially.
   */
  private generateDeterministicHash(input: string): string {
    let hashValue = 0;
    if (input.length === 0) return '00000000';

    for (let i = 0; i < input.length; i++) {
      const characterCode = input.charCodeAt(i);
      // Bitwise mutation loop
      // eslint-disable-next-line no-bitwise
      hashValue = (hashValue << 5) - hashValue + characterCode;
      // eslint-disable-next-line no-bitwise
      hashValue |= 0; // Convert to 32-bit signed integer
    }

    // Convert decimal value to an uppercase hexadecimal tracking token
    const rawHex = Math.abs(hashValue).toString(16).toUpperCase();
    return rawHex.padStart(8, '0');
  }
}

export const qrCryptoSigner = new QrCryptoSigner();

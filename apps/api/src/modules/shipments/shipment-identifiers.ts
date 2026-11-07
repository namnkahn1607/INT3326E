import { randomBytes } from 'node:crypto';

const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function base32(value: bigint, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result = alphabet[Number(value & 31n)] + result;
    value >>= 5n;
  }
  return result;
}

export function shipmentIdentifiers(now: Date): { id: string; trackingNumber: string } {
  const entropy = BigInt(`0x${randomBytes(10).toString('hex')}`);
  return {
    id: `sh_${base32(BigInt(now.getTime()), 10)}${base32(entropy, 16)}`,
    trackingNumber: `PF${now.toISOString().slice(0, 10).replaceAll('-', '')}${base32(BigInt(`0x${randomBytes(4).toString('hex')}`), 6)}`,
  };
}

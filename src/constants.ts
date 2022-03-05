import { PublicKey } from '@solana/web3.js';

export const U32_MAX = 0xffffffff;
export const MAX_NAME_LENGTH = 255;
export const RUST_DEFAULT_PUBLIC_KEY = new PublicKey(
  '11111111111111111111111111111111'
);

export class Signatory {
  static TWILIO = new PublicKey('H3eJ6gDobGnkmuU5t8bYybCH4wu9BQc5e2s3Nk5tM4Fy');
}

export const STARMAP_PROGRAM_ID = new PublicKey(
  'starsfMtotCRZ2F7Bn5U2U7auwguBSJRPX3mhbwafoY'
);

// cSpell:ignore u8mnnXiQLYhVdjuE9wSzEpicpfgaM83ohw6SpGcFg5k
export const TREASURY_ACCOUNT = new PublicKey(
  'u8mnnXiQLYhVdjuE9wSzEpicpfgaM83ohw6SpGcFg5k'
);

// cSpell:ignore u8mnnXiQLYhVdjuE9wSzEpicpfgaM83ohw6SpGcFg5k
export const CONFIG_ACCOUNT = new PublicKey(
  'J3w6cXha2dihL628GPMHFtGkqPzEr8KCFF6c6SLfcexJ'
);

export enum AccountType {
  Record = 1,
  Escrow = 2,
  Config = 3,
  // Signatories = ,
  // StarFees = ,
}

export const MAJOR_VERSION = 1;

export enum RecordType {
  Invalid = 0,
  Phone = 1,
  Email = 2,
  Stars = 3,
  Civic = 4,
}

export enum ConfigType {
  Invalid = 0,
  General = 1,
}

import { Connection, PublicKey } from '@solana/web3.js';
import { deserializeUnchecked, Schema } from 'borsh';
import { RUST_DEFAULT_PUBLIC_KEY } from '.';

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

export enum AccountType {
  Record = 1,
  Escrow = 2,
  // Signatories = 3,
  // Fees = 4,
}

export const MAJOR_VERSION = 1;

export enum RecordType {
  Invalid = 0,
  Phone = 1,
  Email = 2,
  Stars = 3,
  Civic = 4,
}

export class StarState {
  // Constants
  static HEADER_LEN = 96;
  static MIN_VERSION = 1;

  // Blockchain data
  versionMajor: number;
  recordType: number;
  state: number;
  signatory: PublicKey;
  owner: PublicKey;
  routingInfo: Buffer | undefined;

  // Derived information
  isPresent: boolean = false;
  isAuthorized: boolean = false;
  isReadyToAssign: boolean = false;
  isAssignedAndValid: boolean = false;
  invalidReason: string = 'Need to call StarState.retrieve(...)';

  static schema: Schema = new Map([
    [
      StarState,
      {
        kind: 'struct',
        fields: [
          ['versionMajor', 'u8'],
          ['recordType', 'u8'],
          ['state', 'u16'],
          ['signatory', [32]],
          ['owner', [32]],
        ],
      },
    ],
  ]);
  constructor(obj: {
    versionMajor: number;
    recordType: number;
    state: number;
    signatory: Uint8Array;
    owner: Uint8Array;
  }) {
    this.versionMajor = obj.versionMajor;
    this.recordType = obj.recordType;
    this.state = obj.state;
    this.signatory = new PublicKey(obj.signatory);
    this.owner = new PublicKey(obj.owner);
  }

  public static empty(invalidReason: string = 'Uninitialized') {
    let ret = new StarState({
      versionMajor: 0,
      recordType: 0,
      state: 0,
      signatory: new Uint8Array(32),
      owner: new Uint8Array(32),
    });
    ret.invalidReason = invalidReason;
    return ret;
  }

  public static async retrieve(
    connection: Connection,
    nameAccountKey: PublicKey,
    programId: PublicKey
  ): Promise<StarState> {
    let accountInfo = await connection.getAccountInfo(
      nameAccountKey,
      'processed'
    );
    if (accountInfo === null) {
      return this.empty('Record account does not exist');
    }

    if (!accountInfo.owner.equals(programId)) {
      return this.empty('Record account exists but is not initialized');
    }

    let res: StarState = deserializeUnchecked(
      this.schema,
      StarState,
      accountInfo.data
    );
    res.routingInfo = accountInfo.data?.slice(this.HEADER_LEN);
    res.isPresent = true;

    if ((res.state & 6) === 6) {
      res.isAuthorized = true;
    } else if (res.state & 4) {
      res.isReadyToAssign = true;
    }

    if (res.versionMajor < this.MIN_VERSION) {
      res.invalidReason = `Invalid version: ${res.versionMajor}; ${this.MIN_VERSION} required.`;
      return res;
    }

    if (
      res.owner.equals(PublicKey.default) ||
      res.owner.equals(RUST_DEFAULT_PUBLIC_KEY)
    ) {
      res.invalidReason = 'Unowned record';
      return res;
    }

    res.isAssignedAndValid = true;
    return res;
  }
}
export class EscrowRootState {
  // Constants
  static LEN = 5;
  static MIN_VERSION = 1;

  // Blockchain data
  versionMajor: number;
  next_index: number;
  name_account: PublicKey;

  static schema: Schema = new Map([
    [
      EscrowRootState,
      {
        kind: 'struct',
        fields: [
          ['versionMajor', 'u8'],
          ['next_index', 'u32'],
          ['name_account', [32]],
        ],
      },
    ],
  ]);
  constructor(obj: {
    versionMajor: number;
    next_index: number;
    name_account: Uint8Array;
  }) {
    this.versionMajor = obj.versionMajor;
    this.next_index = obj.next_index;
    this.name_account = new PublicKey(obj.name_account);
  }

  public static empty() {
    let ret = new EscrowRootState({
      versionMajor: 0,
      next_index: 0xffffffff,
      name_account: PublicKey.default.toBytes(),
    });
    return ret;
  }

  public static async retrieve(
    connection: Connection,
    accountKey: PublicKey,
    programId: PublicKey
  ): Promise<EscrowRootState | null> {
    let accountInfo = await connection.getAccountInfo(accountKey, 'processed');
    if (accountInfo === null || !accountInfo.owner.equals(programId)) {
      return null;
    }
    return deserializeUnchecked(this.schema, EscrowRootState, accountInfo.data);
  }
}
export class EscrowState {
  // Constants
  static LEN = 45;
  static MIN_VERSION = 1;

  // Blockchain data
  versionMajor: number;
  name_account: PublicKey;
  index: number;
  prev_index: number;
  next_index: number;
  sender: PublicKey;
  mint: PublicKey;

  // Derived info
  address = PublicKey.default;

  static schema: Schema = new Map([
    [
      EscrowState,
      {
        kind: 'struct',
        fields: [
          ['versionMajor', 'u8'],
          ['next_index', 'u32'],
          ['name_account', [32]],
          ['index', 'u32'],
          ['prev_index', 'u32'],
          ['sender', [32]],
          ['mint', [32]],
        ],
      },
    ],
  ]);

  constructor(obj: {
    versionMajor: number;
    next_index: number;
    name_account: Uint8Array;
    index: number;
    prev_index: number;
    sender: Uint8Array;
    mint: Uint8Array;
  }) {
    this.versionMajor = obj.versionMajor;
    this.next_index = obj.next_index;
    this.name_account = new PublicKey(obj.name_account);
    this.index = obj.index;
    this.prev_index = obj.prev_index;
    this.sender = new PublicKey(obj.sender);
    this.mint = new PublicKey(obj.mint);
  }

  public static empty(
    index: number,
    prevIndex: number,
    nextIndex: number,
    address: PublicKey
  ) {
    let ret = new EscrowState({
      versionMajor: EscrowState.MIN_VERSION,
      next_index: nextIndex,
      name_account: PublicKey.default.toBytes(),
      index: index,
      prev_index: prevIndex,
      sender: PublicKey.default.toBytes(),
      mint: PublicKey.default.toBytes(),
    });
    ret.address = address;
    return ret;
  }

  public static async retrieve(
    connection: Connection,
    accountKey: PublicKey,
    programId: PublicKey
  ): Promise<EscrowState | null> {
    let accountInfo = await connection.getAccountInfo(accountKey, 'processed');
    if (accountInfo == null || !accountInfo.owner.equals(programId)) {
      return null;
    }
    var record = deserializeUnchecked(
      this.schema,
      EscrowState,
      accountInfo.data
    );
    record.address = accountKey;
    return record;
  }
}

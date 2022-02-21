import { Connection, PublicKey } from '@solana/web3.js';
import { deserializeUnchecked, Schema } from 'borsh';
import { RecordType } from '.';

class Signatory {
  static TWILIO = new PublicKey('H3eJ6gDobGnkmuU5t8bYybCH4wu9BQc5e2s3Nk5tM4Fy');
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

    if (res.owner === PublicKey.default) {
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

  static schema: Schema = new Map([
    [
      EscrowRootState,
      {
        kind: 'struct',
        fields: [
          ['versionMajor', 'u8'],
          ['next_index', 'u32'],
        ],
      },
    ],
  ]);
  constructor(obj: { versionMajor: number; next_index: number }) {
    this.versionMajor = obj.versionMajor;
    this.next_index = obj.next_index;
  }

  public static empty() {
    let ret = new EscrowRootState({
      versionMajor: 0,
      next_index: 0xffffffff,
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
  index: number;
  prev_index: number;
  next_index: number;
  sender: PublicKey;

  static schema: Schema = new Map([
    [
      EscrowState,
      {
        kind: 'struct',
        fields: [
          ['versionMajor', 'u8'],
          ['index', 'u32'],
          ['prev_index', 'u32'],
          ['next_index', 'u32'],
          ['sender', [32]],
        ],
      },
    ],
  ]);

  constructor(obj: {
    versionMajor: number;
    index: number;
    prev_index: number;
    next_index: number;
    sender: Uint8Array;
  }) {
    this.versionMajor = obj.versionMajor;
    this.index = obj.index;
    this.prev_index = obj.prev_index;
    this.next_index = obj.next_index;
    this.sender = new PublicKey(obj.sender);
  }

  public static empty(index: number, prevIndex: number, nextIndex: number) {
    let ret = new EscrowState({
      versionMajor: EscrowState.MIN_VERSION,
      index: index,
      prev_index: prevIndex,
      next_index: nextIndex,
      sender: PublicKey.default.toBytes(),
    });
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
    return deserializeUnchecked(this.schema, EscrowState, accountInfo.data);
  }
}

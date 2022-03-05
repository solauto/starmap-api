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

// cSpell:ignore u8mnnXiQLYhVdjuE9wSzEpicpfgaM83ohw6SpGcFg5k
export const CONFIG_ACCOUNT = new PublicKey(
  'J3w6cXha2dihL628GPMHFtGkqPzEr8KCFF6c6SLfcexJ'
);

export enum AccountType {
  Record = 1,
  Escrow = 2,
  Config = 3,
  // Signatories = ,
  // Fees = ,
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

export class ConfigState {
  // Constants
  static LEN = 37;
  static MIN_VERSION = 1;

  // Blockchain data
  versionMajor: number;
  
  name_verify_phone_lamports: number;
  name_verify_email_lamports: number;
  name_assign_phone_lamports: number;
  name_assign_email_lamports: number;

  name_transfer_lamports: number;
  name_delete_lamports: number;
  escrow_create_lamports: number;
  escrow_withdraw_lamports: number;
  escrow_delete_lamports: number;

  // Derived info
  address = PublicKey.default;

  static schema: Schema = new Map([
    [
      ConfigState,
      {
        kind: 'struct',
        fields: [
          ['versionMajor', 'u8'],
          ['name_verify_phone_lamports', 'u32'],
          ['name_verify_email_lamports', 'u32'],
          ['name_assign_phone_lamports', 'u32'],
          ['name_assign_email_lamports', 'u32'],

          ['name_transfer_lamports', 'u32'],
          ['name_delete_lamports', 'u32'],
          ['escrow_create_lamports', 'u32'],
          ['escrow_withdraw_lamports', 'u32'],
          ['escrow_delete_lamports', 'u32'],
        ],
      },
    ],
  ]);

  constructor(obj: {
    versionMajor: number;
    name_verify_phone_lamports: number;
    name_assign_phone_lamports: number;
    name_verify_email_lamports: number;
    name_assign_email_lamports: number;

    name_transfer_lamports: number;
    name_delete_lamports: number;
    escrow_create_lamports: number;
    escrow_withdraw_lamports: number;
    escrow_delete_lamports: number;
  }) {
    this.versionMajor = obj.versionMajor;
    this.name_verify_phone_lamports = obj.name_verify_phone_lamports;
    this.name_verify_email_lamports = obj.name_verify_email_lamports;
    this.name_assign_phone_lamports = obj.name_assign_phone_lamports;
    this.name_assign_email_lamports = obj.name_assign_email_lamports;

    this.name_transfer_lamports = obj.name_transfer_lamports;
    this.name_delete_lamports = obj.name_delete_lamports;
    this.escrow_create_lamports = obj.escrow_create_lamports;
    this.escrow_withdraw_lamports = obj.escrow_withdraw_lamports;
    this.escrow_delete_lamports = obj.escrow_delete_lamports;
  }

  public static new(
    address: PublicKey,
    name_verify_phone_lamports: number,
    name_assign_phone_lamports: number,
    name_verify_email_lamports: number,
    name_assign_email_lamports: number,
    
    name_transfer_lamports: number,
    name_delete_lamports: number,
    escrow_create_lamports: number,
    escrow_withdraw_lamports: number,
    escrow_delete_lamports: number,
  ) {
    let ret = new ConfigState({
      versionMajor: ConfigState.MIN_VERSION,
      name_verify_phone_lamports: name_verify_phone_lamports,
      name_verify_email_lamports: name_verify_email_lamports,
      name_assign_phone_lamports: name_assign_phone_lamports,
      name_assign_email_lamports: name_assign_email_lamports,

      name_transfer_lamports: name_transfer_lamports,
      name_delete_lamports: name_delete_lamports,
      escrow_create_lamports: escrow_create_lamports,
      escrow_withdraw_lamports: escrow_withdraw_lamports,
      escrow_delete_lamports: escrow_delete_lamports,
    });
    ret.address = address;
    return ret;
  }

  public static default(
    address: PublicKey
  ) {
    let ret = new ConfigState({
      versionMajor: ConfigState.MIN_VERSION,
      name_verify_phone_lamports: 1000000,
      name_verify_email_lamports: 1000000,
      name_assign_phone_lamports: 0,
      name_assign_email_lamports: 0,
    
      name_transfer_lamports: 0,
      name_delete_lamports: 0,
      escrow_create_lamports: 0,
      escrow_withdraw_lamports: 0,
      escrow_delete_lamports: 0,
    });
    ret.address = address;
    return ret;
  }

  public static async retrieve(
    connection: Connection,
    accountKey: PublicKey,
    programId: PublicKey
  ): Promise<ConfigState | null> {
    let accountInfo = await connection.getAccountInfo(accountKey, 'processed');
    if (accountInfo == null || !accountInfo.owner.equals(programId)) {
      return null;
    }
    var record = deserializeUnchecked(
      this.schema,
      ConfigState,
      accountInfo.data
    );
    record.address = accountKey;
    return record;
  }
}

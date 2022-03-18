import { Connection, PublicKey } from '@solana/web3.js';
import { deserializeUnchecked, Schema } from 'borsh';
import { isDefault, RecordType, RUST_DEFAULT_PUBLIC_KEY } from '.';

export type StarStateFlags = {
  // Owner-controlled toggle: lock, which prevents changes to the footer
  locked: boolean;
  // Verification attempts cost money; denote payment and consumption here
  paid_to_verify: boolean;
  // Ownership establishment may be charged a separate fee
  paid_to_assign: boolean;
  // An assignment request with a valid claim signature occurred to a locked account
  contested: boolean;
  // Owner-controlled toggle: prevent starmap from sending token receipt notifications
  disable_notifications: boolean;
};

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
  flags: StarStateFlags;
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
    this.flags = {
      locked: (obj.state & (1 << 0)) > 0,
      paid_to_verify: (obj.state & (1 << 1)) > 0,
      paid_to_assign: (obj.state & (1 << 2)) > 0,
      contested: (obj.state & (1 << 3)) > 0,
      disable_notifications: (obj.state & (1 << 4)) > 0,
    };
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

  public static create(recordType: RecordType, owner: PublicKey) {
    let ret = new StarState({
      versionMajor: 0,
      recordType: recordType,
      state: 0,
      signatory: new Uint8Array(32),
      owner: owner.toBytes(),
    });
    if (isDefault(owner)) ret.invalidReason = 'Unowned record';
    else ret.isAssignedAndValid = true;
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
    if (accountInfo === null)
      return this.empty('Record account does not exist');

    if (!accountInfo.owner.equals(programId))
      return this.empty('Record account exists but is not initialized');

    let res: StarState = deserializeUnchecked(
      this.schema,
      StarState,
      accountInfo.data
    );
    res.routingInfo = accountInfo.data?.slice(this.HEADER_LEN);
    res.isPresent = true;
    res.isAuthorized = res.flags.paid_to_assign && res.flags.paid_to_verify;
    res.isReadyToAssign = res.flags.paid_to_assign && !res.flags.paid_to_verify;

    if (res.versionMajor < this.MIN_VERSION) {
      res.invalidReason = `Invalid version: ${res.versionMajor}; ${this.MIN_VERSION} required.`;
      return res;
    }

    if (isDefault(res.owner)) {
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
  static LEN = 45;
  static MIN_VERSION = 1;

  // Blockchain data
  versionMajor: number;

  name_verify_phone_lamports: number;
  name_verify_email_lamports: number;
  name_verify_stars_lamports: number;
  name_assign_phone_lamports: number;
  name_assign_email_lamports: number;
  name_assign_stars_lamports: number;

  name_transfer_lamports: number;
  name_delete_lamports: number;
  escrow_create_lamports: number;
  escrow_withdraw_lamports: number;
  escrow_delete_lamports: number;

  notify_phone_lamports: number;
  notify_email_lamports: number;

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
          ['name_verify_stars_lamports', 'u32'],
          ['name_assign_phone_lamports', 'u32'],
          ['name_assign_email_lamports', 'u32'],
          ['name_assign_stars_lamports', 'u32'],

          ['name_transfer_lamports', 'u32'],
          ['name_delete_lamports', 'u32'],
          ['escrow_create_lamports', 'u32'],
          ['escrow_withdraw_lamports', 'u32'],
          ['escrow_delete_lamports', 'u32'],

          ['notify_phone_lamports', 'u32'],
          ['notify_email_lamports', 'u32'],
        ],
      },
    ],
  ]);

  constructor(obj: {
    versionMajor: number;
    name_verify_phone_lamports: number;
    name_verify_email_lamports: number;
    name_verify_stars_lamports: number;
    name_assign_phone_lamports: number;
    name_assign_email_lamports: number;
    name_assign_stars_lamports: number;

    name_transfer_lamports: number;
    name_delete_lamports: number;
    escrow_create_lamports: number;
    escrow_withdraw_lamports: number;
    escrow_delete_lamports: number;

    notify_phone_lamports: number;
    notify_email_lamports: number;
  }) {
    this.versionMajor = obj.versionMajor;
    this.name_verify_phone_lamports = obj.name_verify_phone_lamports;
    this.name_verify_email_lamports = obj.name_verify_email_lamports;
    this.name_verify_stars_lamports = obj.name_verify_stars_lamports;
    this.name_assign_phone_lamports = obj.name_assign_phone_lamports;
    this.name_assign_email_lamports = obj.name_assign_email_lamports;
    this.name_assign_stars_lamports = obj.name_assign_stars_lamports;

    this.name_transfer_lamports = obj.name_transfer_lamports;
    this.name_delete_lamports = obj.name_delete_lamports;
    this.escrow_create_lamports = obj.escrow_create_lamports;
    this.escrow_withdraw_lamports = obj.escrow_withdraw_lamports;
    this.escrow_delete_lamports = obj.escrow_delete_lamports;

    this.notify_phone_lamports = obj.notify_phone_lamports;
    this.notify_email_lamports = obj.notify_email_lamports;
  }

  public static new(
    address: PublicKey,
    name_verify_phone_lamports: number,
    name_verify_email_lamports: number,
    name_verify_stars_lamports: number,
    name_assign_phone_lamports: number,
    name_assign_email_lamports: number,
    name_assign_stars_lamports: number,

    name_transfer_lamports: number,
    name_delete_lamports: number,
    escrow_create_lamports: number,
    escrow_withdraw_lamports: number,
    escrow_delete_lamports: number,

    notify_phone_lamports: number,
    notify_email_lamports: number
  ) {
    let ret = new ConfigState({
      versionMajor: ConfigState.MIN_VERSION,
      name_verify_phone_lamports: name_verify_phone_lamports,
      name_verify_email_lamports: name_verify_email_lamports,
      name_verify_stars_lamports: name_verify_stars_lamports,
      name_assign_phone_lamports: name_assign_phone_lamports,
      name_assign_email_lamports: name_assign_email_lamports,
      name_assign_stars_lamports: name_assign_stars_lamports,

      name_transfer_lamports: name_transfer_lamports,
      name_delete_lamports: name_delete_lamports,
      escrow_create_lamports: escrow_create_lamports,
      escrow_withdraw_lamports: escrow_withdraw_lamports,
      escrow_delete_lamports: escrow_delete_lamports,

      notify_phone_lamports: notify_phone_lamports,
      notify_email_lamports: notify_email_lamports,
    });
    ret.address = address;
    return ret;
  }

  public static default(address: PublicKey) {
    let ret = new ConfigState({
      versionMajor: ConfigState.MIN_VERSION,
      name_verify_phone_lamports: 1000000,
      name_verify_email_lamports: 1000000,
      name_verify_stars_lamports: 1000000,
      name_assign_phone_lamports: 0,
      name_assign_email_lamports: 0,
      name_assign_stars_lamports: 0,

      name_transfer_lamports: 0,
      name_delete_lamports: 0,
      escrow_create_lamports: 0,
      escrow_withdraw_lamports: 0,
      escrow_delete_lamports: 0,

      notify_phone_lamports: 1000000,
      notify_email_lamports: 25000,
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

export class NotificationRequest {
  // Constants
  static LEN = 138;
  static MIN_VERSION = 1;

  // Blockchain data
  version_major: number;
  record_type: RecordType;
  sender: PublicKey;
  recipient: PublicKey;
  transaction_id: PublicKey;
  mint: PublicKey;
  amount: BigInt;

  // Derived info
  address = PublicKey.default;

  static schema: Schema = new Map([
    [
      NotificationRequest,
      {
        kind: 'struct',
        fields: [
          ['version_major', 'u8'],
          ['record_type', 'u8'],
          ['sender', [32]],
          ['recipient', [32]],
          ['transaction_id', [32]],
          ['mint', [32]],
          ['amount', 'u64'],
        ],
      },
    ],
  ]);

  constructor(obj: {
    version_major: number;
    record_type: RecordType;
    sender: PublicKey;
    recipient: PublicKey;
    transaction_id: PublicKey;
    mint: PublicKey;
    amount: BigInt;
  }) {
    this.version_major = obj.version_major;
    this.record_type = obj.record_type;
    this.sender = new PublicKey(obj.sender);
    this.recipient = new PublicKey(obj.recipient);
    this.transaction_id = new PublicKey(obj.transaction_id);
    this.mint = new PublicKey(obj.mint);
    this.amount = obj.amount;
  }

  public static new(
    address: PublicKey,
    record_type: RecordType,
    sender: PublicKey,
    recipient: PublicKey,
    transaction_id: PublicKey,
    mint: PublicKey,
    amount: BigInt
  ) {
    let ret = new NotificationRequest({
      version_major: NotificationRequest.MIN_VERSION,
      record_type: record_type,
      sender: sender,
      recipient: recipient,
      transaction_id: transaction_id,
      mint: mint,
      amount: amount,
    });
    ret.address = address;
    return ret;
  }

  public static async retrieve(
    connection: Connection,
    accountKey: PublicKey,
    programId: PublicKey
  ): Promise<NotificationRequest | null> {
    let accountInfo = await connection.getAccountInfo(accountKey, 'processed');
    if (accountInfo == null || !accountInfo.owner.equals(programId)) {
      return null;
    }
    var record = deserializeUnchecked(
      this.schema,
      NotificationRequest,
      accountInfo.data
    );
    record.address = accountKey;
    return record;
  }
}

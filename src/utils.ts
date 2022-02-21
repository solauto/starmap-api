import assert from 'assert';
import { createHash } from 'crypto';

import {
  AccountInfo,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import BN from 'bn.js';

import { AccountType, RecordType, STARMAP_PROGRAM_ID } from './bindings';
import { StarState, EscrowRootState, EscrowState } from './state';

const U32_MAX = 0xffffffff;
export const MAX_NAME_LENGTH = 255;

export class Numberu32 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 4) {
      return b;
    }
    assert(b.length < 4, 'Numberu32 too large');

    const zeroPad = Buffer.alloc(4);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a Numberu64 from Buffer representation
   */
  static fromBuffer(buffer): BN {
    assert(buffer.length === 4, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map((i) => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16
    );
  }
}

export class Numberu64 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 8) {
      return b;
    }
    assert(b.length < 8, 'Numberu64 too large');

    const zeroPad = Buffer.alloc(8);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a Numberu64 from Buffer representation
   */
  static fromBuffer(buffer): BN {
    assert(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map((i) => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16
    );
  }
}

export const signAndSendTransactionInstructions = async (
  // sign and send transaction
  connection: Connection,
  signers: Array<Keypair>,
  feePayer: Keypair,
  txInstructions: Array<TransactionInstruction>
): Promise<string> => {
  const tx = new Transaction();
  tx.feePayer = feePayer.publicKey;
  signers.push(feePayer);
  tx.add(...txInstructions);
  return await connection.sendTransaction(tx, signers);
};

export function getHashedName(name: string): Buffer {
  if (name.length > MAX_NAME_LENGTH)
    throw new Error(`Maximum name length is ${MAX_NAME_LENGTH} chars.`);
  return createHash('sha256').update(name, 'utf8').digest();
}

export async function getNameAccountKey(
  hashedName: Buffer,
  recordType: number
): Promise<PublicKey> {
  const accountTypeBuffer = Buffer.from(Uint8Array.from([AccountType.Record]));
  const recordTypeBuffer = Buffer.from(Uint8Array.from([recordType]));
  const seeds = [accountTypeBuffer, recordTypeBuffer, hashedName];
  const [nameAccountKey] = await PublicKey.findProgramAddress(
    seeds,
    STARMAP_PROGRAM_ID
  );
  return nameAccountKey;
}

export async function getNameAccount(
  connection: Connection,
  nameAccountKey: PublicKey
): Promise<StarState> {
  const nameAccount = await connection.getAccountInfo(nameAccountKey);
  if (!nameAccount) throw new Error('Unable to find the given account.');
  return await StarState.retrieve(
    connection,
    nameAccountKey,
    STARMAP_PROGRAM_ID
  );
}

export async function getEscrowAccountKey(
  hashedName: Buffer,
  recordType: number,
  index: number
): Promise<PublicKey> {
  const accountTypeBuffer = Buffer.from(Uint8Array.from([AccountType.Escrow]));
  const recordTypeBuffer = Buffer.from(Uint8Array.from([recordType]));
  const indexBuffer = new Numberu32(index).toBuffer();
  const seeds = [accountTypeBuffer, recordTypeBuffer, hashedName, indexBuffer];
  const [escrowAccountKey] = await PublicKey.findProgramAddress(
    seeds,
    STARMAP_PROGRAM_ID
  );
  return escrowAccountKey;
}

export async function getEscrowRootAccount(
  connection: Connection,
  hashedName: Buffer,
  recordType: number
): Promise<EscrowRootState | null> {
  return await EscrowRootState.retrieve(
    connection,
    await getEscrowAccountKey(hashedName, recordType, 0),
    STARMAP_PROGRAM_ID
  );
}

export async function getEscrowAccount(
  connection: Connection,
  hashedName: Buffer,
  recordType: number,
  index: number
): Promise<EscrowState | null> {
  return await EscrowState.retrieve(
    connection,
    await getEscrowAccountKey(hashedName, recordType, index),
    STARMAP_PROGRAM_ID
  );
}

export async function getEscrowAccounts(
  connection: Connection,
  hashedName: Buffer,
  recordType: number
): Promise<EscrowState[]> {
  let root = await getEscrowRootAccount(connection, hashedName, recordType);
  var accounts: EscrowState[] = [];
  let index = root == null ? U32_MAX : root.next_index;
  while (index < U32_MAX) {
    const account = await getEscrowAccount(
      connection,
      hashedName,
      recordType,
      index
    );
    if (account == null) throw Error('Null pointer in escrow chain');
    accounts.push(account);
    index += 1;
  }
  return accounts;
}

export async function getNextAvailableEscrowAccount(
  connection: Connection,
  hashedName: Buffer,
  recordType: number
): Promise<[EscrowState, PublicKey]> {
  let rootState = await getEscrowRootAccount(
    connection,
    hashedName,
    recordType
  );
  if (!rootState) {
    const accountKey = await getEscrowAccountKey(hashedName, recordType, 1);
    return [EscrowState.empty(1, 0, U32_MAX), accountKey];
  }
  if (rootState.next_index > 1) {
    const accountKey = await getEscrowAccountKey(
      hashedName,
      recordType,
      rootState.next_index
    );
    return [EscrowState.empty(1, 0, rootState.next_index), accountKey];
  }
  let index = 1;
  while (true) {
    const accountKey = await getEscrowAccountKey(hashedName, recordType, index);
    const accountState = await EscrowState.retrieve(
      connection,
      accountKey,
      STARMAP_PROGRAM_ID
    );
    if (accountState == null) throw Error('Null pointer in escrow chain');
    index += 1;
    if (accountState.next_index > index)
      return [
        EscrowState.empty(index, accountState.index, accountState.next_index),
        accountKey,
      ];
  }
}

export async function getCostEstimate(
  connection: Connection,
  dataSize: number
): Promise<number> {
  let totalSize = StarState.HEADER_LEN + dataSize;
  const resp = await connection.getMinimumBalanceForRentExemption(totalSize);
  return resp + LAMPORTS_PER_SOL / 100.0;
}

export async function getFilteredProgramAccounts(
  connection: Connection,
  programId: PublicKey,
  filters
): Promise<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }[]> {
  const resp = await connection.getProgramAccounts(programId, {
    commitment: connection.commitment,
    filters,
    encoding: 'base64',
  });
  return resp.map(
    ({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: pubkey,
      accountInfo: {
        data: data,
        executable,
        owner: owner,
        lamports,
      },
    })
  );
}

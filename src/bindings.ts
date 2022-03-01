import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { EscrowState, getEscrowAccountKey } from '.';

import {
  assignNameInstruction,
  authorizeNameInstruction,
  createEscrowInstruction,
  deleteEscrowInstruction,
  deleteNameInstruction,
  transferNameInstruction,
  updateNameInstruction,
  setClaimKeyInstruction as setClaimKeyInstruction,
  withdrawEscrowInstruction,
} from './instructions';
import { StarState } from './state';
import { Numberu64 } from './utils';
import { getHashedName, getNameAccountKey, Numberu32 } from './utils';

////////////////////////////////////////////////////////////

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

/**
 * Retrieve the name account.
 *
 * @param connection The solana connection object to the RPC node
 * @param name The name of the name account
 * @param recordType The type of name record
 * @returns
 */
export async function retrieveNameRegistry(
  connection: Connection,
  name: string,
  recordType: RecordType
): Promise<StarState> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);
  console.log(
    `Name: ${name} Type: ${recordType} = Account: ${nameAccountKey.toBase58()}`
  );
  return StarState.retrieve(connection, nameAccountKey, STARMAP_PROGRAM_ID);
}

////////////////////////////////////////////////////////////
/**
 * Creates an empty name account of a specified type, paying verification fees.
 *
 * @param name The name of the new account
 * @param recordType The type of name record
 * @param payerKey The allocation cost payer
 * @param dataSize The additional space in bytes allocated for routing info
 * @returns
 */
export async function authorizeVerificationPayment(
  name: string,
  recordType: RecordType,
  payerKey: PublicKey,
  dataSize: number
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);

  const instruction = authorizeNameInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    payerKey,
    nameAccountKey,
    TREASURY_ACCOUNT,
    PublicKey.default,
    hashed_name,
    recordType,
    dataSize
  );

  return instruction;
}

////////////////////////////////////////////////////////////
/**
 * Set the claim public key on the name record.
 *
 * A starmap authorized signatory server generates a random keypair and
 * sends the private key to the email/phone/etc and writes the public key
 * to the name record via this instruction.
 *
 * @param name The name of the new account
 * @param recordType The type of name record
 * @param signatory The signed PubKey of the authorized validation service
 * @param claimKey The public key of the claim keypair
 * @returns
 */
export async function setClaimKey(
  name: string,
  recordType: RecordType,
  signatory: PublicKey,
  claimKey: PublicKey
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);

  const instruction = setClaimKeyInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    nameAccountKey,
    signatory,
    claimKey
  );

  return instruction;
}

////////////////////////////////////////////////////////////
/**
 * Write the owner's public key on the name record, using the claim key.
 *
 * This instruction requires a signature from the claim keypair/signer.
 *
 * @param name The name of the new account
 * @param recordType The type of name record
 * @param claimKey The public key of the claim keypair
 * @param newOwner The new owner to be set
 * @returns
 */
export async function assignNameOwnership(
  name: string,
  recordType: RecordType,
  claimKey: PublicKey,
  newOwner: PublicKey
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);

  const instruction = assignNameInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    nameAccountKey,
    claimKey,
    newOwner
  );

  return instruction;
}

/**
 * Overwrite the data of the given name registry.
 *
 * @param name The name of the name registry to update
 * @param owner The current owner
 * @param recordType The type of name record
 * @param offset The offset to begin writing data, starting at routingInfo[0]
 * @param input_data The data to be written
 */
export async function updateNameRegistryData(
  name: string,
  recordType: RecordType,
  owner: PublicKey,
  offset: number,
  input_data: Buffer
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);

  const instruction = updateNameInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    owner,
    // @ts-ignore
    new Numberu32(offset),
    input_data
  );

  return instruction;
}

/**
 * Change the owner of a given name account.
 *
 * @param name The name of the name account
 * @param owner The current owner
 * @param recordType The type of name record
 * @param newOwner The new owner to be set
 * @returns
 */
export async function transferNameOwnership(
  name: string,
  recordType: RecordType,
  owner: PublicKey,
  newOwner: PublicKey
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);
  const instruction = transferNameInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    owner,
    newOwner
  );

  return instruction;
}

/**
 * Delete the name account and transfer the rent to the target.
 *
 * @param name The name of the name account
 * @param owner The current owner
 * @param recordType The type of name record
 * @param refundTargetKey The refund destination address; owner if not supplied
 * @returns
 */
export async function deleteNameRegistry(
  name: string,
  recordType: RecordType,
  owner: PublicKey,
  refundTargetKey?: PublicKey
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);

  let refundTarget: PublicKey;
  if (refundTargetKey) {
    refundTarget = refundTargetKey;
  } else {
    refundTarget = owner;
  }

  const instruction = deleteNameInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    owner,
    refundTarget
  );

  return instruction;
}

////////////////////////////////////////////////////////////
/**
 * Creates an escrow account
 *
 * Use getNextAvailableEscrowAccount(..) to get the escrow input.
 *
 * @param name The name of the new account
 * @param recordType The type of name record
 * @param payerKey The allocation cost payer
 * @param escrow The escrow account to delete
 * @param mint The pubkey of the mint of the escrowed funds
 * @returns
 */
export async function createEscrowAccount(
  name: string,
  recordType: RecordType,
  payerKey: PublicKey,
  escrow: EscrowState,
  mint: PublicKey
): Promise<TransactionInstruction> {
  if (
    escrow.index < 1 ||
    escrow.prev_index > escrow.index ||
    escrow.next_index < escrow.index
  ) {
    throw new Error(
      `Invalid index; ${escrow.prev_index} < ${escrow.index} < ${escrow.next_index}`
    );
  }
  const hashed_name = getHashedName(name);
  return createEscrowInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    payerKey,
    await getNameAccountKey(hashed_name, recordType),
    await getEscrowAccountKey(hashed_name, recordType, escrow.prev_index),
    await getEscrowAccountKey(hashed_name, recordType, escrow.index),
    await getEscrowAccountKey(hashed_name, recordType, escrow.next_index),
    hashed_name,
    recordType,
    escrow.prev_index,
    escrow.index,
    escrow.next_index,
    mint
  );
}

////////////////////////////////////////////////////////////
/**
 * Withdraw from an escrow account
 *
 * @param name The name of the new account
 * @param recordType The type of name record
 * @param requester The allocation cost payer
 * @param index The index of the escrow account to withdraw from
 * @param amount The number of tokens to withdrawal; uses min(available, requested)
 * @param srcTokenAccount The associated token address to withdraw from
 * @param dstTokenAccount The associated token address to withdraw to
 * @returns
 */
export async function withdrawEscrow(
  name: string,
  recordType: RecordType,
  requester: PublicKey,
  index: number,
  amount: BigInt,
  srcTokenAccount: PublicKey,
  dstTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  if (index < 1) {
    throw new Error(`Invalid index`);
  }
  const hashed_name = getHashedName(name);
  return withdrawEscrowInstruction(
    STARMAP_PROGRAM_ID,
    requester,
    await getNameAccountKey(hashed_name, recordType),
    await getEscrowAccountKey(hashed_name, recordType, index),
    srcTokenAccount,
    dstTokenAccount,
    TOKEN_PROGRAM_ID,
    hashed_name,
    recordType,
    index,
    amount
  );
}

////////////////////////////////////////////////////////////
/**
 * Deletes an escrow account
 *
 * @param name The name of the new account
 * @param recordType The type of name record
 * @param payerKey The allocation cost payer
 * @param escrow The escrow account to delete
 * @returns
 */
export async function deleteEscrowAccount(
  name: string,
  recordType: RecordType,
  payerKey: PublicKey,
  escrow: EscrowState
): Promise<TransactionInstruction> {
  if (
    escrow.index < 1 ||
    escrow.prev_index > escrow.index ||
    escrow.next_index < escrow.index
  ) {
    throw new Error(
      `Invalid index; ${escrow.prev_index} < ${escrow.index} < ${escrow.next_index}`
    );
  }
  const hashed_name = getHashedName(name);
  return deleteEscrowInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    payerKey,
    escrow.sender,
    await getNameAccountKey(hashed_name, recordType),
    await getEscrowAccountKey(hashed_name, recordType, escrow.prev_index),
    await getEscrowAccountKey(hashed_name, recordType, escrow.index),
    await getEscrowAccountKey(hashed_name, recordType, escrow.next_index),
    hashed_name,
    recordType,
    escrow.prev_index,
    escrow.index,
    escrow.next_index
  );
}

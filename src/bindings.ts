import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  AccountInfo,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

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
  updateConfigInstruction,
  transferAndNotifyInstruction,
  consumeNotificationInstruction,
  transferNativeAndNotifyInstruction,
  updateNameFlagsInstruction,
} from './instructions';
import {
  Signatory,
  ConfigType,
  RecordType,
  STARMAP_PROGRAM_ID,
  TREASURY_ACCOUNT,
  CONFIG_ACCOUNT,
  AccountType,
  MAX_NAME_LENGTH,
  U32_MAX,
} from './constants';
import { ConfigState, StarState, EscrowRootState, EscrowState } from './state';
import { Numberu32 } from './utils';
import { serialize } from 'borsh';
import { createHash } from 'crypto';
import { NotificationRequest } from '.';

////////////////////////////////////////////////////////////

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

  return authorizeNameInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    payerKey,
    nameAccountKey,
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT,
    Signatory.TWILIO, // TODO: use correct signatory for CIVIC, etc.
    hashed_name,
    recordType,
    dataSize
  );
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
  return setClaimKeyInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    nameAccountKey,
    signatory,
    claimKey
  );
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
  return assignNameInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    claimKey,
    newOwner
  );
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
  return transferNameInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    owner,
    newOwner,
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT
  );
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
  return deleteNameInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    owner,
    refundTarget,
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT
  );
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
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT,
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
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT,
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
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT,
    hashed_name,
    recordType,
    escrow.prev_index,
    escrow.index,
    escrow.next_index
  );
}

/**
 * Overwrite the data of the given name registry.
 *
 * @param configType The type of name record
 * @param owner The account with authority to update config
 * @param newConfig The new config state to write
 */
export async function updateConfigData(
  configType: ConfigType,
  owner: PublicKey,
  newConfig: ConfigState
): Promise<TransactionInstruction> {
  const serialized = serialize(ConfigState.schema, newConfig);
  const accountKey = await getConfigAccountKey(configType);
  return updateConfigInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    accountKey,
    owner,
    ConfigType.General,
    // @ts-ignore
    new Numberu32(0),
    Buffer.from(serialized)
  );
}

////////////////////////////////////////////////////////////
/**
 * Transfer and Create Notification Request
 *
 * @param recordType The type of name record
 * @param requester The owner of the source token account who is requesting the transfer
 * @param transactionId A unique signature for identifying this transaction, like Solana Pay
 * @param amount The raw number (not ui number) of tokens to transfer
 * @param srcTokenAccount The associated token address to transfer from
 * @param dstTokenAccount The associated token address to transfer to
 * @returns
 */
export async function transferAndNotify(
  recordType: RecordType,
  requester: PublicKey,
  transactionId: PublicKey,
  amount: BigInt,
  srcTokenAccount: PublicKey,
  dstTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  return transferAndNotifyInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    requester,
    srcTokenAccount,
    dstTokenAccount,
    TOKEN_PROGRAM_ID,
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT,
    transactionId,
    await getNotificationAccountKey(recordType, transactionId),
    Signatory.AWS,
    recordType,
    amount.valueOf()
  );
}

////////////////////////////////////////////////////////////
/**
 * Consume Notification Request
 *
 * @param recordType The type of name record
 * @param requester The owner of the source token account who is requesting the transfer
 * @param refundTarget The account to which the PDA rent should be refunded
 * @param transactionId A unique signature for identifying this transaction, like Solana Pay
 * @param success Indicates if the notification was sent
 * @returns
 */
export async function consumeNotification(
  recordType: RecordType,
  requester: PublicKey,
  refundTarget: PublicKey,
  transactionId: PublicKey,
  success: number
): Promise<TransactionInstruction> {
  return consumeNotificationInstruction(
    STARMAP_PROGRAM_ID,
    requester,
    refundTarget,
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT,
    transactionId,
    await getNotificationAccountKey(recordType, transactionId),
    recordType,
    success
  );
}

////////////////////////////////////////////////////////////
/**
 * Transfer Native and Create Notification Request
 *
 * @param recordType The type of name record
 * @param requester The wallet address of the owner who is requesting the transfer
 * @param transactionId A unique signature for identifying this transaction, like Solana Pay
 * @param amount The number of lamports to transfer
 * @param dstAccount The wallet address to transfer TO
 * @returns
 */
export async function transferNativeAndNotify(
  recordType: RecordType,
  requester: PublicKey,
  transactionId: PublicKey,
  amount: BigInt,
  dstAccount: PublicKey
): Promise<TransactionInstruction> {
  return transferNativeAndNotifyInstruction(
    STARMAP_PROGRAM_ID,
    SystemProgram.programId,
    requester,
    dstAccount,
    TREASURY_ACCOUNT,
    CONFIG_ACCOUNT,
    transactionId,
    await getNotificationAccountKey(recordType, transactionId),
    Signatory.AWS,
    recordType,
    amount.valueOf()
  );
}

/**
 * Overwrite the lock flag in the name record.
 *
 * @param name The name of the name registry to update
 * @param owner The current owner
 * @param newValue to write to the name record
 */
export async function updateNameLockFlag(
  name: string,
  recordType: RecordType,
  owner: PublicKey,
  setLocked: boolean
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);
  return updateNameFlagsInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    owner,
    0,
    setLocked
  );
}

/**
 * Overwrite the email notify disable flag in the name record.
 *
 * @param name The name of the name registry to update
 * @param owner The current owner
 * @param setDisabled
 */
export async function updateNotificationPreference(
  name: string,
  recordType: RecordType,
  owner: PublicKey,
  setDisabled: boolean
): Promise<TransactionInstruction> {
  const hashed_name = getHashedName(name);
  const nameAccountKey = await getNameAccountKey(hashed_name, recordType);
  return updateNameFlagsInstruction(
    STARMAP_PROGRAM_ID,
    nameAccountKey,
    owner,
    4,
    setDisabled
  );
}

export async function getNotificationAccountKey(
  recordType: number,
  transactionId: PublicKey
): Promise<PublicKey> {
  const accountTypeBuffer = Buffer.from(
    Uint8Array.from([AccountType.NotifyReq])
  );
  const recordTypeBuffer = Buffer.from(Uint8Array.from([recordType]));
  const seeds = [accountTypeBuffer, recordTypeBuffer, transactionId.toBuffer()];
  const [accountKey] = await PublicKey.findProgramAddress(
    seeds,
    STARMAP_PROGRAM_ID
  );
  return accountKey;
}

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

export async function getConfigAccountKey(
  configType: ConfigType
): Promise<PublicKey> {
  const accountTypeBuffer = Buffer.from(Uint8Array.from([AccountType.Config]));
  const recordTypeBuffer = Buffer.from(Uint8Array.from([configType]));
  const seeds = [accountTypeBuffer, recordTypeBuffer];
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
  recordType: number,
  senderFilter?: PublicKey | null
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
    if (!senderFilter || account.sender.equals(senderFilter))
      accounts.push(account);
    index = account.next_index;
  }
  return accounts;
}

export async function getNextAvailableEscrowAccount(
  connection: Connection,
  hashedName: Buffer,
  recordType: number
): Promise<EscrowState> {
  let rootState = await getEscrowRootAccount(
    connection,
    hashedName,
    recordType
  );
  if (!rootState) {
    // no existing records
    const accountKey = await getEscrowAccountKey(hashedName, recordType, 1);
    return EscrowState.empty(1, 0, U32_MAX, accountKey);
  }
  if (rootState.next_index > 1) {
    // root points past 1, insert @ 1
    const accountKey = await getEscrowAccountKey(hashedName, recordType, 1);
    return EscrowState.empty(1, 0, rootState.next_index, accountKey);
  }
  let index = 1;
  while (true) {
    let accountKey = await getEscrowAccountKey(hashedName, recordType, index);
    const accountState = await EscrowState.retrieve(
      connection,
      accountKey,
      STARMAP_PROGRAM_ID
    );
    if (accountState == null) throw Error('Null pointer in escrow chain');
    index += 1;
    accountKey = await getEscrowAccountKey(hashedName, recordType, index);
    if (accountState.next_index > index)
      return EscrowState.empty(
        index,
        accountState.index,
        accountState.next_index,
        accountKey
      );
  }
}

export type CostInfo = {
  fee: number;
  deposit: number;
};

/// Returns [rent, fee]
export async function getVerifyCostLamports(
  connection: Connection,
  dataSize: number,
  state: StarState
): Promise<CostInfo> {
  const totalSize = StarState.HEADER_LEN + dataSize;
  const rent = await connection.getMinimumBalanceForRentExemption(totalSize);
  const dynamicFees = await ConfigState.retrieve(
    connection,
    CONFIG_ACCOUNT,
    STARMAP_PROGRAM_ID
  );
  const fees = dynamicFees || ConfigState.default(CONFIG_ACCOUNT);
  let verify_fee = 0;
  let assign_fee = 0;
  if (state.recordType == RecordType.Phone) {
    verify_fee = fees.name_verify_phone_lamports;
    assign_fee = fees.name_assign_phone_lamports;
  } else if (state.recordType == RecordType.Email) {
    verify_fee = fees.name_verify_phone_lamports;
    assign_fee = fees.name_assign_phone_lamports;
  } else {
    return { fee: 0, deposit: 0 };
  }
  if (state.flags.paid_to_assign) assign_fee = 0;
  if (state.flags.paid_to_verify) verify_fee = 0;
  return { fee: assign_fee + verify_fee, deposit: rent };
}

/// Returns: [rent, fee]
export async function getEscrowCostLamports(
  connection: Connection
): Promise<CostInfo> {
  // Since rent fees might become non-linear and there's overhead per account,
  // and since EscrowRoot isn't always needed and EscrowRoot.LEN + EscrowState.LEN ~= SplToken.lEN,
  // guesstimate about 2 SPL token accounts worth of data.
  const halfRent = await connection.getMinimumBalanceForRentExemption(165);
  const dynamicFees = await ConfigState.retrieve(
    connection,
    CONFIG_ACCOUNT,
    STARMAP_PROGRAM_ID
  );
  const fees = dynamicFees || ConfigState.default(CONFIG_ACCOUNT);
  let escrow_fee = fees.escrow_create_lamports;
  return { fee: escrow_fee, deposit: 2 * halfRent };
}

/// Returns: [rent, fee]
export async function getNotifyCostLamports(
  connection: Connection,
  recordType: RecordType
): Promise<CostInfo> {
  const rent = await connection.getMinimumBalanceForRentExemption(
    NotificationRequest.LEN
  );
  const dynamicFees = await ConfigState.retrieve(
    connection,
    CONFIG_ACCOUNT,
    STARMAP_PROGRAM_ID
  );
  const fees = dynamicFees || ConfigState.default(CONFIG_ACCOUNT);
  let notify_fee = 0;
  if (recordType == RecordType.Phone) {
    notify_fee = fees.notify_phone_lamports;
  } else if (recordType == RecordType.Email) {
    notify_fee = fees.notify_email_lamports;
  } else {
    return { fee: 0, deposit: 0 };
  }
  return { fee: notify_fee, deposit: rent };
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

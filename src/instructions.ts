import { PublicKey, TransactionInstruction } from '@solana/web3.js';

import { Numberu32, Numberu64 } from './utils';
import { toBufferBE } from 'bigint-buffer';

export function authorizeNameInstruction(
  nameProgramId: PublicKey,
  systemProgramId: PublicKey,
  payerKey: PublicKey,
  nameAccountKey: PublicKey,
  treasuryKey: PublicKey,
  feeInfoKey: PublicKey,
  hashed_name: Buffer,
  recordType: number,
  dataSize: number
): TransactionInstruction {
  const keys = [
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: payerKey,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: treasuryKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: feeInfoKey,
      isSigner: false,
      isWritable: false,
    },
  ];

  const buffers = [
    Buffer.from(Int8Array.from([0])),
    hashed_name,
    Buffer.from(Uint8Array.from([recordType])),
    new Numberu32(dataSize).toBuffer(),
  ];
  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function setClaimKeyInstruction(
  nameProgramId: PublicKey,
  systemProgramId: PublicKey,
  nameAccountKey: PublicKey,
  signatoryKey: PublicKey,
  claimKey: PublicKey
): TransactionInstruction {
  const keys = [
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: signatoryKey,
      isSigner: true,
      isWritable: false,
    },
  ];

  const buffers = [Buffer.from(Int8Array.from([1])), claimKey.toBuffer()];
  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function assignNameInstruction(
  nameProgramId: PublicKey,
  nameAccountKey: PublicKey,
  signatoryKey: PublicKey,
  ownerKey: PublicKey
): TransactionInstruction {
  const keys = [
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: signatoryKey,
      isSigner: true,
      isWritable: false,
    },
  ];

  const buffers = [Buffer.from(Int8Array.from([2])), ownerKey.toBuffer()];
  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function transferNameInstruction(
  nameProgramId: PublicKey,
  nameAccountKey: PublicKey,
  currentNameOwnerKey: PublicKey,
  newOwnerKey: PublicKey,
  treasuryKey: PublicKey,
  feeInfoKey: PublicKey
): TransactionInstruction {
  const buffers = [Buffer.from(Int8Array.from([3])), newOwnerKey.toBuffer()];

  const data = Buffer.concat(buffers);

  const keys = [
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: currentNameOwnerKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: treasuryKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: feeInfoKey,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function updateNameInstruction(
  nameProgramId: PublicKey,
  nameAccountKey: PublicKey,
  accountOwnerKey: PublicKey,
  offset: Numberu32,
  newData: Buffer
): TransactionInstruction {
  const buffers = [
    Buffer.from(Int8Array.from([4])),
    offset.toBuffer(),
    new Numberu32(newData.length).toBuffer(),
    newData,
  ];
  const keys = [
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: accountOwnerKey,
      isSigner: true,
      isWritable: false,
    },
  ];

  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function deleteNameInstruction(
  nameProgramId: PublicKey,
  nameAccountKey: PublicKey,
  refundTargetKey: PublicKey,
  nameOwnerKey: PublicKey,
  treasuryKey: PublicKey,
  feeInfoKey: PublicKey
): TransactionInstruction {
  const buffers = [Buffer.from(Int8Array.from([5]))];

  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: nameOwnerKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: refundTargetKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: treasuryKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: feeInfoKey,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function createEscrowInstruction(
  nameProgramId: PublicKey,
  systemProgramId: PublicKey,
  payerKey: PublicKey,
  nameAccountKey: PublicKey,
  prevKey: PublicKey,
  currKey: PublicKey,
  nextKey: PublicKey,
  treasuryKey: PublicKey,
  feeInfoKey: PublicKey,
  hashed_name: Buffer,
  recordType: number,
  prevIndex: number,
  currIndex: number,
  nextIndex: number,
  mint: PublicKey
): TransactionInstruction {
  const keys = [
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: payerKey,
      isSigner: true,
      isWritable: true, // TODO: try false
    },
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: prevKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: currKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: nextKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: treasuryKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: feeInfoKey,
      isSigner: false,
      isWritable: false,
    },
  ];

  const buffers = [
    Buffer.from(Int8Array.from([6])),
    hashed_name,
    Buffer.from(Uint8Array.from([recordType])),
    new Numberu32(prevIndex).toBuffer(),
    new Numberu32(currIndex).toBuffer(),
    new Numberu32(nextIndex).toBuffer(),
    mint.toBuffer(),
  ];
  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function withdrawEscrowInstruction(
  nameProgramId: PublicKey,
  requesterKey: PublicKey,
  nameAccountKey: PublicKey,
  escrowKey: PublicKey,
  srcTokenAccountKey: PublicKey,
  dstTokenAccountKey: PublicKey,
  splTokenProgramKey: PublicKey,
  treasuryKey: PublicKey,
  feeInfoKey: PublicKey,
  hashed_name: Buffer,
  recordType: number,
  index: number,
  amount: BigInt
): TransactionInstruction {
  const keys = [
    {
      pubkey: requesterKey,
      isSigner: true,
      isWritable: true, // TODO: try false
    },
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: escrowKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: srcTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: dstTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: splTokenProgramKey,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: treasuryKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: feeInfoKey,
      isSigner: false,
      isWritable: false,
    },
  ];

  const buffers = [
    Buffer.from(Int8Array.from([7])),
    hashed_name,
    Buffer.from(Uint8Array.from([recordType])),
    new Numberu32(index).toBuffer(),
    new Numberu64(toBufferBE(amount.valueOf(), 8)).toBuffer(),
  ];
  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function deleteEscrowInstruction(
  nameProgramId: PublicKey,
  systemProgramId: PublicKey,
  requesterKey: PublicKey,
  senderKey: PublicKey,
  nameAccountKey: PublicKey,
  prevKey: PublicKey,
  currKey: PublicKey,
  nextKey: PublicKey,
  treasuryKey: PublicKey,
  feeInfoKey: PublicKey,
  hashed_name: Buffer,
  recordType: number,
  prevIndex: number,
  currIndex: number,
  nextIndex: number
): TransactionInstruction {
  const keys = [
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: requesterKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: senderKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: nameAccountKey,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: prevKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: currKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: nextKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: treasuryKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: feeInfoKey,
      isSigner: false,
      isWritable: false,
    },
  ];

  const buffers = [
    Buffer.from(Int8Array.from([8])),
    hashed_name,
    Buffer.from(Uint8Array.from([recordType])),
    new Numberu32(prevIndex).toBuffer(),
    new Numberu32(currIndex).toBuffer(),
    new Numberu32(nextIndex).toBuffer(),
  ];
  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

export function updateConfigInstruction(
  nameProgramId: PublicKey,
  systemProgramId: PublicKey,
  accountKey: PublicKey,
  authorityKey: PublicKey,
  configType: number,
  offset: Numberu32,
  newData: Buffer
): TransactionInstruction {
  const buffers = [
    Buffer.from(Int8Array.from([9])),
    Buffer.from(Uint8Array.from([configType])),
    offset.toBuffer(),
    new Numberu32(newData.length).toBuffer(),
    newData,
  ];
  const keys = [
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: authorityKey,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: accountKey,
      isSigner: false,
      isWritable: true,
    },
  ];

  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys,
    programId: nameProgramId,
    data,
  });
}

import assert from 'assert';

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import BN from 'bn.js';
import { RUST_DEFAULT_PUBLIC_KEY } from './constants';

export function isDefault(key: PublicKey) {
  return key.equals(PublicKey.default) || key.equals(RUST_DEFAULT_PUBLIC_KEY);
}

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

# starmap

[starmap.network](https://starmap.network)

A verified on-chain Solana directory service.

## SYSTEM OVERVIEW

Starmap is a Solana program that maps public identifiers ("PI") to wallet addresses. These
mapping entries in Starmap are called name records. Currently-supported PIs include email
address and phone number. Unverified aliases called Stars accounts will be available soon.

This API enables a user ("sender") to query Starmap to find the wallet address associated
with a public identifier ("PI") such as an email address or phone number. The sender
can then directly send SOL or tokens to the recipient. Alternatively, if there is no wallet
currently associated, the sender can create an escrow account, send funds to the escrow,
and notify the recipient. Flow details are below.

Additionally, a user ("recipient") can use this API to create a name record and to
receive escrow funds.

If the recipient cannot claim the name record, the sender can cancel the escrow and
reclaim their funds. All that with no calls to customer service! The only
permissioned part of the system is claiming of name records.

## API FLOW

_With the exception of InitFee and Verify, the client can directly interact with the blockchain_

### SENDER ACTIONS

1. Get Name Record
   1. Client hashes PI and retrieves NameRecord from blockchain using client or RPC.
   1. Client confirms version, state, type, and signatory pubkey in NameRecord.
   1. Client extracts owner pubkey and (optionally) routing data.
1. Direct Payment
   1. Using wallet address above, wallet or app can send SOL or tokens.
      1. Future support may include other routing via the name account's routing data.
1. Escrowed Payment
   1. If the NameRecord does not exist or has no owner, the sender can create an
      escrow record and an associated token account that is owned by the escrow record.
   1. The sender can then transfer tokens (including wrapped SOL) to the token account.
   1. Until the name record is claimed, the escrow owner can withdraw funds from their
      escrow record's associated token accounts to cancel the escrow.

### REGISTRATION & RECIPIENT ACTIONS

1. InitFee (Stars-only)
   1. Client requests fee information for Stars records.
1. Authorize and Pay
   1. Client pays for fees. Stars records are assigned at this step.
1. Send Verification Request (N/A for Stars)
   1. Client submits PI to verification server.
   1. Server performs verification request and consumes verification fee on blockchain.
   1. Server 200 response indicates that verification request was sent.
1. Complete Verification (N/A for Stars)
   1. Client submits verification code, PI, and pubkey to verification server.
   1. Server performs assignment and consumes assignment fee on blockchain.
   1. Server 200 response indicates that assignment is complete.
1. Update
   1. Client sets wallet address and (opt) hash using blockchain client or RPC.
1. Withdrawal
   1. Client withdrawals escrowed funds using blockchain client or RPC.
      This is useful if funds were sent before name registry creation/assignment.
   1. If SPL tokens are supported, those should also be transferred.
1. Delete
   1. Client deletes ownership, wallet and hash using client blockchain client or RPC.

## RECORD FORMAT

A name record contains:

1. A major version which allows breaking changes
1. A record type that indicates the type of public identifier and expected signatory
1. A state bitfield for internal state management
   1. Payment status bits for verify attempt and assignment
   1. A lock bit that the name owner can set to prevent reassignment
1. The pubkey of the signatory who assigned ownership
1. The pubkey of the name owner who is allowed to
   1. Withdraw escrowed funds
   1. Update associated data
   1. Transfer account ownership
   1. [FUTURE] Modify the lock bit
   1. Delete the record
1. [OPTIONAL] Additional data such as routing addresses

See also [state.ts](js/api/state.ts)

## DEVELOPER

### INSTALL

```bash
npm i --save starmap-api
```

### EXAMPLE

```js
import { RecordType, retrieveNameRegistry } from '../api';

async function main() {
  const connection = new Connection(url, 'recent');
  let type = RecordType.Phone;
  let name = '+12345678910';
  console.log('Retrieve email record:', name);
  let res = await retrieveNameRegistry(conn, name, type);
  console.log('---Record---');
  console.log('Version:', res.versionMajor);
  console.log('Type:', res.recordType);
  console.log('State:', res.state);
  console.log('Verifier:', res.signatory.toBase58());
  console.log('Owner:', res.owner.toBase58());
  console.log('Routing Info:', res.routingInfo);
  console.log('\nSuccess\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());
```

## Contact

[Discord](https://discord.gg/dPNpAsgRZV)

[Issues](https://github.com/solauto/starmap-api/issues)

## ROADMAP

- [Automated version bump and npm publish](https://github.com/marketplace/actions/automated-version-bump)
- Stars aliases
- Atomic resize instruction
- [Civic](https://civic.com) integration
- Account lock feature
- Confidential / private transactions (eg. spl-token 2022)

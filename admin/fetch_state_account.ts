// fetch-airdr0ppy-state.ts

import { PublicKey } from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { AnchorProvider, Program} from "@coral-xyz/anchor";
import dotenv from 'dotenv';
dotenv.config();

const bn = new BN(1000000000);

const airdrop_address = new PublicKey("84JWDHiM7aRosYCb92SM4JGZqWdHdgU9K7MD7daiaiQb");
const airdrop_ata = new PublicKey("84JWDHiM7aRosYCb92SM4JGZqWdHdgU9K7MD7daiaiQb");
const token_mint_address = new PublicKey("7wDHnGykUxrjQAmJSD7zd3yjyVkJUJLUs5CwL8cAVHJF");




import fs from 'fs';

// Import the IDL and define its type
import { Airdr0ppy } from '../target/types/airdr0ppy';


console.log('using the env provider');
const provider = AnchorProvider.env();
console.log('Provider:', provider);
anchor.setProvider(provider);


// Adjust the path if necessary to point to the correct location of your IDL file
const idlFile = '../target/idl/airdr0ppy.json';
const idl = JSON.parse(fs.readFileSync(idlFile, 'utf8'));
// console.log('IDL:', idl);



const wallet = provider.wallet;


// // Specify your program ID
const programId = new PublicKey('Gj9YNmzd7TXso7J1bvMvvvFPSn6cqooqh53dkuee6MUy');
const program = new Program(idl, provider) as Program<Airdr0ppy>;

// Function to derive the PDA for airdr0ppy_state
async function deriveAirdr0ppyStatePDA(): Promise<PublicKey> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("airdr0ppy_state")],
    programId
  );
  return pda;
}

interface Airdr0ppyState {
  cooldownPeriod: anchor.BN;
  authority: PublicKey;
  recipientBalanceThreshold: anchor.BN;
  mintAccount: PublicKey;
}


async function initializeStateAccount(initialThreshold: number): Promise<void> {
    const airdr0ppyStatePDA = await deriveAirdr0ppyStatePDA();
    
    console.log('Initializing state account...');
    
    try {
      // You'll need to replace 'yourTokenAccountPubkey' with an actual token account public key
      const yourTokenAccountPubkey = token_mint_address;
      
      const tx = await program.methods.initialize(new BN(initialThreshold))
        .accounts({
          authority: wallet.publicKey,
          tokenAccount: yourTokenAccountPubkey,
        })
        .rpc();
      
      console.log('State account initialized. Transaction signature:', tx);
    } catch (error) {
      console.error('Error initializing state account:', error);
    }
  }

async function fetchAirdr0ppyState(): Promise<Airdr0ppyState> {
    const airdr0ppyStatePDA = await deriveAirdr0ppyStatePDA();
    console.log('Airdr0ppy State PDA:', airdr0ppyStatePDA.toString());

    const accountName = 'airdr0ppyState' in program.account
    ? 'airdr0ppyState'
    : 'airdr0PpyState' in program.account
        ? 'airdr0PpyState'
        : null;

    if (!accountName) {
    console.error('airdr0ppyState account is not defined in the program object');
    console.log('Available accounts:', Object.keys(program.account));
    return;
    }

    // Use type assertion to bypass TypeScript error
    const account = await (program.account as any)[accountName].fetch(airdr0ppyStatePDA) as Airdr0ppyState;

    return account;
}

async function fetchAndDisplayState(): Promise<void> {
  try {
    const airdr0ppyStatePDA = await deriveAirdr0ppyStatePDA();
    console.log('Airdr0ppy State PDA:', airdr0ppyStatePDA.toString());

    const accountName = 'airdr0ppyState' in program.account
      ? 'airdr0ppyState'
      : 'airdr0PpyState' in program.account
        ? 'airdr0PpyState'
        : null;

    if (!accountName) {
      console.error('airdr0ppyState account is not defined in the program object');
      console.log('Available accounts:', Object.keys(program.account));
      return;
    }

    // Use type assertion to bypass TypeScript error
    const account = await (program.account as any)[accountName].fetch(airdr0ppyStatePDA) as Airdr0ppyState;


    
    console.log('Airdr0ppy State:');
    console.log('----------------');
    console.log('Cooldown Period:', account.cooldownPeriod.toString(), 'seconds');
    console.log('Authority:', account.authority.toString());
    console.log('Balance Threshold:', account.recipientBalanceThreshold.toString());
    console.log('Token Account:', account.mintAccount.toString());
  } catch (error) {
    console.error('Error fetching Airdr0ppy state:', error);
  }
}

//initializeStateAccount(100);
fetchAndDisplayState();
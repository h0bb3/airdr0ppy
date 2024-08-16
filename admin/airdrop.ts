import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as anchor from "@coral-xyz/anchor";
import { Airdr0ppy } from '../target/types/airdr0ppy'; // Adjust the import path as necessary
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import BN from "bn.js";


dotenv.config();

// Load the IDL
const idlFile = '../target/idl/airdr0ppy.json';
const idl = JSON.parse(fs.readFileSync(idlFile, 'utf8'));


// Constants
const PROGRAM_ID = new PublicKey('Gj9YNmzd7TXso7J1bvMvvvFPSn6cqooqh53dkuee6MUy');
const AIRDROP_AMOUNT = 1; // Adjust as needed


interface Airdr0ppyState {
    cooldownPeriod: anchor.BN;
    authority: PublicKey;
    recipientBalanceThreshold: anchor.BN;
    mintAccount: PublicKey;
}

async function deriveAirdr0ppyStatePDA(): Promise<PublicKey> {
const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("airdr0ppy_state")],
    PROGRAM_ID
);
return pda;
}

async function fetchAirdr0ppyState(program: Program<Airdr0ppy>): Promise<Airdr0ppyState> {
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
        throw new Error('airdr0ppyState account is not defined in the program object');
    }

    // Use type assertion to bypass TypeScript error
    const account = await (program.account as any)[accountName].fetch(airdr0ppyStatePDA) as Airdr0ppyState;

    return account;
}

async function main() {
    // Check for recipient address argument
    if (process.argv.length < 3) {
        console.error('Please provide a recipient address as an argument.');
        process.exit(1);
    }

    const recipientAddress = new PublicKey(process.argv[2]);
    console.log(`Performing airdrop to ${recipientAddress.toBase58()}...`);

    // Setup connection and provider
    const provider = AnchorProvider.env();
    console.log('Provider:', provider);
    anchor.setProvider(provider);

    // Create program instance
    const program = new Program(idl, provider) as Program<Airdr0ppy>;

    try {
        // Derive PDA for airdr0ppyState
        const [airdr0ppyStatePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("airdr0ppy_state")],
            program.programId
        );

        // Derive PDA for userCooldown
        const [userCooldownPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("airdr0ppy_user"), recipientAddress.toBuffer()],
            program.programId
        );

        // Fetch airdr0ppyState to get mint address
        const airdr0ppyState = await fetchAirdr0ppyState(program);
        const mintAddress = airdr0ppyState.mintAccount;

        // Derive token accounts
        const tokenAccountPDA = PublicKey.findProgramAddressSync(
            [PROGRAM_ID.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
        )[0];

        const recipientTokenAccountPDA = PublicKey.findProgramAddressSync(
            [recipientAddress.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
        )[0];

        console.log('Mint address:', mintAddress.toBase58());
        console.log('Recipient token address:', recipientAddress.toBase58());

        console.log('Token account PDA:', tokenAccountPDA.toBase58());
        console.log('Recipient token account PDA:', recipientTokenAccountPDA.toBase58());

        // Perform airdrop
        const tx = await program.methods.airdrop(new BN(AIRDROP_AMOUNT))
            .accounts({
                mint: mintAddress,
                recipient: recipientAddress,
                user: provider.wallet.publicKey,
            })
            .rpc();

        console.log(`Airdrop successful! Transaction signature: ${tx}`);
    } catch (error: any) {
        console.error('Error performing airdrop:', error);

        if (error.code === 6000) {
            console.log('Advice: The cooldown period has not passed yet. Please try again later.');
        } else if (error.code === 6002) {
            console.log('Advice: The recipient balance exceeds the threshold. They are not eligible for an airdrop at this time.');
        } else if (error.code === 6004) {
            console.log('Advice: There are insufficient tokens available for airdrop. Please contact the program authority.');
        } else {
            console.log('Advice: An unexpected error occurred. Please check your input and try again.');
        }
    }
}

main().then(
    () => process.exit(),
    err => {
        console.error(err);
        process.exit(-1);
    },
);
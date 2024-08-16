use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::spl_token::instruction::AuthorityType;

declare_id!("Gj9YNmzd7TXso7J1bvMvvvFPSn6cqooqh53dkuee6MUy");


#[program]
pub mod airdr0ppy {
    use anchor_lang::Bumps;

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, initial_threshold: u64) -> Result<()> {
        let airdr0ppy_state = &mut ctx.accounts.airdr0ppy_state;
        airdr0ppy_state.cooldown_period = 120; // 2 minutes in seconds
        airdr0ppy_state.authority = ctx.accounts.authority.key();
        airdr0ppy_state.recipient_balance_threshold = initial_threshold;
        airdr0ppy_state.mint_account = ctx.accounts.token_account.key();
        Ok(())
    }

    pub fn update_cooldown(ctx: Context<UpdateState>, new_cooldown: i64) -> Result<()> {
        require!(new_cooldown >= 0, Airdr0ppyError::InvalidCooldown);
        ctx.accounts.airdr0ppy_state.cooldown_period = new_cooldown;
        Ok(())
    }

    pub fn update_threshold(ctx: Context<UpdateState>, new_threshold: u64) -> Result<()> {
        ctx.accounts.airdr0ppy_state.recipient_balance_threshold = new_threshold;
        Ok(())
    }

    pub fn airdrop(ctx: Context<Airdrop>, amount: u64) -> Result<()> {
        let airdr0ppy_state = &mut ctx.accounts.airdr0ppy_state;
        let user_cooldown = &mut ctx.accounts.user_cooldown;
        let current_time = Clock::get()?.unix_timestamp;


        if user_cooldown.last_airdrop == 0 {
            user_cooldown.last_airdrop = current_time;
        } else {
            require!(
                current_time - user_cooldown.last_airdrop >= airdr0ppy_state.cooldown_period,
                Airdr0ppyError::CooldownNotPassed
            );
            user_cooldown.last_airdrop = current_time;
        }

        // require!(
        //     ctx.accounts.recipient_token_account.amount <= airdr0ppy_state.recipient_balance_threshold,
        //     Airdr0ppyError::BalanceExceedsThreshold
        // );
        let cpi_accounts = Transfer {
            from: ctx.accounts.token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.airdr0ppy_state.to_account_info(),
        };
    

        msg!("Transfering tokens from {:?} to {:?}", cpi_accounts.from, cpi_accounts.to);
        msg!("Authority: {:?}", cpi_accounts.authority);

        let pid = crate::id();

        let (pda, _bump) = Pubkey::find_program_address(
            &[
                b"airdr0ppy_state"
            ],
            &pid
        );
        
        // Check if this matches ctx.accounts.airdr0ppy_state.key()
        if pda != ctx.accounts.airdr0ppy_state.key() {
            return Err(ProgramError::InvalidSeeds.into());
        }


        let seeds = [
            b"airdr0ppy_state".as_ref(),
            &[ctx.bumps.airdr0ppy_state],
        ];
    let signer_seeds = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds
            ),
            amount
        )?;



        emit!(AirdropEvent {
            recipient: *ctx.accounts.recipient_token_account.to_account_info().key,
            amount,
            timestamp: current_time,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 32 + 8 + 32 + 64,
        seeds = [b"airdr0ppy_state"],
        bump
    )]
    pub airdr0ppy_state: Account<'info, Airdr0ppyState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_account: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateState<'info> {
    #[account(
        mut,
        seeds = [b"airdr0ppy_state"],
        bump,
        has_one = authority
    )]
    pub airdr0ppy_state: Account<'info, Airdr0ppyState>,
    pub authority: Signer<'info>,
}



#[derive(Accounts)]
pub struct Airdrop<'info> {
    #[account(
        mut,
        seeds = [b"airdr0ppy_state"],
        bump
    )]
    pub airdr0ppy_state: Account<'info, Airdr0ppyState>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 8,
        seeds = [b"airdr0ppy_user", user.key().as_ref()],
        bump
    )]
    pub user_cooldown: Account<'info, UserCooldown>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = airdr0ppy_state.key()
    )]
    pub token_account: Account<'info, TokenAccount>,

    // create account in from mint address so ATA can be derrived
    #[account(address = airdr0ppy_state.mint_account)]
    pub mint: Account<'info, Mint>,

    /// CHECK: This is the recipient's main account only used to derrive the ATA
    pub recipient: UncheckedAccount<'info>,
 
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    #[account(
        address = crate::id(),
    )]
    /// CHECK: This is the program ID, used as the authority
    pub program_id: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Airdr0ppyState {
    pub cooldown_period: i64,               // how many seconds need to pass between airdrops
    pub authority: Pubkey,                  // the authority that can update the state
    pub recipient_balance_threshold: u64,   // the maximum balance a recipient can have to receive an airdrop
    pub mint_account: Pubkey,               // the mint account of the token to derrive the ATA from
}

#[account]
#[derive(Default)]
pub struct UserCooldown {
    pub last_airdrop: i64,
}

#[event]
pub struct AirdropEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum Airdr0ppyError {
    #[msg("Cooldown period has not passed yet")]
    CooldownNotPassed,
    #[msg("Invalid cooldown period")]
    InvalidCooldown,
    #[msg("Recipient balance exceeds threshold")]
    BalanceExceedsThreshold,
    #[msg("Invalid program token account")]
    InvalidProgramTokenAccount,
    #[msg("Insufficient tokens available for airdrop")]
    InsufficientAirdropTokens,
    #[msg("Arithmetic error")]
    ArithmeticError,
}
use anchor_lang::prelude::*;

declare_id!("Gj9YNmzd7TXso7J1bvMvvvFPSn6cqooqh53dkuee6MUy");

#[program]
pub mod airdr0ppy {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

// Farm plans: what to actually do about a pre-token protocol.
//
// A plan is six steps, each an action with a cost and a time, derived only from the
// protocol's own record (its category, its chains, its TVL, its age). No protocol
// name is special-cased and no step promises an airdrop: the plan is how to build a
// real, countable position in the protocol, so that if it ever issues a token, the
// wallet has a history worth rewarding. Every step is one string of 20 to 600
// characters, so the board's gate accepts it.

import type { SnapshotProtocol } from './model.ts';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and re-check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 300;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 30;
}

/** The category's one action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp')) {
    return `Lend $${capital} of USDC into ${name}'s lending market on ${chain} and leave it earning interest.`;
  }
  if (c.includes('dex') || c.includes('amm')) {
    return `Add $${capital} of liquidity to ${name}'s deepest pool on ${chain} and hold the LP position.`;
  }
  if (c.includes('yield') || c.includes('vault')) {
    return `Deposit $${capital} of USDC into ${name}'s vault on ${chain} and keep the vault shares.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC to ${chain} through ${name}, then put the bridged funds to work in its app.`;
  }
  if (c.includes('staking') || c.includes('restak') || c.includes('liquid')) {
    return `Stake $${capital} through ${name} on ${chain} and keep the staking receipt safe.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Post $${capital} of USDC as collateral on ${name} and open one small hedged position.`;
  }
  if (c.includes('prediction')) {
    return `Back $${capital} on one outcome on ${name} and leave the position open until it resolves.`;
  }
  if (c.includes('rwa') || c.includes('real world')) {
    return `Mint $${capital} of ${name}'s tokenized asset on ${chain} and hold it in your wallet.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('capital')) {
    return `Allocate $${capital} into a ${name} curated vault on ${chain} and keep the shares.`;
  }
  if (c.includes('stable')) {
    return `Mint or hold $${capital} of the stable asset through ${name} on ${chain}.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  }
  if (c.includes('basis')) {
    return `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and hold the position.`;
  }
  return `Put $${capital} of USDC to work in ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan
 * is derived from the protocol's own record (category, chains, TVL, age), never from
 * a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Set up a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 200 ? 10 : 5} of gas`,
      time: '20 minutes to set up',
    },
    {
      text: `Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote on the protocol.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

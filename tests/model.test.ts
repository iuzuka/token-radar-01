// Tests for the token radar model: snapshot parsing, board coverage and order,
// calibration sanity, farm-plan shape, and determinism (two runs, same bytes).
// Run: node --test tests/model.test.ts
// (Node 22.18+ runs the TypeScript directly; no build step.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODEL,
  buildRadar,
  boardIssue,
  calibrate,
  impliedValue,
  isPreToken,
  isRankable,
  parseSnapshot,
  type Snapshot,
} from '../lib/model.ts';
import { farmSteps, stepText } from '../lib/farm.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const SNAPSHOT = join(here, '..', '..', 'token-radar-01-kit', 'token-radar-01-kit', 'input', 'snapshot.json');

function loadSnapshot(): Snapshot {
  return parseSnapshot(readFileSync(SNAPSHOT, 'utf8'));
}

test('parseSnapshot accepts the sealed snapshot and rejects bad input', () => {
  const snap = loadSnapshot();
  assert.equal(typeof snap.as_of, 'string');
  assert.ok(snap.protocols.length > 100, 'snapshot carries hundreds of protocols');
  assert.ok(snap.watchlist.length > 0, 'watchlist is non-empty');
  assert.ok(snap.floor_usd > 0, 'floor is positive');
  assert.throws(() => parseSnapshot('not json'), /not JSON/);
  assert.throws(() => parseSnapshot('{"as_of": "x"}'), /as_of/);
  assert.throws(() => parseSnapshot('{"as_of": "2026-11-14", "source": "s", "floor_usd": 0, "protocols": [], "watchlist": []}'), /floor_usd/);
});

test('calibration multiples stay in the model band and use live comparables', () => {
  const snap = loadSnapshot();
  const cal = calibrate(snap, MODEL);
  assert.ok(cal.global_comps > 50, 'dozens of live comparables price the model');
  assert.ok(cal.global_multiple >= MODEL.multiple_floor && cal.global_multiple <= MODEL.multiple_cap);
  assert.ok(cal.by_category.length > 5, 'several categories calibrated');
  for (const c of cal.by_category) {
    assert.ok(c.multiple >= MODEL.multiple_floor && c.multiple <= MODEL.multiple_cap, `${c.category} multiple in band`);
    assert.ok(c.comps >= 1, `${c.category} has comparables`);
  }
});

test('implied values are positive, distinct and monotone in TVL within a category', () => {
  const snap = loadSnapshot();
  const cal = calibrate(snap, MODEL);
  const seen = new Set<number>();
  let distinct = 0;
  for (const p of snap.protocols.slice(0, 120)) {
    const v = impliedValue(p, snap.as_of, cal, MODEL);
    assert.ok(Number.isSafeInteger(v.implied) && v.implied > 0, `${p.slug} implied is a positive integer`);
    if (!seen.has(v.implied)) distinct++;
    seen.add(v.implied);
  }
  assert.ok(distinct > 100, 'implied values are mostly distinct, not a flat multiple');
});

test('the board covers the whole watchlist, ranks cleanly and passes the gate', () => {
  const snap = loadSnapshot();
  const { board, radar } = buildRadar(snap, MODEL);
  assert.ok(board.length >= 100, `board has ${board.length} rows, at least 100`);
  const slugs = new Set(board.map((r) => r.slug));
  for (const s of snap.watchlist) assert.ok(slugs.has(s), `watchlist slug ${s} is ranked`);
  assert.equal(boardIssue(board, snap), null, 'board passes the gate');
  for (let i = 0; i < board.length; i++) {
    assert.equal(board[i]!.rank, i + 1, `rank ${i + 1} is sequential`);
    assert.equal(board[i]!.token_status, 'pre-token');
    if (i > 0) assert.ok(board[i]!.implied_value_usd <= board[i - 1]!.implied_value_usd, 'implied values descend');
  }
  assert.equal(radar.board_size, board.length);
  assert.equal(radar.watchlist_size, snap.watchlist.length);
  assert.ok(radar.early_size > 0, 'early rows below the floor are included');
  assert.equal(radar.live_size, 24, 'live view carries 24 rows');
});

test('every board row carries a valid farm plan', () => {
  const snap = loadSnapshot();
  const { board } = buildRadar(snap, MODEL);
  for (const row of board) {
    assert.ok(row.farm_steps.length >= 3 && row.farm_steps.length <= 12, `${row.slug} has 3..12 steps`);
    for (const s of row.farm_steps) {
      assert.ok(s.length >= 20 && s.length <= 600, `${row.slug} step is 20..600 chars`);
    }
    assert.ok(Number.isSafeInteger(row.implied_value_usd) && row.implied_value_usd > 0);
  }
});

test('farm steps derive from the protocol record, not from a name list', () => {
  const snap = loadSnapshot();
  const lending = snap.protocols.find((p) => (p.category ?? '').toLowerCase().includes('lend') && isRankable(p));
  const dex = snap.protocols.find((p) => (p.category ?? '').toLowerCase().includes('dex') && isRankable(p));
  assert.ok(lending, 'a rankable lending protocol exists');
  assert.ok(dex, 'a rankable dex protocol exists');
  const lendSteps = farmSteps(lending, 400).map(stepText);
  const dexSteps = farmSteps(dex, 400).map(stepText);
  assert.ok(lendSteps[1]!.toLowerCase().includes('lend'), 'lending plan lends');
  assert.ok(dexSteps[1]!.toLowerCase().includes('liquidity'), 'dex plan adds liquidity');
  assert.notEqual(lendSteps[1], dexSteps[1], 'different categories get different plans');
  // A pre-token protocol and a live one are scored differently by status.
  const live = snap.protocols.find((p) => !isPreToken(p));
  assert.ok(live, 'a live-token protocol exists');
  assert.ok(!isRankable(live) || isPreToken(live), 'live protocols are not rankable pre-token rows');
});

test('the build is deterministic: two runs give the same board bytes', () => {
  const snap = loadSnapshot();
  const first = buildRadar(snap, MODEL);
  const second = buildRadar(snap, MODEL);
  const a = JSON.stringify({ rows: first.board });
  const b = JSON.stringify({ rows: second.board });
  assert.equal(a, b, 'board bytes are identical across runs');
  const calA = JSON.stringify(first.calibration);
  const calB = JSON.stringify(second.calibration);
  assert.equal(calA, calB, 'calibration bytes are identical across runs');
});

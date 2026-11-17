// Token Radar dashboard: the board, a detail view for every protocol, the live
// tokens that price the categories, and the method. Reads window.RADAR from
// data.js. No network, no framework. State lives in the URL hash so a view can
// be linked to: #/board, #/live, #/method, #/detail/<slug>, and
// #/board?category=Dexs&chain=Ethereum&q=stake.
(function () {
  'use strict';

  var D = window.RADAR;
  if (!D || !Array.isArray(D.rows)) {
    document.getElementById('rows').innerHTML =
      '<tr><td colspan="9" class="empty">No radar data loaded.</td></tr>';
    return;
  }

  // ---------------------------------------------------------------- helpers

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }

  function fmtFull(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }

  function pctClass(n) {
    if (n === null || n === undefined) return '';
    return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    var y = (days / 365).toFixed(1);
    return y + 'y';
  }

  function fmtMult(n) {
    return (Math.round(n * 100) / 100).toFixed(2) + 'x';
  }

  // ---------------------------------------------------------------- farm plan
  // Mirrors lib/farm.ts exactly: the same capital tiers, hold windows and
  // category actions, so the plan the page shows is the plan board.json holds.

  function chainOf(row) {
    return row.chains && row.chains.length > 0 ? row.chains[0] : 'its main chain';
  }

  function capitalFor(row) {
    if (row.tvl_usd >= 5000000000) return 300;
    if (row.tvl_usd >= 1000000000) return 200;
    if (row.tvl_usd >= 100000000) return 100;
    return 50;
  }

  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 90;
    if (age < 365) return 60;
    return 30;
  }

  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) {
      return 'Lend $' + capital + ' of USDC into ' + name + '\'s lending market on ' + chain + ' and leave it earning interest.';
    }
    if (c.indexOf('dex') >= 0 || c.indexOf('amm') >= 0) {
      return 'Add $' + capital + ' of liquidity to ' + name + '\'s deepest pool on ' + chain + ' and hold the LP position.';
    }
    if (c.indexOf('yield') >= 0 || c.indexOf('vault') >= 0) {
      return 'Deposit $' + capital + ' of USDC into ' + name + '\'s vault on ' + chain + ' and keep the vault shares.';
    }
    if (c.indexOf('bridge') >= 0) {
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then put the bridged funds to work in its app.';
    }
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0 || c.indexOf('liquid') >= 0) {
      return 'Stake $' + capital + ' through ' + name + ' on ' + chain + ' and keep the staking receipt safe.';
    }
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) {
      return 'Post $' + capital + ' of USDC as collateral on ' + name + ' and open one small hedged position.';
    }
    if (c.indexOf('prediction') >= 0) {
      return 'Back $' + capital + ' on one outcome on ' + name + ' and leave the position open until it resolves.';
    }
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) {
      return 'Mint $' + capital + ' of ' + name + '\'s tokenized asset on ' + chain + ' and hold it in your wallet.';
    }
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('capital') >= 0) {
      return 'Allocate $' + capital + ' into a ' + name + ' curated vault on ' + chain + ' and keep the shares.';
    }
    if (c.indexOf('stable') >= 0) {
      return 'Mint or hold $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    }
    if (c.indexOf('insurance') >= 0) {
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    }
    if (c.indexOf('basis') >= 0) {
      return 'Deposit $' + capital + ' of USDC into ' + name + '\'s basis strategy on ' + chain + ' and hold the position.';
    }
    return 'Put $' + capital + ' of USDC to work in ' + name + ' on ' + chain + ' and keep the position open.';
  }

  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Hold the position and re-check the protocol\'s own page.';
    return s;
  }

  function farmSteps(row) {
    var chain = chainOf(row);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var action = actionFor(row, capital, chain);
    var gas = capital >= 200 ? 10 : 5;
    return [
      { text: 'Set up a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline on paper.', cost: 'under $3 of gas for the first transaction', time: '10 minutes' },
      { text: action, cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '20 minutes to set up' },
      { text: 'Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote on the protocol.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it cleanly.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  // ---------------------------------------------------------------- state

  var state = { view: 'board', q: '', category: '', chain: '', sort: 'implied', detail: null };

  function readHash() {
    var h = location.hash || '#/board';
    var m = h.match(/^#\/([a-z]+)(?:\/([^?]*))?(?:\?(.*))?$/);
    if (!m) return;
    state.view = m[1] === 'live' || m[1] === 'method' ? m[1] : 'board';
    state.detail = m[1] === 'detail' && m[2] ? decodeURIComponent(m[2]) : null;
    if (state.detail) state.view = 'board';
    state.q = ''; state.category = ''; state.chain = '';
    if (m[3]) {
      var params = new URLSearchParams(m[3]);
      state.q = params.get('q') || '';
      state.category = params.get('category') || '';
      state.chain = params.get('chain') || '';
      var sort = params.get('sort');
      if (sort) state.sort = sort;
    }
  }

  function writeHash() {
    var h = '#/' + state.view;
    if (state.detail) h = '#/detail/' + encodeURIComponent(state.detail);
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.chain) params.set('chain', state.chain);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    var qs = params.toString();
    if (qs) h += '?' + qs;
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  // ---------------------------------------------------------------- render

  var $ = function (id) { return document.getElementById(id); };

  function renderHead() {
    $('asof').textContent = D.as_of;
    $('asof2').textContent = D.as_of;
    $('source').textContent = D.source;
    $('modelver').textContent = D.model_version;
    var stats = [
      ['Protocols scanned', D.protocols_scanned],
      ['Watchlist', D.watchlist_size],
      ['Ranked', D.board_size],
      ['Early finds', D.early_size],
      ['Live comparables', D.calibration.global_comps],
      ['Global multiple', fmtMult(D.calibration.global_multiple)]
    ];
    $('stats').innerHTML = stats.map(function (s) {
      return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(String(s[1])) + '</dd></div>';
    }).join('');
  }

  function fillSelects() {
    var cats = {};
    var chains = {};
    D.rows.forEach(function (r) {
      if (r.category) cats[r.category] = true;
      (r.chains || []).forEach(function (c) { chains[c] = true; });
    });
    var catSel = $('category');
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c; catSel.appendChild(o);
    });
    var chainSel = $('chain');
    Object.keys(chains).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c; chainSel.appendChild(o);
    });
    catSel.value = state.category;
    chainSel.value = state.chain;
    $('q').value = state.q;
    $('sort').value = state.sort;
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.category && r.category !== state.category) return false;
      if (state.chain && !(r.chains || []).indexOf(state.chain) >= 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d || 0) - (a.change_7d || 0);
      if (key === 'age') return (b.age_days || 0) - (a.age_days || 0);
      if (key === 'launch') return b.launch_score - a.launch_score;
      return b.implied_value_usd - a.implied_value_usd;
    });
    return rows;
  }

  function renderBoard() {
    var rows = filteredRows();
    $('count').textContent = rows.length + ' of ' + D.rows.length + ' protocols';
    if (rows.length === 0) {
      $('rows').innerHTML = '<tr><td colspan="9" class="empty">No protocol matches these filters.</td></tr>';
      return;
    }
    $('rows').innerHTML = rows.map(function (r) {
      var chains = (r.chains || []).slice(0, 3).map(function (c) {
        return '<span class="tag">' + esc(c) + '</span>';
      }).join('');
      var extra = (r.chains || []).length > 3 ? ' <span class="tag">+' + ((r.chains || []).length - 3) + '</span>' : '';
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="open"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chains + extra + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + fmtUsd(r.implied_value_usd) + '</td>' +
        '<td class="num">' + r.launch_score + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderLive() {
    $('liverows').innerHTML = D.live.map(function (r) {
      var chains = (r.chains || []).slice(0, 3).map(function (c) {
        return '<span class="tag">' + esc(c) + '</span>';
      }).join('');
      return '<tr>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chains + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
        '<td class="num">' + (r.mcap_tvl_ratio === null ? '—' : fmtMult(r.mcap_tvl_ratio)) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderMethod() {
    var cal = D.calibration.by_category.map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td class="num">' + fmtMult(c.multiple) + '</td><td class="num">' + c.comps + '</td><td class="num">' + fmtMult(c.median_ratio) + '</td></tr>';
    }).join('');
    $('method').innerHTML =
      '<h2>How it is priced</h2>' +
      '<p>An implied value is a model&rsquo;s reading, not a price. It answers one question: if this protocol issued a token tomorrow, what would the market pay for it, judged by what it pays for the protocols that already trade?</p>' +
      '<h3>The model</h3>' +
      '<div class="formula">implied = TVL &times; category multiple &times; growth &times; maturity &times; breadth</div>' +
      '<p><strong>Category multiple.</strong> For each category, the median market-cap-to-TVL ratio of its live-token protocols. A DEX is priced like a DEX and a lender like a lender. A category with fewer than ' + D.model.min_category_comps + ' live comparables uses the global median instead. Every multiple is clamped to ' + D.model.multiple_floor + '&ndash;' + D.model.multiple_cap + 'x, so one outlier never sets a price. The global median across ' + D.calibration.global_comps + ' live protocols is ' + fmtMult(D.calibration.global_multiple) + '.</p>' +
      '<p><strong>Growth.</strong> The 7-day TVL change, clamped to ' + D.model.growth_floor + '%&hellip;' + D.model.growth_cap + '%, moves the value by half its size: a protocol growing 20% in a week is worth 10% more than a flat one.</p>' +
      '<p><strong>Maturity.</strong> A protocol earns its full multiple slowly: 0.6 at launch, rising to 1.0 over ' + D.model.maturity_days + ' days. A protocol with no listing date is scored at ' + D.model.unknown_age_days + ' days.</p>' +
      '<p><strong>Breadth.</strong> Each extra chain adds ' + Math.round(D.model.breadth_step * 100) + '%, up to ' + D.model.breadth_max_chains + ' extra chains: a protocol live in many places reaches more users.</p>' +
      '<h3>Calibration table</h3>' +
      '<div class="table-wrap"><table><thead><tr><th>Category</th><th class="num">Multiple used</th><th class="num">Live comps</th><th class="num">Median ratio</th></tr></thead><tbody>' + cal + '</tbody></table></div>' +
      '<h3>The watchlist, and beyond it</h3>' +
      '<p>The snapshot&rsquo;s watchlist is a floor, never a ceiling: ' + D.watchlist_size + ' protocols at or above $' + (D.floor_usd / 1e6) + 'M of TVL that record no token and are not a wrapped, staked or bridged product. The board covers all of them, then adds every other rankable pre-token protocol below the floor (' + D.early_size + ' early finds), so the board is the whole pre-token universe the snapshot carries: ' + D.board_size + ' rows.</p>' +
      '<h3>Launch score</h3>' +
      '<p>Each row also carries a 0&ndash;100 launch score for display: size, age, momentum and chain breadth. It does not set the rank; the implied value does.</p>' +
      '<h3>Farm plans</h3>' +
      '<p>Every row has a six-step farm plan, derived from its own category, chains, TVL and age: a fresh wallet, the main position, a weekly qualifying action, a hold window, a safe-claim check and a farm log. No step promises an airdrop. The plan is how to build a real, countable position, so that if the protocol ever issues a token, the wallet has a history worth rewarding.</p>' +
      '<h3>What this is not</h3>' +
      '<p>The snapshot carries no ranking, no implied value and no farm plan; deriving them is this entry&rsquo;s work. The snapshot is frozen at ' + D.as_of + ' and is not updated. Nothing here is investment advice.</p>';
  }

  function comparables(row) {
    var same = D.live.filter(function (l) { return l.category === row.category; });
    if (same.length === 0) {
      return '<p class="note">No live-token protocol in this category sits in the top ' + D.live_size + ' by market cap, so this row is priced off the global multiple of ' + fmtMult(D.calibration.global_multiple) + '.</p>';
    }
    var items = same.slice(0, 5).map(function (l) {
      return '<tr><td>' + esc(l.name) + '</td><td class="num">' + fmtUsd(l.tvl_usd) + '</td><td class="num">' + fmtUsd(l.mcap_usd) + '</td><td class="num">' + (l.mcap_tvl_ratio === null ? '—' : fmtMult(l.mcap_tvl_ratio)) + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>Live comparable</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Mcap / TVL</th></tr></thead><tbody>' + items + '</tbody></table></div>';
  }

  function renderDetail() {
    var panel = $('detail');
    var body = $('detail-body');
    if (!state.detail) {
      panel.hidden = true;
      body.innerHTML = '';
      return;
    }
    var row = null;
    for (var i = 0; i < D.rows.length; i++) {
      if (D.rows[i].slug === state.detail) { row = D.rows[i]; break; }
    }
    if (!row) {
      panel.hidden = true;
      body.innerHTML = '';
      return;
    }
    var base = row.tvl_usd * row.category_multiple;
    var steps = farmSteps(row).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    body.innerHTML =
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="sub">Rank #' + row.rank + ' &middot; ' + esc(row.slug) + ' &middot; ' + esc(row.category || 'Uncategorized') + ' &middot; ' + esc((row.chains || []).join(', ') || '—') + '</p>' +
      '<h3>Implied value</h3>' +
      '<dl class="kv">' +
      '<dt>Implied value</dt><dd>' + fmtFull(row.implied_value_usd) + '</dd>' +
      '<dt>TVL</dt><dd>' + fmtFull(row.tvl_usd) + '</dd>' +
      '<dt>Category multiple</dt><dd>' + fmtMult(row.category_multiple) + '</dd>' +
      '<dt>Base (TVL &times; multiple)</dt><dd>' + fmtFull(base) + '</dd>' +
      '<dt>Growth multiplier</dt><dd>' + fmtMult(row.growth_multiplier) + ' (' + fmtPct(row.change_7d) + ' in 7d)</dd>' +
      '<dt>Maturity multiplier</dt><dd>' + fmtMult(row.maturity_multiplier) + ' (' + fmtAge(row.age_days) + ' old)</dd>' +
      '<dt>Breadth multiplier</dt><dd>' + fmtMult(row.breadth_multiplier) + ' (' + (row.chains || []).length + ' chains)</dd>' +
      '<dt>Launch score</dt><dd>' + row.launch_score + ' / 100</dd>' +
      '</dl>' +
      '<div class="meter"><i style="width:' + row.launch_score + '%"></i></div>' +
      '<h3>Farm plan</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<h3>Live comparables</h3>' +
      comparables(row) +
      '<p class="note" style="margin-top:14px">Pre-token: this protocol records no token, no market cap and no CoinGecko id in the snapshot. An implied value is a model&rsquo;s reading, not a price, and no farm step promises an airdrop.</p>';
    panel.hidden = false;
  }

  function render() {
    document.querySelectorAll('.view-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === state.view);
    });
    $('view-board').hidden = state.view !== 'board';
    $('view-live').hidden = state.view !== 'live';
    $('view-method').hidden = state.view !== 'method';
    $('controls').style.display = state.view === 'board' ? '' : 'none';
    if (state.view === 'board') renderBoard();
    if (state.view === 'live') renderLive();
    if (state.view === 'method') renderMethod();
    renderDetail();
    writeHash();
  }

  // ---------------------------------------------------------------- events

  document.querySelectorAll('.view-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.view = b.getAttribute('data-view');
      state.detail = null;
      render();
    });
  });

  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); writeHash(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); writeHash(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); writeHash(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); writeHash(); });

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    var slug = tr.getAttribute('data-slug');
    state.detail = state.detail === slug ? null : slug;
    render();
  });

  $('detail-close').addEventListener('click', function () {
    state.detail = null;
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.detail) { state.detail = null; render(); }
  });

  window.addEventListener('hashchange', function () {
    readHash();
    $('q').value = state.q;
    $('category').value = state.category;
    $('chain').value = state.chain;
    $('sort').value = state.sort;
    render();
  });

  // ---------------------------------------------------------------- init

  readHash();
  renderHead();
  fillSelects();
  render();
})();

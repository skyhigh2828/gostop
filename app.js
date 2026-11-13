// 용도: 고스톱·맞고 계산기 화면 동작과 저장 (계산은 calc.js가 담당)
// 사용법: index.html이 불러온다. 기록은 이 기기 브라우저의 localStorage에 저장된다.
// 화면 흐름: 인원 선택(count) → 설정(setup) → 게임(game)
(function () {
  'use strict';
  var C = window.GoStopCalc;
  var KEY = 'gostop-calc-v1';
  var app = document.getElementById('app');
  var dlg = document.getElementById('dlg');

  var state = migrate(load());
  var draft = newDraft();
  var tab = 'input';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장이 막힌 환경에서도 계산은 계속된다 */ }
  }
  // 예전(맞고 전용) 저장 형식을 지금 형식으로 맞춘다
  function migrate(s) {
    s = s || {};
    if (!s.n) s.n = 2;
    if (!s.step) s.step = s.started ? 'game' : 'count';
    delete s.started;
    s.names = (s.names || []).slice(0, s.n);
    while (s.names.length < s.n) s.names.push('');
    s.rules = Object.assign(clone(C.DEFAULT_RULES), s.rules || {});
    s.log = s.log || [];
    if (s.inputMode !== 'cards') s.inputMode = 'direct'; // 기본은 점수 바로 입력
    return s;
  }
  function newDraft() {
    return { winner: null, sit: null, sold: 0, losers: {}, score: 0, meong: false, gwang: 0, bigwang: false, yeol: 0, godori: false, tti: 0, hongdan: false, cheongdan: false, chodan: false, pi: 0, go: 0, shake: 0 };
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function won(n) { return Math.abs(n).toLocaleString('ko-KR') + '원'; }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + won(n); }
  function cls(n) { return n > 0 ? 'plus' : n < 0 ? 'minus' : ''; }
  function name(i) { return state.names[i] || (state.n === 2 ? (i === 0 ? '나' : '상대') : (i + 1) + '번'); }
  function gameName() { return state.n === 2 ? '맞고' : state.n + '인 고스톱'; }
  function losersOf(d) {
    var out = [];
    for (var i = 0; i < state.n; i++) if (i !== d.winner && i !== d.sit) out.push(i);
    return out;
  }

  // 선택 창. 고른 값으로 resolve, 닫으면 null
  function choose(title, text, options) {
    return new Promise(function (resolve) {
      dlg.innerHTML = '<h3>' + esc(title) + '</h3><p>' + esc(text || '') + '</p><div class="opts">' +
        options.map(function (o, i) { return '<button class="' + (o.primary ? 'primary' : 'ghost') + '" data-opt="' + i + '">' + esc(o.label) + '</button>'; }).join('') +
        '<button class="ghost" data-opt="-1">취소</button></div>';
      var done = false;
      function finish(v) { if (done) return; done = true; dlg.onclick = null; dlg.onclose = null; if (dlg.open) dlg.close(); resolve(v); }
      dlg.onclick = function (ev) {
        var b = ev.target.closest('[data-opt]');
        if (!b) return;
        var i = +b.dataset.opt;
        finish(i < 0 ? null : options[i].value);
      };
      dlg.onclose = function () { finish(null); };
      dlg.showModal();
    });
  }

  // ───────── 인원 선택 화면 ─────────
  function renderCount() {
    app.innerHTML =
      '<h1>고스톱 계산기</h1>' +
      '<div class="card"><h2>몇 명이서 치나요?</h2><div class="count">' +
        '<button data-count="2"><b>2명</b><span>맞고</span></button>' +
        '<button data-count="3"><b>3명</b><span>고스톱</span></button>' +
        '<button data-count="4"><b>4명</b><span>고스톱 · 한 명씩 쉬면서 광팔기</span></button>' +
      '</div></div>';
  }
  function pickCount(n) {
    var kindChanged = (state.n === 2) !== (n === 2) || !state.rulesFor;
    state.n = n;
    state.names = state.names.slice(0, n);
    while (state.names.length < n) state.names.push('');
    // 맞고와 고스톱은 기준 점수가 달라서, 종류가 바뀌면 그에 맞는 기본값으로 바꾼다
    if (kindChanged) { Object.assign(state.rules, C.defaultsFor(n)); state.rulesFor = n === 2 ? 2 : 3; }
    state.step = 'setup';
    save(); render(); window.scrollTo(0, 0);
  }

  // ───────── 설정 화면 ─────────
  var RULE_FIELDS = [
    ['goalScore', '몇 점에 나기', ''],
    ['ppuk1', '첫뻑', '몇 점 값으로 받을지'],
    ['ppuk2', '연뻑', ''],
    ['ppuk3', '삼연뻑', ''],
    ['ttadak', '첫따닥', '안 치면 0'],
    ['chongtong', '총통', '안 치면 0'],
    ['pibakLimit', '피박 기준 (피 몇 장 이하)', '']
  ];
  var MONEY_FIELDS = { ppuk1: 1, ppuk2: 1, ppuk3: 1, ttadak: 1, chongtong: 1, gwangValue: 1 };
  var RULE_TOGGLES = [
    ['meongtta', '멍박', '열끗 7장 이상이면 2배'],
    ['gobak', '고박', ''],
    ['nagariDouble', '나가리 다음 판 2배', ''],
    ['bigwang2', '비광 포함 삼광은 2점', '']
  ];

  function fieldHtml(f) {
    var money = MONEY_FIELDS[f[0]];
    return '<label class="field"><span>' + f[1] + (money ? ' (점)' : '') +
      '<small>' + (money ? '<span data-money="' + f[0] + '"></span>' : '') + (f[2] ? (money ? ' · ' : '') + f[2] : '') + '</small></span>' +
      '<input type="number" id="r_' + f[0] + '" inputmode="numeric" min="0" value="' + state.rules[f[0]] + '"></label>';
  }

  function renderSetup() {
    var r = state.rules, n = state.n;
    var ph = n === 2 ? ['나', '상대'] : ['1번', '2번', '3번', '4번'];
    app.innerHTML =
      '<h1>' + gameName() + '</h1>' +
      '<button class="del" id="backCount">← 인원 다시 고르기</button>' +
      '<div class="card" style="margin-top:10px"><h2>치는 사람</h2><div class="two">' +
        state.names.map(function (nm, i) {
          return '<input type="text" id="n' + i + '" maxlength="8" placeholder="' + ph[i] + '" value="' + esc(nm) + '">';
        }).join('') +
      '</div></div>' +
      '<div class="card"><h2>점당 얼마</h2>' +
        '<label class="field"><span>점당 금액 (원)</span><input type="number" id="r_pointValue" inputmode="numeric" min="0" step="10" value="' + r.pointValue + '"></label>' +
        '<label class="field"><span>한 판 상한 금액 (원)<small>한 사람이 한 판에 내는 최대 금액. 0이면 없음</small></span><input type="number" id="r_cap" inputmode="numeric" min="0" step="100" value="' + r.cap + '"></label>' +
        (n === 4 ? fieldHtml(['gwangValue', '광값 (광 1장당)', '쉬는 사람이 승자에게 받음']) : '') +
      '</div>' +
      '<div class="card"><details><summary>룰 설정 (첫뻑, 피박 기준 등)</summary>' +
        RULE_FIELDS.map(fieldHtml).join('') +
        RULE_TOGGLES.map(function (f) {
          var hint = f[0] === 'gobak' ? (n === 2 ? '고 부르고 지면 2배' : '고 부르고 지면 다른 사람 몫까지 냄') : f[2];
          return '<label class="field"><span>' + f[1] + (hint ? '<small>' + hint + '</small>' : '') + '</span>' +
            '<input type="checkbox" id="r_' + f[0] + '"' + (r[f[0]] ? ' checked' : '') + '></label>';
        }).join('') +
      '</details></div>' +
      '<button class="primary" id="start">게임 시작</button>' +
      '<p class="note">기록은 이 폰에만 저장됩니다. 브라우저의 사이트 데이터를 지우면 함께 사라집니다.</p>';
    updateMoneyHints();
  }

  function num(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    var v = parseInt(el.value, 10);
    return isFinite(v) && v >= 0 ? v : fallback;
  }
  function updateMoneyHints() {
    var pv = num('r_pointValue', 0);
    app.querySelectorAll('[data-money]').forEach(function (el) {
      el.textContent = won(num('r_' + el.dataset.money, 0) * pv);
    });
  }
  function readSetup() {
    var r = state.rules, d = C.DEFAULT_RULES;
    state.names = state.names.map(function (_, i) { return document.getElementById('n' + i).value.trim(); });
    r.pointValue = num('r_pointValue', d.pointValue);
    r.cap = num('r_cap', 0);
    r.gwangValue = num('r_gwangValue', r.gwangValue);
    RULE_FIELDS.forEach(function (f) { r[f[0]] = num('r_' + f[0], r[f[0]]); });
    RULE_TOGGLES.forEach(function (f) { r[f[0]] = document.getElementById('r_' + f[0]).checked; });
  }

  // ───────── 게임 화면 ─────────
  function normalize(d) {
    Object.keys(d.losers).forEach(function (k) { if (+k === d.winner || +k === d.sit) delete d.losers[k]; });
    if (d.sit === null) d.sold = 0;
    if (state.inputMode === 'direct') return;
    if (d.gwang !== 3) d.bigwang = false;
    if (d.yeol < 3) d.godori = false; // 고도리는 열끗 3장이 필요하다
    var dans = ['chodan', 'cheongdan', 'hongdan'];
    var on = dans.filter(function (k) { return d[k]; });
    while (on.length * 3 > d.tti) { d[on.shift()] = false; }
    Object.keys(d.losers).forEach(function (k) {
      if (d.pi < 10) d.losers[k].pibak = false;
      if (d.gwang < 3) d.losers[k].gwangbak = false;
    });
  }
  function stepper(key, label, extra) {
    return '<div class="row"><span class="lbl">' + label + '</span><div class="step">' +
      '<button data-step="' + key + '" data-d="-1" aria-label="' + label + ' 줄이기">−</button><b>' + draft[key] + '</b>' +
      '<button data-step="' + key + '" data-d="1" aria-label="' + label + ' 늘리기">+</button>' + (extra || '') + '</div></div>';
  }
  function chip(key, label, disabled) {
    return '<button class="chip' + (draft[key] ? ' on' : '') + '" data-chip="' + key + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  }
  function lchip(i, key, label, disabled) {
    var on = draft.losers[i] && draft.losers[i][key];
    return '<button class="chip' + (on ? ' on' : '') + '" data-lchip="' + i + ':' + key + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  }
  function seg(attr, list, selected) {
    return '<div class="seg c' + list.length + '">' + list.map(function (i) {
      return '<button data-' + attr + '="' + i + '" class="' + (selected === i ? 'on' : '') + '">' + esc(name(i)) + '</button>';
    }).join('') + '</div>';
  }
  var LIMITS = { score: 999, sold: 5, gwang: 5, yeol: 9, tti: 10, pi: 40, go: 9, shake: 4 };

  function rulesLine() {
    var r = state.rules, parts = [gameName(), '점 ' + r.pointValue.toLocaleString('ko-KR'), r.goalScore + '점 나기'];
    if (r.ppuk1) parts.push('첫뻑 ' + won(r.ppuk1 * r.pointValue));
    parts.push('피박 ' + r.pibakLimit + '장');
    if (state.n === 4) parts.push('광값 ' + won(r.gwangValue * r.pointValue));
    parts.push(r.cap ? '상한 ' + won(r.cap) : '상한 없음');
    return parts.join(' · ');
  }
  function settleNow() { return C.settle(state.log, state.rules, state.n); }
  function roundFromDraft() {
    var e = Object.assign({ direct: state.inputMode === 'direct' }, draft);
    e.losers = clone(draft.losers);
    return e;
  }

  function renderGame() {
    var s = settleNow();
    var rounds = s.rows.filter(function (x) { return x.roundNo; }).length;
    var html =
      '<div class="board n' + state.n + '">' + s.balances.map(function (b, i) {
        return '<div class="who"><div class="name">' + esc(name(i)) + '</div><div class="bal ' + cls(b) + '">' + signed(b) + '</div></div>';
      }).join('') + '</div>' +
      '<p class="rules">' + esc(rulesLine()) + '</p>' +
      '<div class="tabs"><button data-tab="input" class="' + (tab === 'input' ? 'on' : '') + '">판 입력</button>' +
      '<button data-tab="log" class="' + (tab === 'log' ? 'on' : '') + '">기록 (' + rounds + '판)</button></div>';
    html += tab === 'input' ? inputHtml(s) : logHtml(s);
    app.innerHTML = html;
  }

  function inputHtml(s) {
    var d = draft, r = state.rules, n = state.n, direct = state.inputMode === 'direct';
    var all = [], i;
    for (i = 0; i < n; i++) all.push(i);
    var h = '';

    if (n === 4) {
      h += '<div class="card"><h2>이번 판 쉬는 사람</h2>' + seg('sit', all, d.sit) +
        (d.sit !== null ? stepper('sold', '판 광 수') + '<p class="note">광 1장당 ' + won(r.gwangValue * r.pointValue) + '을 이번 판 승자에게 받습니다.</p>' : '') + '</div>';
    }

    var players = all.filter(function (x) { return x !== d.sit; });
    h += '<div class="card"><h2>이긴 사람</h2>' + seg('winner', players, d.winner) + '</div>';

    if (direct) h += '<div class="card"><h2>점수</h2>' +
      '<div class="row"><span class="lbl">패 점수<small>고 점수 제외</small></span><div class="step">' +
      '<button data-step="score" data-d="-1" aria-label="점수 줄이기">−</button>' +
      '<input id="score" type="number" inputmode="numeric" min="0" max="999" placeholder="0" value="' + (d.score || '') + '">' +
      '<button data-step="score" data-d="1" aria-label="점수 늘리기">+</button></div></div>' +
      stepper('go', '고') + stepper('shake', '흔들기·폭탄') +
      (r.meongtta ? '<div class="chips">' + chip('meong', '멍박 (열끗 7장 이상)') + '</div>' : '') +
      '<button class="del" data-mode="cards">패 장수로 계산하기</button></div>';

    if (!direct) {
      var danCount = [d.hongdan, d.cheongdan, d.chodan].filter(Boolean).length;
      var danFull = (danCount + 1) * 3 > d.tti;
      h += '<div class="card"><h2>이긴 사람이 먹은 패</h2>' +
        stepper('gwang', '광') +
        (d.gwang === 3 ? '<div class="chips">' + chip('bigwang', '비광 포함') + '</div>' : '') +
        '<hr class="sep">' + stepper('yeol', '열끗') +
        '<div class="chips">' + chip('godori', '고도리', d.yeol < 3) + '</div>' +
        '<hr class="sep">' + stepper('tti', '띠') +
        '<div class="chips">' + chip('hongdan', '홍단', !d.hongdan && danFull) + chip('cheongdan', '청단', !d.cheongdan && danFull) + chip('chodan', '초단', !d.chodan && danFull) + '</div>' +
        '<hr class="sep">' + stepper('pi', '피', '<button class="five" data-step="pi" data-d="5">+5</button>') +
        '<p class="note">쌍피는 2장으로 세어 합계를 넣습니다.</p></div>' +
        '<div class="card"><h2>고 · 흔들기</h2>' + stepper('go', '고') + stepper('shake', '흔들기·폭탄') +
        '<button class="del" data-mode="direct">점수 바로 입력하기</button></div>';
    }

    // 박 체크: 패자마다 따로
    var noPi = !direct && d.pi < 10, noGwang = !direct && d.gwang < 3;
    h += '<div class="card"><h2>진 사람 박 체크</h2>';
    if (d.winner === null) h += '<div class="note">이긴 사람을 고르면 나옵니다.</div>';
    else losersOf(d).forEach(function (li) {
      h += '<div class="loser"><span class="lname">' + esc(name(li)) + '</span><div class="chips">' +
        lchip(li, 'pibak', '피박', noPi) + lchip(li, 'gwangbak', '광박', noGwang) +
        (r.gobak ? lchip(li, 'gobak', '고박') : '') + '</div></div>';
    });
    h += '<p class="note">피박은 피 ' + r.pibakLimit + '장 이하, 광박은 광 0장일 때입니다.' +
      (r.gobak && n > 2 ? ' 고박인 사람은 다른 사람 몫까지 냅니다.' : '') + '</p></div>';

    h += '<div id="live">' + liveHtml(s) + '</div>';
    return h + eventsHtml();
  }

  // 점수를 타이핑하는 동안에는 이 부분만 다시 그린다 (입력 칸의 커서를 유지하기 위해)
  function liveHtml(s) {
    var d = draft, r = state.rules, e = roundFromDraft();
    var common = C.commonOf(e, r, s.nagariStreak);
    var pays = d.winner === null ? [] : C.roundPays(e, r, s.nagariStreak, state.n);
    var h = '<div class="card result"><h2>이번 판</h2>';
    if (!common.items.length) h += '<div class="note">점수를 입력하면 금액이 계산됩니다.</div>';
    common.items.forEach(function (it) { h += '<div class="line"><span>' + it.label + '</span><span>' + it.pts + '점</span></div>'; });
    if (common.goAdd) h += '<div class="line"><span>고 점수</span><span>+' + common.goAdd + '점</span></div>';
    common.mults.forEach(function (m) { h += '<div class="line"><span>' + m.label + '</span><span>×' + m.x + '</span></div>'; });

    var total = 0, anyCap = false;
    pays.forEach(function (p) { total += p.amount; anyCap = anyCap || p.capped; });
    if (pays.length === 1) {
      pays[0].tags.forEach(function (t) { h += '<div class="line"><span>' + t + '</span><span>×2</span></div>'; });
      h += '<div class="total"><span>' + pays[0].points + '점 × ' + won(r.pointValue) + '</span><b>' + won(total) + '</b></div>';
    } else if (pays.length) {
      h += '<hr class="sep">';
      pays.forEach(function (p) {
        var tag = p.tags.length ? ' (' + p.tags.join('·') + ')' : '';
        var right = p.coveredBy !== null ? esc(name(p.coveredBy)) + ' 부담' : p.points + '점 · ' + won(p.amount);
        if (p.coveredBy === null && p.gobak && r.gobak) right = '몫 합쳐서 ' + won(p.amount);
        h += '<div class="line"><span>' + esc(name(p.from)) + tag + '</span><span>' + right + '</span></div>';
      });
      h += '<div class="total"><span>' + esc(name(d.winner)) + ' 받는 돈</span><b>' + won(total) + '</b></div>';
    } else {
      h += '<div class="total"><span>' + common.points + '점 × ' + won(r.pointValue) + '</span><b>' + won(common.amount) + '</b></div>';
    }
    if (d.sit !== null && d.sold > 0) h += '<p class="note">광값 ' + won(d.sold * r.gwangValue * r.pointValue) + '은 승자가 ' + esc(name(d.sit)) + '에게 줍니다.</p>';
    if (anyCap) h += '<p class="note">상한 ' + won(r.cap) + '이 적용됐습니다.</p>';

    var block = '';
    if (state.n === 4 && d.sit === null) block = '쉬는 사람을 먼저 골라 주세요.';
    else if (d.winner === null) block = '이긴 사람을 먼저 골라 주세요.';
    else if (!common.canWin) block = '패 점수가 ' + common.base + '점이라 ' + r.goalScore + '점에 못 미칩니다.';
    if (block && common.items.length) h += '<p class="note warn">' + block + '</p>';
    h += '</div>';

    h += '<div class="actions"><button class="primary" id="saveRound"' + (block ? ' disabled' : '') + '>판 저장</button>' +
      '<button class="ghost" id="nagari">나가리</button></div>';
    if (s.nagariStreak) h += '<p class="note">직전 판이 나가리라 이번 판은 ' + Math.pow(2, s.nagariStreak) + '배입니다.</p>';
    return h;
  }

  function eventsHtml() {
    var r = state.rules, h = '';
    var ev = Object.keys(C.EVENT_LABELS).filter(function (k) { return r[k] > 0; });
    if (ev.length) {
      var wait = state.n === 4 && draft.sit === null;
      h += '<div class="card" style="margin-top:12px"><h2>바로 주고받기' + (state.n > 2 ? ' (나머지 사람이 각각 냄)' : '') + '</h2><div class="events">' + ev.map(function (k) {
        return '<button data-event="' + k + '"' + (wait ? ' disabled' : '') + '>' + C.EVENT_LABELS[k] + '<small>' + won(r[k] * r.pointValue) + '</small></button>';
      }).join('') + '</div>' + (wait ? '<p class="note">쉬는 사람을 고르면 누를 수 있습니다.</p>' : '') + '</div>';
    }
    return h;
  }

  function logHtml(s) {
    var tr = C.transfers(s.balances);
    var h = '<div class="card final">' + (tr.length ? tr.map(function (t) {
      return '<div>' + esc(name(t.from)) + ' → ' + esc(name(t.to)) + ' ' + won(t.amount) + '</div>';
    }).join('') : '주고받을 돈이 없습니다') + '</div>';
    h += '<div class="card">';
    if (!s.rows.length) h += '<div class="empty">아직 기록이 없습니다.</div>';
    else {
      h += '<ul class="log">' + s.rows.slice().reverse().map(function (row) {
        var e = row.entry, ttl, det = '', amt = '';
        if (e.type === 'nagari') { ttl = row.roundNo + '판 · 나가리'; }
        else if (e.type === 'event') {
          ttl = C.EVENT_LABELS[e.kind] + ' · ' + esc(name(e.to));
          if (row.from.length > 1) det = row.from.map(function (f) { return esc(name(f)); }).join(', ') + ' 각 ' + won(row.each);
          amt = '+' + won(row.amount);
        } else {
          var c = row.common;
          ttl = row.roundNo + '판 · ' + esc(name(e.winner)) + ' 승';
          var parts = c.items.map(function (it) { return it.label + ' ' + it.pts; })
            .concat(c.goAdd ? ['고 점수 +' + c.goAdd] : [])
            .concat(c.mults.map(function (m) { return m.label + ' ×' + m.x; }));
          det = parts.join(', ') + '<br>' + row.pays.map(function (p) {
            var tag = p.tags.length ? '(' + p.tags.join('·') + ')' : '';
            return esc(name(p.from)) + tag + ' ' + (p.coveredBy !== null ? '0원' : '−' + won(p.amount)) + (p.capped ? ' 상한' : '');
          }).join(', ') + (row.gwangPay ? '<br>광값 ' + won(row.gwangPay) + ' → ' + esc(name(e.sit)) : '');
          amt = '+' + won(row.amount);
        }
        return '<li><div class="body"><div class="ttl">' + ttl + '</div>' + (det ? '<div class="det">' + det + '</div>' : '') +
          '<button class="del" data-del="' + row.index + '">삭제</button></div><div class="amt">' + amt + '</div></li>';
      }).join('') + '</ul>';
    }
    h += '</div><button class="ghost" id="newGame">게임 끝내고 새로 시작</button>';
    return h;
  }

  function render() {
    if (state.step === 'game') renderGame();
    else if (state.step === 'setup') renderSetup();
    else renderCount();
  }

  // ───────── 입력 처리 ─────────
  app.addEventListener('input', function (ev) {
    if (state.step === 'setup' && ev.target.type === 'number') { updateMoneyHints(); return; }
    if (ev.target.id === 'score') {
      var v = parseInt(ev.target.value, 10);
      draft.score = isFinite(v) && v > 0 ? Math.min(v, LIMITS.score) : 0;
      document.getElementById('live').innerHTML = liveHtml(settleNow());
    }
  });
  app.addEventListener('focusin', function (ev) { if (ev.target.id === 'score') ev.target.select(); });

  app.addEventListener('click', function (ev) {
    var t = ev.target.closest('button');
    if (!t || t.disabled) return;
    var ds = t.dataset;

    if (ds.count) { pickCount(+ds.count); return; }
    if (t.id === 'backCount') { readSetup(); state.step = 'count'; save(); render(); return; }
    if (t.id === 'start') {
      readSetup(); state.step = 'game'; draft = newDraft(); tab = 'input';
      save(); render(); window.scrollTo(0, 0); return;
    }
    if (ds.tab) { tab = ds.tab; render(); return; }
    if (ds.mode) {
      var keep = { winner: draft.winner, sit: draft.sit, sold: draft.sold };
      state.inputMode = ds.mode; draft = Object.assign(newDraft(), keep); save(); render(); return;
    }
    if (ds.sit !== undefined) {
      draft.sit = +ds.sit;
      if (draft.winner === draft.sit) draft.winner = null;
      normalize(draft); render(); return;
    }
    if (ds.winner !== undefined) { draft.winner = +ds.winner; normalize(draft); render(); return; }
    if (ds.step) {
      var k = ds.step;
      draft[k] = Math.max(0, Math.min(LIMITS[k], draft[k] + (+ds.d)));
      normalize(draft); render(); return;
    }
    if (ds.chip) { draft[ds.chip] = !draft[ds.chip]; normalize(draft); render(); return; }
    if (ds.lchip) {
      var p = ds.lchip.split(':'), li = +p[0], key = p[1];
      var f = draft.losers[li] || (draft.losers[li] = {});
      f[key] = !f[key];
      // 고박은 한 판에 한 명만
      if (key === 'gobak' && f[key]) Object.keys(draft.losers).forEach(function (o) { if (+o !== li) draft.losers[o].gobak = false; });
      normalize(draft); render(); return;
    }

    if (t.id === 'saveRound') {
      state.log.push(Object.assign({ type: 'round' }, roundFromDraft()));
      draft = newDraft(); save(); render(); window.scrollTo(0, 0); return;
    }
    if (t.id === 'nagari') {
      choose('나가리로 기록할까요?', state.rules.nagariDouble ? '다음 판이 2배가 됩니다.' : '', [{ label: '나가리 기록', value: true, primary: true }]).then(function (ok) {
        if (!ok) return;
        state.log.push({ type: 'nagari' }); draft = newDraft(); save(); render();
      });
      return;
    }
    if (ds.event) {
      var kind = ds.event, amt = state.rules[kind] * state.rules.pointValue;
      var active = [];
      for (var a = 0; a < state.n; a++) if (a !== draft.sit) active.push(a);
      choose(C.EVENT_LABELS[kind] + ' ' + won(amt), state.n > 2 ? '누가 받나요? 나머지 사람이 각각 냅니다.' : '누가 받나요?',
        active.map(function (i) { return { label: name(i) + ' 받음', value: i, primary: true }; })).then(function (to) {
        if (to === null) return;
        state.log.push({ type: 'event', kind: kind, to: to, from: active.filter(function (x) { return x !== to; }) });
        save(); render();
      });
      return;
    }
    if (ds.del !== undefined) {
      var idx = +ds.del;
      choose('이 기록을 삭제할까요?', '삭제하면 누적 금액이 다시 계산됩니다.', [{ label: '삭제', value: true, primary: true }]).then(function (ok) {
        if (!ok) return;
        state.log.splice(idx, 1); save(); render();
      });
      return;
    }
    if (t.id === 'newGame') {
      choose('게임을 끝낼까요?', '지금까지의 판 기록이 지워집니다. 이름과 룰 설정은 남습니다.', [{ label: '끝내고 새로 시작', value: true, primary: true }]).then(function (ok) {
        if (!ok) return;
        state.log = []; state.step = 'count'; draft = newDraft(); save(); render(); window.scrollTo(0, 0);
      });
    }
  });

  render();
})();

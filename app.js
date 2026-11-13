// 용도: 맞고 계산기 화면 동작과 저장 (계산은 calc.js가 담당)
// 사용법: index.html이 불러온다. 기록은 이 기기 브라우저의 localStorage에 저장된다.
(function () {
  'use strict';
  var C = window.GoStopCalc;
  var KEY = 'gostop-calc-v1';
  var app = document.getElementById('app');
  var dlg = document.getElementById('dlg');

  var state = load() || { started: false, names: ['', ''], rules: clone(C.DEFAULT_RULES), log: [] };
  state.rules = Object.assign(clone(C.DEFAULT_RULES), state.rules);
  if (state.inputMode !== 'cards') state.inputMode = 'direct'; // 기본은 점수 바로 입력
  var draft = newDraft();
  var tab = 'input';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장이 막힌 환경에서도 계산은 계속된다 */ }
  }
  function newDraft() {
    return { winner: null, score: 0, meong: false, gwang: 0, bigwang: false, yeol: 0, godori: false, tti: 0, hongdan: false, cheongdan: false, chodan: false, pi: 0, go: 0, shake: 0, pibak: false, gwangbak: false, gobak: false };
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function won(n) { return Math.abs(n).toLocaleString('ko-KR') + '원'; }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + won(n); }
  function cls(n) { return n > 0 ? 'plus' : n < 0 ? 'minus' : ''; }
  function name(i) { return state.names[i] || (i === 0 ? '나' : '상대'); }

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

  // ───────── 설정 화면 ─────────
  var RULE_FIELDS = [
    ['goalScore', '몇 점에 나기', '맞고는 보통 7점'],
    ['ppuk1', '첫뻑', '몇 점 값으로 받을지'],
    ['ppuk2', '연뻑', ''],
    ['ppuk3', '삼연뻑', ''],
    ['ttadak', '첫따닥', '안 치면 0'],
    ['chongtong', '총통', '안 치면 0'],
    ['pibakLimit', '피박 기준 (피 몇 장 이하)', '보통 7장, 6장으로 하기도 함']
  ];
  var RULE_TOGGLES = [
    ['meongtta', '멍따', '열끗 7장 이상이면 2배'],
    ['gobak', '고박', '고 부르고 지면 2배'],
    ['nagariDouble', '나가리 다음 판 2배', ''],
    ['bigwang2', '비광 포함 삼광은 2점', '']
  ];

  function renderSetup() {
    var r = state.rules;
    app.innerHTML =
      '<h1>맞고 계산기</h1>' +
      '<div class="card"><h2>치는 사람</h2><div class="two">' +
        '<input type="text" id="n0" maxlength="8" placeholder="나" value="' + esc(state.names[0]) + '">' +
        '<input type="text" id="n1" maxlength="8" placeholder="상대" value="' + esc(state.names[1]) + '">' +
      '</div></div>' +
      '<div class="card"><h2>점당 얼마</h2>' +
        '<label class="field"><span>점당 금액 (원)</span><input type="number" id="r_pointValue" inputmode="numeric" min="0" step="10" value="' + r.pointValue + '"></label>' +
        '<label class="field"><span>판당 상한 금액 (원)<small>0이면 상한 없음</small></span><input type="number" id="r_cap" inputmode="numeric" min="0" step="100" value="' + r.cap + '"></label>' +
      '</div>' +
      '<div class="card"><details><summary>룰 설정 (첫뻑, 피박 기준 등)</summary>' +
        RULE_FIELDS.map(function (f) {
          var money = f[0].indexOf('ppuk') === 0 || f[0] === 'ttadak' || f[0] === 'chongtong';
          return '<label class="field"><span>' + f[1] + (money ? ' (점)' : '') +
            '<small>' + (money ? '<span data-money="' + f[0] + '"></span>' : '') + (f[2] ? (money ? ' · ' : '') + f[2] : '') + '</small></span>' +
            '<input type="number" id="r_' + f[0] + '" inputmode="numeric" min="0" value="' + r[f[0]] + '"></label>';
        }).join('') +
        RULE_TOGGLES.map(function (f) {
          return '<label class="field"><span>' + f[1] + (f[2] ? '<small>' + f[2] + '</small>' : '') + '</span>' +
            '<input type="checkbox" id="r_' + f[0] + '"' + (r[f[0]] ? ' checked' : '') + '></label>';
        }).join('') +
      '</details></div>' +
      '<button class="primary" id="start">게임 시작</button>' +
      '<p class="note">기록은 이 폰에만 저장됩니다. 브라우저의 사이트 데이터를 지우면 함께 사라집니다.</p>';
    updateMoneyHints();
  }

  function num(id, fallback) {
    var v = parseInt(document.getElementById(id).value, 10);
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
    state.names = [document.getElementById('n0').value.trim(), document.getElementById('n1').value.trim()];
    r.pointValue = num('r_pointValue', d.pointValue);
    r.cap = num('r_cap', 0);
    RULE_FIELDS.forEach(function (f) { r[f[0]] = num('r_' + f[0], d[f[0]]); });
    RULE_TOGGLES.forEach(function (f) { r[f[0]] = document.getElementById('r_' + f[0]).checked; });
  }

  // ───────── 게임 화면 ─────────
  function normalize(d) {
    if (state.inputMode === 'direct') return;
    if (d.gwang !== 3) d.bigwang = false;
    if (d.gwang < 3) d.gwangbak = false;
    if (d.yeol < 3) d.godori = false; // 고도리는 열끗 3장이 필요하다
    if (d.pi < 10) d.pibak = false;
    var dans = ['chodan', 'cheongdan', 'hongdan'];
    var on = dans.filter(function (k) { return d[k]; });
    while (on.length * 3 > d.tti) { d[on.shift()] = false; }
  }
  function stepper(key, label, extra) {
    return '<div class="row"><span class="lbl">' + label + '</span><div class="step">' +
      '<button data-step="' + key + '" data-d="-1" aria-label="' + label + ' 줄이기">−</button><b>' + draft[key] + '</b>' +
      '<button data-step="' + key + '" data-d="1" aria-label="' + label + ' 늘리기">+</button>' + (extra || '') + '</div></div>';
  }
  function chip(key, label, disabled) {
    return '<button class="chip' + (draft[key] ? ' on' : '') + '" data-chip="' + key + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  }
  var LIMITS = { score: 999, gwang: 5, yeol: 9, tti: 10, pi: 40, go: 9, shake: 4 };

  function rulesLine() {
    var r = state.rules, parts = ['점 ' + r.pointValue.toLocaleString('ko-KR'), r.goalScore + '점 나기'];
    if (r.ppuk1) parts.push('첫뻑 ' + won(r.ppuk1 * r.pointValue));
    parts.push('피박 ' + r.pibakLimit + '장');
    parts.push(r.cap ? '상한 ' + won(r.cap) : '상한 없음');
    return parts.join(' · ');
  }

  function renderGame() {
    var s = C.settle(state.log, state.rules);
    var rounds = s.rows.filter(function (x) { return x.roundNo; }).length;
    var html =
      '<div class="board">' + [0, 1].map(function (i) {
        return '<div class="who"><div class="name">' + esc(name(i)) + '</div><div class="bal ' + cls(s.balances[i]) + '">' + signed(s.balances[i]) + '</div></div>';
      }).join('') + '</div>' +
      '<p class="rules">' + esc(rulesLine()) + '</p>' +
      '<div class="tabs"><button data-tab="input" class="' + (tab === 'input' ? 'on' : '') + '">판 입력</button>' +
      '<button data-tab="log" class="' + (tab === 'log' ? 'on' : '') + '">기록 (' + rounds + '판)</button></div>';
    html += tab === 'input' ? inputHtml(s) : logHtml(s);
    app.innerHTML = html;
  }

  function roundFromDraft() { return Object.assign({ direct: state.inputMode === 'direct' }, draft); }

  function inputHtml(s) {
    var d = draft, r = state.rules, direct = state.inputMode === 'direct';
    var loser = d.winner === null ? '패자' : name(1 - d.winner);
    var danCount = [d.hongdan, d.cheongdan, d.chodan].filter(Boolean).length;
    var danFull = (danCount + 1) * 3 > d.tti;
    var piPts = d.pi >= 10, gwangPts = d.gwang >= 3;

    var h = '<div class="card"><h2>이긴 사람</h2><div class="seg">' + [0, 1].map(function (i) {
      return '<button data-winner="' + i + '" class="' + (d.winner === i ? 'on' : '') + '">' + esc(name(i)) + '</button>';
    }).join('') + '</div></div>';

    if (direct) h += '<div class="card"><h2>점수</h2>' +
      '<div class="row"><span class="lbl">패 점수<small>고 점수 제외</small></span><div class="step">' +
      '<button data-step="score" data-d="-1" aria-label="점수 줄이기">−</button>' +
      '<input id="score" type="number" inputmode="numeric" min="0" max="999" placeholder="0" value="' + (d.score || '') + '">' +
      '<button data-step="score" data-d="1" aria-label="점수 늘리기">+</button></div></div>' +
      stepper('go', '고') + stepper('shake', '흔들기·폭탄') +
      '<button class="del" data-mode="cards">패 장수로 계산하기</button></div>';

    if (!direct) h += '<div class="card"><h2>이긴 사람이 먹은 패</h2>' +
      stepper('gwang', '광') +
      (d.gwang === 3 ? '<div class="chips">' + chip('bigwang', '비광 포함') + '</div>' : '') +
      '<hr class="sep">' + stepper('yeol', '열끗') +
      '<div class="chips">' + chip('godori', '고도리', d.yeol < 3) + '</div>' +
      '<hr class="sep">' + stepper('tti', '띠') +
      '<div class="chips">' + chip('hongdan', '홍단', !d.hongdan && danFull) + chip('cheongdan', '청단', !d.cheongdan && danFull) + chip('chodan', '초단', !d.chodan && danFull) + '</div>' +
      '<hr class="sep">' + stepper('pi', '피', '<button class="five" data-step="pi" data-d="5">+5</button>') +
      '<p class="note">쌍피는 2장으로 세어 합계를 넣습니다.</p></div>';

    if (!direct) h += '<div class="card"><h2>고 · 흔들기</h2>' + stepper('go', '고') + stepper('shake', '흔들기·폭탄') +
      '<button class="del" data-mode="direct">점수 바로 입력하기</button></div>';

    h += '<div class="card"><h2>' + esc(loser) + ' 박 체크</h2><div class="chips">' +
      chip('pibak', '피박', !direct && !piPts) +
      chip('gwangbak', '광박', !direct && !gwangPts) +
      (direct && r.meongtta ? chip('meong', '멍박') : '') +
      (r.gobak ? chip('gobak', '고박') : '') + '</div>' +
      '<p class="note">피박은 피 ' + r.pibakLimit + '장 이하, 광박은 광 0장' + (r.meongtta ? ', 멍박은 승자 열끗 7장 이상' : '') + '일 때입니다.</p></div>';

    h += '<div id="live">' + liveHtml(s) + '</div>';
    return h + eventsHtml();
  }

  // 점수를 타이핑하는 동안에는 이 부분만 다시 그린다 (입력 칸의 커서를 유지하기 위해)
  function liveHtml(s) {
    var d = draft, r = state.rules;
    var res = C.scoreRound(roundFromDraft(), r, s.nagariStreak);
    var h = '<div class="card result"><h2>이번 판</h2>';
    if (!res.items.length) h += '<div class="note">점수를 입력하면 금액이 계산됩니다.</div>';
    res.items.forEach(function (it) { h += '<div class="line"><span>' + it.label + '</span><span>' + it.pts + '점</span></div>'; });
    if (res.goAdd) h += '<div class="line"><span>고 점수</span><span>+' + res.goAdd + '점</span></div>';
    res.mults.forEach(function (m) { h += '<div class="line"><span>' + m.label + '</span><span>×' + m.x + '</span></div>'; });
    h += '<div class="total"><span>' + res.points + '점 × ' + won(r.pointValue) + '</span><b>' + won(res.amount) + '</b></div>';
    if (res.capped) h += '<p class="note">상한 ' + won(r.cap) + '이 적용됐습니다.</p>';
    var block = '';
    if (d.winner === null) block = '이긴 사람을 먼저 골라 주세요.';
    else if (!res.canWin) block = '기본 점수가 ' + res.base + '점이라 ' + r.goalScore + '점에 못 미칩니다.';
    if (block && res.items.length) h += '<p class="note warn">' + block + '</p>';
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
      h += '<div class="card" style="margin-top:12px"><h2>바로 주고받기</h2><div class="events">' + ev.map(function (k) {
        return '<button data-event="' + k + '">' + C.EVENT_LABELS[k] + '<small>' + won(r[k] * r.pointValue) + '</small></button>';
      }).join('') + '</div></div>';
    }
    return h;
  }

  function logHtml(s) {
    var b = s.balances[0];
    var h = '<div class="card final">' + (b === 0 ? '주고받을 돈이 없습니다' :
      esc(name(b > 0 ? 1 : 0)) + ' → ' + esc(name(b > 0 ? 0 : 1)) + ' ' + won(b)) + '</div>';
    h += '<div class="card">';
    if (!s.rows.length) h += '<div class="empty">아직 기록이 없습니다.</div>';
    else {
      h += '<ul class="log">' + s.rows.slice().reverse().map(function (row) {
        var e = row.entry, ttl, det = '', amt = '';
        if (e.type === 'nagari') { ttl = row.roundNo + '판 · 나가리'; }
        else if (e.type === 'event') {
          ttl = C.EVENT_LABELS[e.kind] + ' · ' + esc(name(e.to));
          amt = esc(name(e.to)) + ' +' + won(row.amount);
        } else {
          var res = row.result;
          ttl = row.roundNo + '판 · ' + esc(name(e.winner)) + ' 승 · ' + res.points + '점';
          det = res.items.map(function (it) { return it.label + ' ' + it.pts; })
            .concat(res.goAdd ? ['고 점수 +' + res.goAdd] : [])
            .concat(res.mults.map(function (m) { return m.label + ' ×' + m.x; }))
            .concat(res.capped ? ['상한 적용'] : []).join(', ');
          amt = '+' + won(row.amount);
        }
        return '<li><div class="body"><div class="ttl">' + ttl + '</div>' + (det ? '<div class="det">' + det + '</div>' : '') +
          '<button class="del" data-del="' + row.index + '">삭제</button></div><div class="amt">' + amt + '</div></li>';
      }).join('') + '</ul>';
    }
    h += '</div><button class="ghost" id="newGame">게임 끝내고 새로 시작</button>';
    return h;
  }

  function render() { if (state.started) renderGame(); else renderSetup(); }

  // ───────── 입력 처리 ─────────
  app.addEventListener('input', function (ev) {
    if (!state.started && ev.target.type === 'number') { updateMoneyHints(); return; }
    if (ev.target.id === 'score') {
      var v = parseInt(ev.target.value, 10);
      draft.score = isFinite(v) && v > 0 ? Math.min(v, LIMITS.score) : 0;
      document.getElementById('live').innerHTML = liveHtml(C.settle(state.log, state.rules));
    }
  });
  app.addEventListener('focusin', function (ev) { if (ev.target.id === 'score') ev.target.select(); });

  app.addEventListener('click', function (ev) {
    var t = ev.target.closest('button');
    if (!t || t.disabled) return;
    var ds = t.dataset;

    if (t.id === 'start') {
      readSetup(); state.started = true; draft = newDraft(); tab = 'input';
      save(); render(); window.scrollTo(0, 0); return;
    }
    if (ds.tab) { tab = ds.tab; render(); return; }
    if (ds.mode) {
      var w = draft.winner;
      state.inputMode = ds.mode; draft = newDraft(); draft.winner = w; save(); render(); return;
    }
    if (ds.winner !== undefined) { draft.winner = +ds.winner; render(); return; }
    if (ds.step) {
      var k = ds.step;
      draft[k] = Math.max(0, Math.min(LIMITS[k], draft[k] + (+ds.d)));
      normalize(draft); render(); return;
    }
    if (ds.chip) { draft[ds.chip] = !draft[ds.chip]; normalize(draft); render(); return; }

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
      choose(C.EVENT_LABELS[kind] + ' ' + won(amt), '누가 받나요?', [0, 1].map(function (i) { return { label: name(i) + ' 받음', value: i, primary: true }; })).then(function (to) {
        if (to === null) return;
        state.log.push({ type: 'event', kind: kind, to: to }); save(); render();
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
        state.log = []; state.started = false; draft = newDraft(); save(); render(); window.scrollTo(0, 0);
      });
    }
  });

  render();
})();

/* 五子棋界面：Canvas 渲染、交互、人机/双人模式 */
(function () {
  'use strict';

  const { GomokuGame, EMPTY, BLACK, WHITE } = window.GomokuGame;
  let BOARD_SIZE = window.GomokuGame.BOARD_SIZE;
  const { getBestMove } = window.GomokuAI;
  const { GoGame } = window.GoGame;
  const { getGoMove } = window.GoAI;

  // ---------- 画布 ----------
  const canvas = document.getElementById('boardCanvas');
  const ctx = canvas.getContext('2d');

  let CELL = 42;
  let PAD = 30;
  let SIZE = PAD * 2 + CELL * (BOARD_SIZE - 1);

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ---------- 木纹背景（一次性离屏绘制） ----------
  const bgCanvas = document.createElement('canvas');
  function renderBackground() {
    canvas.width = Math.round(SIZE * DPR);
    canvas.height = Math.round(SIZE * DPR);
    canvas.style.maxWidth = SIZE + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    bgCanvas.width = SIZE;
    bgCanvas.height = SIZE;
    const b = bgCanvas.getContext('2d');
    const g = b.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, '#e9c184');
    g.addColorStop(0.5, '#dcaa62');
    g.addColorStop(1, '#c8903f');
    b.fillStyle = g;
    b.fillRect(0, 0, SIZE, SIZE);
    for (let y = 6; y < SIZE; y += 7) {
      b.beginPath();
      b.moveTo(0, y);
      for (let x = 0; x <= SIZE; x += 8) {
        b.lineTo(x, y + Math.sin(x * 0.03 + y * 0.012) * 2.5 + (Math.random() * 2 - 1));
      }
      b.strokeStyle = 'rgba(' + (105 + Math.floor(Math.random() * 18)) + ', 70, 28, 0.07)';
      b.lineWidth = 1;
      b.stroke();
    }
    const vg = b.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.16)');
    b.fillStyle = vg;
    b.fillRect(0, 0, SIZE, SIZE);
  }
  renderBackground();

  // ---------- 页面元素 ----------
  const turnStone = document.getElementById('turnStone');
  const turnText = document.getElementById('turnText');
  const messageEl = document.getElementById('message');
  const blackWinsEl = document.getElementById('blackWins');
  const whiteWinsEl = document.getElementById('whiteWins');
  const drawsEl = document.getElementById('draws');
  const undoBtn = document.getElementById('undoBtn');
  const restartBtn = document.getElementById('restartBtn');
  const modeAI = document.getElementById('modeAI');
  const modePVP = document.getElementById('modePVP');
  const pickBlack = document.getElementById('pickBlack');
  const pickWhite = document.getElementById('pickWhite');
  const colorPick = document.getElementById('colorPick');
  const soundToggle = document.getElementById('soundToggle');
  const typeGomoku = document.getElementById('typeGomoku');
  const typeGo = document.getElementById('typeGo');
  const gomokuSection = document.getElementById('gomokuSection');
  const goSection = document.getElementById('goSection');
  const goModeAI = document.getElementById('goModeAI');
  const goModePVP = document.getElementById('goModePVP');
  const goPickBlack = document.getElementById('goPickBlack');
  const goPickWhite = document.getElementById('goPickWhite');
  const goColorPick = document.getElementById('goColorPick');
  const gomokuScores = document.getElementById('gomokuScores');
  const goCapturesEl = document.getElementById('goCaptures');
  const goBlackCapturesEl = document.getElementById('goBlackCaptures');
  const goWhiteCapturesEl = document.getElementById('goWhiteCaptures');
  const passBtn = document.getElementById('passBtn');
  const resignBtn = document.getElementById('resignBtn');

  // ---------- 状态 ----------
  let gameType = 'gomoku';  // 'gomoku' | 'go'
  let mode = 'ai';          // 'ai' | 'pvp'
  let humanColor = BLACK;   // 玩家执黑/执白
  let game = new GomokuGame();
  let thinking = false;     // 电脑是否在思考
  let hover = null;         // 悬停预览位置
  let soundOn = true;
  let wins = {};
  wins[BLACK] = 0;
  wins[WHITE] = 0;
  wins.draw = 0;
  let aiTimer = null;

  // ---------- 棋子颜色系统 ----------
  const PRESET_COLORS = ['#1a1a1a', '#f5f5f5', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];
  const DEFAULT_COLORS = { 1: '#1a1a1a', 2: '#f5f5f5' };
  let stoneColors = loadStoneColors();

  function loadStoneColors() {
    try {
      const saved = localStorage.getItem('gomoku_stone_colors');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { 1: parsed[1] || DEFAULT_COLORS[1], 2: parsed[2] || DEFAULT_COLORS[2] };
      }
    } catch (e) {}
    return Object.assign({}, DEFAULT_COLORS);
  }

  function saveStoneColors() {
    try { localStorage.setItem('gomoku_stone_colors', JSON.stringify(stoneColors)); } catch (e) {}
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b]
      .map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); })
      .join('');
  }

  function lighten(hex, amount) {
    const rgb = hexToRgb(hex);
    return rgbToHex({
      r: rgb.r + (255 - rgb.r) * amount,
      g: rgb.g + (255 - rgb.g) * amount,
      b: rgb.b + (255 - rgb.b) * amount
    });
  }

  function darken(hex, amount) {
    const rgb = hexToRgb(hex);
    return rgbToHex({ r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) });
  }

  function stoneGradient(hex) {
    return { light: lighten(hex, 0.35), mid: hex, dark: darken(hex, 0.35) };
  }

  function isLightColor(hex) {
    const rgb = hexToRgb(hex);
    return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) > 160;
  }

  function applyStoneStyle(el, player) {
    const hex = stoneColors[player];
    const grad = stoneGradient(hex);
    el.style.background = 'radial-gradient(circle at 32% 30%, ' + grad.light + ', ' + grad.dark + ' 75%)';
    if (isLightColor(hex)) {
      el.style.border = '1px solid rgba(0,0,0,0.2)';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
    } else {
      el.style.border = 'none';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
    }
  }

  function initColorPickers() {
    const groupBlack = document.getElementById('swatchGroupBlack');
    const groupWhite = document.getElementById('swatchGroupWhite');
    const customBlack = document.getElementById('customColorBlack');
    const customWhite = document.getElementById('customColorWhite');

    [groupBlack, groupWhite].forEach(function (group, idx) {
      const player = idx === 0 ? 1 : 2;
      PRESET_COLORS.forEach(function (hex) {
        const btn = document.createElement('button');
        btn.className = 'swatch';
        btn.style.background = hex;
        btn.setAttribute('data-color', hex);
        btn.setAttribute('data-player', player);
        btn.title = hex;
        group.appendChild(btn);
      });
    });

    groupBlack.addEventListener('click', function (e) {
      if (e.target.classList.contains('swatch')) setStoneColor(1, e.target.getAttribute('data-color'));
    });
    groupWhite.addEventListener('click', function (e) {
      if (e.target.classList.contains('swatch')) setStoneColor(2, e.target.getAttribute('data-color'));
    });
    customBlack.addEventListener('input', function () { setStoneColor(1, this.value); });
    customWhite.addEventListener('input', function () { setStoneColor(2, this.value); });

    refreshSwatchActive();
  }

  function setStoneColor(player, hex) {
    stoneColors[player] = hex;
    saveStoneColors();
    refreshSwatchActive();
    draw();
    updateStatus();
  }

  function refreshSwatchActive() {
    document.querySelectorAll('.swatch').forEach(function (btn) {
      const player = parseInt(btn.getAttribute('data-player'));
      btn.classList.toggle('active', btn.getAttribute('data-color') === stoneColors[player]);
    });
    document.getElementById('customColorBlack').value = stoneColors[1];
    document.getElementById('customColorWhite').value = stoneColors[2];
    applyStoneStyle(document.getElementById('scoreDotBlack'), 1);
    applyStoneStyle(document.getElementById('scoreDotWhite'), 2);
  }

  // ---------- 音频 ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function tone(freq, start, dur, vol, type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t0 = audioCtx.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
  function playSound(kind) {
    if (!soundOn) return;
    ensureAudio();
    if (!audioCtx) return;
    if (kind === 'place') {
      tone(420, 0, 0.12, 0.22, 'triangle');
    } else if (kind === 'win') {
      tone(523.25, 0, 0.18, 0.18, 'sine');
      tone(659.25, 0.15, 0.18, 0.18, 'sine');
      tone(783.99, 0.3, 0.35, 0.18, 'sine');
    } else if (kind === 'error') {
      tone(160, 0, 0.15, 0.15, 'square');
    }
  }

  // ---------- 绘制 ----------
  function getStarPositions(n) {
    const center = Math.floor(n / 2);
    if (n < 13) return [[center, center]];
    const edge = 3;
    const far = n - 1 - edge;
    return [[edge, edge], [edge, far], [far, edge], [far, far], [center, center]];
  }

  function draw() {
    ctx.drawImage(bgCanvas, 0, 0);

    // 网格线
    ctx.strokeStyle = 'rgba(74, 47, 20, 0.75)';
    ctx.lineWidth = 1;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const p = PAD + i * CELL;
      ctx.beginPath();
      ctx.moveTo(PAD, p);
      ctx.lineTo(SIZE - PAD, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, PAD);
      ctx.lineTo(p, SIZE - PAD);
      ctx.stroke();
    }

    // 星位
    ctx.fillStyle = 'rgba(74, 47, 20, 0.9)';
    const stars = getStarPositions(BOARD_SIZE);
    for (const [r, c] of stars) {
      ctx.beginPath();
      ctx.arc(PAD + c * CELL, PAD + r * CELL, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 棋子
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const v = game.board[r][c];
        if (v !== EMPTY) drawStone(r, c, v);
      }
    }

    // 最后一手标记
    if (game.lastMove) {
      drawMark(game.lastMove.row, game.lastMove.col, 'rgba(220, 60, 60, 0.95)');
    }

    // 悬停预览
    if (hover && game.winner === null && !thinking) {
      if (game.board[hover.row][hover.col] === EMPTY) {
        const color = mode === 'ai' ? humanColor : game.currentPlayer;
        drawStone(hover.row, hover.col, color, 0.45);
      }
    }

    // 围棋终局领地标示
    if (gameType === 'go' && game.gameOver && game.scoreResult) {
      for (const p of game.scoreResult.territoryMap) {
        const x = PAD + p.col * CELL;
        const y = PAD + p.row * CELL;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.owner === BLACK ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // 获胜连线
    if (game.winningLine) {
      const line = game.winningLine.line;
      ctx.strokeStyle = 'rgba(235, 76, 76, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      line.forEach(function (p, i) {
        const x = PAD + p.col * CELL;
        const y = PAD + p.row * CELL;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      for (const p of line) drawRing(p.row, p.col, '#eb4c4c');
    }
  }

  function drawStone(r, c, color, alpha) {
    if (alpha === undefined) alpha = 1;
    const x = PAD + c * CELL;
    const y = PAD + r * CELL;
    const radius = CELL * 0.44;
    ctx.save();
    ctx.globalAlpha = alpha;
    const hex = stoneColors[color] || DEFAULT_COLORS[color];
    const g = stoneGradient(hex);
    const grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.15, x, y, radius);
    grad.addColorStop(0, g.light);
    grad.addColorStop(0.4, g.mid);
    grad.addColorStop(1, g.dark);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = isLightColor(hex) ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawMark(r, c, color) {
    const x = PAD + c * CELL;
    const y = PAD + r * CELL;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawRing(r, c, color) {
    const x = PAD + c * CELL;
    const y = PAD + r * CELL;
    ctx.beginPath();
    ctx.arc(x, y, CELL * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // ---------- 交互 ----------
  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (SIZE / rect.width);
    const y = (e.clientY - rect.top) * (SIZE / rect.height);
    const col = Math.round((x - PAD) / CELL);
    const row = Math.round((y - PAD) / CELL);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    if (Math.abs(x - (PAD + col * CELL)) > CELL / 2) return null;
    if (Math.abs(y - (PAD + row * CELL)) > CELL / 2) return null;
    return { row, col };
  }

  canvas.addEventListener('click', function (e) {
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (game.winner !== null || thinking) return;
    if (mode === 'ai' && game.currentPlayer !== humanColor) return;
    if (game.board[cell.row][cell.col] !== EMPTY) {
      playSound('error');
      return;
    }
    humanMove(cell.row, cell.col);
  });

  canvas.addEventListener('mousemove', function (e) {
    const cell = cellFromEvent(e);
    if ((hover && cell && hover.row === cell.row && hover.col === cell.col) || (!hover && !cell)) return;
    hover = cell;
    draw();
  });

  canvas.addEventListener('mouseleave', function () {
    if (hover) {
      hover = null;
      draw();
    }
  });

  // ---------- 游戏流程 ----------
  function humanMove(row, col) {
    const move = game.place(row, col);
    if (!move) return;
    playSound('place');
    updateStatus();
    draw();
    if (game.winner !== null) {
      onGameOver();
      return;
    }
    if (mode === 'ai') scheduleAI();
  }

  function scheduleAI() {
    thinking = true;
    updateStatus();
    aiTimer = setTimeout(aiMove, 320);
  }

  function aiMove() {
    thinking = false;
    aiTimer = null;
    if (game.winner !== null) return;
    const aiPlayer = game.currentPlayer;

    if (gameType === 'go') {
      const mv = getGoMove(game);
      if (mv.pass) {
        game.pass();
      } else {
        game.place(mv.row, mv.col);
      }
    } else {
      const best = getBestMove(game.board, aiPlayer, humanColor);
      game.place(best.row, best.col);
    }

    playSound('place');
    updateStatus();
    draw();
    if (game.winner !== null) onGameOver();
  }

  function onGameOver() {
    playSound('win');
    if (game.winner === BLACK) wins[BLACK]++;
    else if (game.winner === WHITE) wins[WHITE]++;
    else wins.draw++;
    updateWins();
    updateStatus();
  }

  function startGame() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    game = gameType === 'go' ? new GoGame(BOARD_SIZE) : new GomokuGame();
    thinking = false;
    hover = null;
    updateWins();
    updateStatus();
    draw();
    if (mode === 'ai' && game.currentPlayer !== humanColor) scheduleAI();
  }

  function undoMove() {
    if (!canUndo()) return;
    if (gameType === 'go') {
      game.undo();
      if (mode === 'ai' && game.currentPlayer !== humanColor && game.moves.length > 0) {
        game.undo();
      }
    } else if (mode === 'pvp') {
      game.undo(1);
    } else {
      game.undo(1);
      if (game.currentPlayer !== humanColor && game.moves.length > 0) {
        game.undo(1);
      }
    }
    playSound('place');
    updateStatus();
    draw();
    if (mode === 'ai' && game.currentPlayer !== humanColor && game.winner === null) {
      scheduleAI();
    }
  }

  function canUndo() {
    if (thinking || game.winner !== null || game.moves.length === 0) return false;
    if (mode === 'ai') return game.currentPlayer === humanColor;
    return true;
  }

  // ---------- 状态与界面 ----------
  function updateWins() {
    if (gameType === 'go') {
      goBlackCapturesEl.textContent = game.captures[BLACK];
      goWhiteCapturesEl.textContent = game.captures[WHITE];
    } else {
      blackWinsEl.textContent = wins[BLACK];
      whiteWinsEl.textContent = wins[WHITE];
      drawsEl.textContent = wins.draw;
    }
  }

  function updateStatus() {
    const stone = turnStone;
    let text = '';
    let msg = '';

    if (game.winner !== null) {
      if (game.winner === 0) {
        stone.className = 'stone stone-empty';
        text = '平局';
        msg = gameType === 'go' ? '双方虚着，数子结果不分胜负' : '棋盘已满，双方不分胜负';
      } else {
        if (gameType === 'go' && game.scoreResult) {
          const s = game.scoreResult;
          msg = '数子结果：黑 ' + s.black + ' 子 vs 白 ' + s.white + ' 子（含贴目 ' + s.komi + '）';
        }
        const colorName = game.winner === BLACK ? '先手方' : '后手方';
        stone.className = 'stone'; applyStoneStyle(stone, game.winner);
        if (mode === 'ai') {
          const humanWon = game.winner === humanColor;
          text = humanWon ? '🎉 你赢了！' : '🤖 电脑获胜';
          msg = humanWon ? '恭喜！你执' + colorName + '率先连成五子' : '电脑执' + colorName + '率先连成五子，再来一局？';
        } else {
          text = '🎉 ' + colorName + '获胜！';
          msg = colorName + '率先连成五子，恭喜！';
        }
      }
    } else {
      const isHumanTurn = mode !== 'ai' || game.currentPlayer === humanColor;
      const colorName = game.currentPlayer === BLACK ? '先手方' : '后手方';
      stone.className = 'stone'; applyStoneStyle(stone, game.currentPlayer);
      stone.classList.toggle('thinking', !isHumanTurn);
      if (mode === 'ai') {
        text = isHumanTurn ? '你的回合' : '电脑思考中…';
        msg = isHumanTurn
          ? '请点击棋盘落子'
          : '请稍候，电脑正在计算…';
      } else {
        text = colorName + '回合';
        msg = '请' + colorName + '落子';
      }
    }

    turnText.textContent = text;
    messageEl.textContent = msg;
    undoBtn.disabled = !canUndo();
  }

  // ---------- 控件绑定 ----------
  function setMode(m) {
    mode = m;
    modeAI.classList.toggle('active', m === 'ai');
    modePVP.classList.toggle('active', m === 'pvp');
    colorPick.style.display = m === 'ai' ? '' : 'none';
    startGame();
  }

  function setHumanColor(color) {
    humanColor = color;
    pickBlack.classList.toggle('active', color === BLACK);
    pickWhite.classList.toggle('active', color === WHITE);
    startGame();
  }

  modeAI.addEventListener('click', function () { setMode('ai'); });
  modePVP.addEventListener('click', function () { setMode('pvp'); });
  pickBlack.addEventListener('click', function () { setHumanColor(BLACK); });
  pickWhite.addEventListener('click', function () { setHumanColor(WHITE); });
  restartBtn.addEventListener('click', startGame);
  undoBtn.addEventListener('click', undoMove);

  // ---------- 棋盘尺寸 ----------
  const sizeButtons = document.querySelectorAll('.size-btn');

  function initBoardSize() {
    let saved = parseInt(localStorage.getItem('gomoku_board_size'), 10);
    if (!saved || [9, 13, 15, 19].indexOf(saved) === -1) saved = 15;
    applyBoardSize(saved, false);
    sizeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        changeBoardSize(parseInt(this.getAttribute('data-size'), 10));
      });
    });
  }

  function applyBoardSize(n, persist) {
    BOARD_SIZE = n;
    window.GomokuGame.setBoardSize(n);
    SIZE = PAD * 2 + CELL * (BOARD_SIZE - 1);
    renderBackground();
    sizeButtons.forEach(function (btn) {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-size'), 10) === n);
    });
    game = gameType === 'go' ? new GoGame(n) : new GomokuGame();
    hover = null;
    updateStatus();
    draw();
    if (persist) {
      localStorage.setItem('gomoku_board_size', String(n));
      if (mode === 'ai' && game.currentPlayer !== humanColor) scheduleAI();
    }
  }

  function changeBoardSize(n) {
    if (n === BOARD_SIZE) return;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; thinking = false; }
    applyBoardSize(n, true);
  }
  // ---------- 游戏类型切换 ----------
  function switchGameType(type) {
    if (gameType === type) return;
    gameType = type;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; thinking = false; }
    typeGomoku.classList.toggle('active', type === 'gomoku');
    typeGo.classList.toggle('active', type === 'go');
    gomokuSection.style.display = type === 'gomoku' ? '' : 'none';
    goSection.style.display = type === 'go' ? '' : 'none';
    gomokuScores.style.display = type === 'gomoku' ? '' : 'none';
    goCapturesEl.style.display = type === 'go' ? '' : 'none';
    passBtn.style.display = type === 'go' ? '' : 'none';
    resignBtn.style.display = type === 'go' ? '' : 'none';
    game = type === 'go' ? new GoGame(BOARD_SIZE) : new GomokuGame();
    hover = null;
    updateWins();
    updateStatus();
    draw();
    if (mode === 'ai' && game.currentPlayer !== humanColor) scheduleAI();
  }

  function goHumanPass() {
    if (game.gameOver || thinking) return;
    if (mode === 'ai' && game.currentPlayer !== humanColor) return;
    game.pass();
    playSound('place');
    updateStatus();
    draw();
    if (game.winner !== null) { onGameOver(); return; }
    if (mode === 'ai') scheduleAI();
  }

  function goHumanResign() {
    if (game.gameOver || thinking) return;
    if (mode === 'ai' && game.currentPlayer !== humanColor) return;
    game.resign(game.currentPlayer);
    onGameOver();
  }

  function setGoMode(m) {
    mode = m;
    goModeAI.classList.toggle('active', m === 'ai');
    goModePVP.classList.toggle('active', m === 'pvp');
    goColorPick.style.display = m === 'ai' ? '' : 'none';
    startGame();
  }

  function setGoHumanColor(color) {
    humanColor = color;
    goPickBlack.classList.toggle('active', color === BLACK);
    goPickWhite.classList.toggle('active', color === WHITE);
    startGame();
  }
  typeGomoku.addEventListener('click', function () { switchGameType('gomoku'); });
  typeGo.addEventListener('click', function () { switchGameType('go'); });
  passBtn.addEventListener('click', goHumanPass);
  resignBtn.addEventListener('click', goHumanResign);
  goModeAI.addEventListener('click', function () { setGoMode('ai'); });
  goModePVP.addEventListener('click', function () { setGoMode('pvp'); });
  goPickBlack.addEventListener('click', function () { setGoHumanColor(BLACK); });
  goPickWhite.addEventListener('click', function () { setGoHumanColor(WHITE); });
  soundToggle.addEventListener('click', function () {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) {
      ensureAudio();
      playSound('place');
    }
  });

  // ---------- 启动 ----------
  initColorPickers();
  initBoardSize();
  updateWins();
  updateStatus();
  draw();
})();

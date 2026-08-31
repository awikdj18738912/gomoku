/* 五子棋 AI：基于棋型评分 + 1 层安全检查的启发式算法 */
(function (global) {
  'use strict';

  const { EMPTY, BLACK, WHITE } = global.GomokuGame;
  let BOARD_SIZE = global.GomokuGame.BOARD_SIZE;

  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  const SCORE_FIVE = 10000000;      // 连五，直接获胜
  const SCORE_LIVE_FOUR = 1000000;  // 活四，必胜
  const SCORE_RUSH_FOUR = 100000;   // 冲四
  const SCORE_LIVE_THREE = 100000;  // 活三
  const SCORE_SLEEP_THREE = 10000;  // 眠三
  const SCORE_LIVE_TWO = 10000;     // 活二
  const SCORE_SLEEP_TWO = 1000;     // 眠二
  const SCORE_FORK = 500000;        // 双威胁（双活三、活三+冲四等）

  function inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  }

  // 统计某方向从 (row,col) 落子后形成的连子数与开放端数
  function countRun(board, row, col, player, dr, dc) {
    let count = 1;
    let openEnds = 0;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (inBounds(r, c) && board[r][c] === player) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
      if (inBounds(r, c) && board[r][c] === EMPTY) openEnds++;
    }
    return { count, openEnds };
  }

  function lineScore(board, row, col, player, dr, dc) {
    const { count, openEnds } = countRun(board, row, col, player, dr, dc);
    if (count >= 5) return SCORE_FIVE;
    if (count === 4) return openEnds === 2 ? SCORE_LIVE_FOUR : SCORE_RUSH_FOUR;
    if (count === 3) return openEnds === 2 ? SCORE_LIVE_THREE : SCORE_SLEEP_THREE;
    if (count === 2) return openEnds === 2 ? SCORE_LIVE_TWO : SCORE_SLEEP_TWO;
    return 1;
  }

  // 某点对某方的总评分（四个方向之和）
  function evaluatePoint(board, row, col, player) {
    let total = 0;
    for (const [dr, dc] of DIRECTIONS) {
      total += lineScore(board, row, col, player, dr, dc);
    }
    return total;
  }

  // 某点落子后形成的威胁方向数（用于识别“双活三”等必杀型棋形）
  function threatCount(board, row, col, player) {
    let threats = 0;
    for (const [dr, dc] of DIRECTIONS) {
      const { count, openEnds } = countRun(board, row, col, player, dr, dc);
      if (count >= 4 && openEnds >= 1) threats++;
      else if (count === 3 && openEnds === 2) threats++;
    }
    return threats;
  }

  function hasNeighbor(board, row, col) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (inBounds(r, c) && board[r][c] !== EMPTY) return true;
      }
    }
    return false;
  }

  function countStones(board) {
    let n = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== EMPTY) n++;
      }
    }
    return n;
  }

  function lineWinAt(board, row, col, player) {
    for (const [dr, dc] of DIRECTIONS) {
      let count = 1;
      for (const sign of [1, -1]) {
        let r = row + dr * sign;
        let c = col + dc * sign;
        while (inBounds(r, c) && board[r][c] === player) {
          count++;
          r += dr * sign;
          c += dc * sign;
        }
      }
      if (count >= 5) return true;
    }
    return false;
  }

  // 模拟落子后，检查对手是否还有一步成五的制胜点；若有则该点不安全
  function isSafeAfterMove(board, row, col, aiPlayer, humanPlayer) {
    board[row][col] = aiPlayer;
    let safe = true;
    if (!lineWinAt(board, row, col, aiPlayer)) {
      outer:
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] !== EMPTY) continue;
          if (evaluatePoint(board, r, c, humanPlayer) >= SCORE_FIVE) {
            safe = false;
            break outer;
          }
        }
      }
    }
    board[row][col] = EMPTY;
    return safe;
  }

  function getBestMove(board, aiPlayer, humanPlayer) {
    BOARD_SIZE = global.GomokuGame.BOARD_SIZE;
    const stones = countStones(board);
    if (stones === 0) { const center = Math.floor(BOARD_SIZE / 2); return { row: center, col: center }; }

    const winningMoves = []; // AI 连五直接获胜的点
    const blockMoves = [];   // 必须堵住的对手连五点
    const normal = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== EMPTY) continue;
        if (!hasNeighbor(board, r, c)) continue;

        const attack = evaluatePoint(board, r, c, aiPlayer);
        const defense = evaluatePoint(board, r, c, humanPlayer);

        if (attack >= SCORE_FIVE) {
          winningMoves.push({ row: r, col: c, attack, defense });
        } else if (defense >= SCORE_FIVE) {
          blockMoves.push({ row: r, col: c, attack, defense });
        } else {
          const threats = threatCount(board, r, c, aiPlayer);
          const forkBonus = threats >= 2 ? SCORE_FORK : 0;
          const centerBias = 1 - (Math.abs(r - 7) + Math.abs(c - 7)) / 14;
          const earlyBonus = stones < 6 ? centerBias * 2000 : 0;
          const score = attack + defense * 0.95 + forkBonus + earlyBonus + Math.random() * 0.6;
          normal.push({ row: r, col: c, score });
        }
      }
    }

    if (winningMoves.length > 0) {
      winningMoves.sort((a, b) => b.attack - a.attack);
      return { row: winningMoves[0].row, col: winningMoves[0].col };
    }
    if (blockMoves.length > 0) {
      blockMoves.sort((a, b) => b.attack - a.attack);
      return { row: blockMoves[0].row, col: blockMoves[0].col };
    }

    // 常规候选：先按评分排序，再对前列做 1 层安全检查
    normal.sort((a, b) => b.score - a.score);
    const top = normal.slice(0, 15);
    for (const cand of top) {
      if (!isSafeAfterMove(board, cand.row, cand.col, aiPlayer, humanPlayer)) {
        cand.score -= 9000000;
      }
    }
    normal.sort((a, b) => b.score - a.score);
    const best = normal[0];
    return { row: best.row, col: best.col };
  }

  global.GomokuAI = { getBestMove };
})(window);

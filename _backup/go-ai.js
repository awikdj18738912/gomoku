/* 围棋 AI：基于启发式评估（提子 > 救子 > 打吃 > 占位 > 布局） */
(function (global) {
  'use strict';

  const { EMPTY, BLACK, WHITE } = global.GoGame;

  const DIRECTIONS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  function countStones(board) {
    let n = 0;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (board[r][c] !== EMPTY) n++;
      }
    }
    return n;
  }

  /* 检查 (r,c) 是否是自己一眼（避免自填眼位） */
  function isOwnEye(game, board, r, c, color) {
    for (const d of DIRECTIONS) {
      const nr = r + d[0];
      const nc = c + d[1];
      if (!game.inBounds(nr, nc)) continue;
      if (board[nr][nc] !== color) return false;
    }
    return true;
  }

  function getGoMove(game) {
    const size = game.size;
    const board = game.board;
    const me = game.currentPlayer;
    const opponent = me === BLACK ? WHITE : BLACK;
    const candidates = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== EMPTY) continue;
        if (game.koPoint && game.koPoint.row === r && game.koPoint.col === c) continue;
        if (isOwnEye(game, board, r, c, me)) continue;

        /* 模拟落子 */
        const testBoard = board.map(function (row) { return row.slice(); });
        testBoard[r][c] = me;

        let captures = 0;
        for (const d of DIRECTIONS) {
          const nr = r + d[0];
          const nc = c + d[1];
          if (!game.inBounds(nr, nc) || testBoard[nr][nc] !== opponent) continue;
          const group = game.getGroup(testBoard, nr, nc);
          if (group.libertyCount === 0) {
            for (const s of group.stones) {
              testBoard[s.row][s.col] = EMPTY;
              captures++;
            }
          }
        }

        const ownGroup = game.getGroup(testBoard, r, c);
        if (ownGroup.libertyCount === 0 && captures === 0) continue;

        let score = captures * 100;

        /* 救自己被打吃的棋块 */
        if (ownGroup.libertyCount > 1) {
          for (const d of DIRECTIONS) {
            const nr = r + d[0];
            const nc = c + d[1];
            if (!game.inBounds(nr, nc) || board[nr][nc] !== me) continue;
            const group = game.getGroup(board, nr, nc);
            if (group.libertyCount === 1) {
              score += 80;
              break;
            }
          }
        }

        /* 打吃 / 紧气对方棋块 */
        for (const d of DIRECTIONS) {
          const nr = r + d[0];
          const nc = c + d[1];
          if (!game.inBounds(nr, nc) || testBoard[nr][nc] !== opponent) continue;
          const group = game.getGroup(testBoard, nr, nc);
          if (group.libertyCount === 1) score += 60;
          else if (group.libertyCount === 2) score += 30;
          else if (group.libertyCount === 3) score += 10;
        }

        /* 位置价值：三线/四线佳，一线/二线差 */
        const edge = Math.min(r, c, size - 1 - r, size - 1 - c);
        if (edge === 2 || edge === 3) score += 20;
        else if (edge === 4) score += 12;
        else if (edge === 0) score -= 30;
        else if (edge === 1) score -= 10;

        /* 靠近已有棋子（影响力） */
        let nearFriendly = 0;
        let nearEnemy = 0;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!game.inBounds(nr, nc)) continue;
            if (board[nr][nc] === me) nearFriendly++;
            else if (board[nr][nc] === opponent) nearEnemy++;
          }
        }
        score += nearEnemy * 4 + nearFriendly * 2;

        /* 开局占星位/天元 */
        if (game.moves.length < 10) {
          const center = Math.floor(size / 2);
          const stars = [];
          if (size >= 13) {
            const e = 3;
            stars.push([e, e], [e, size - 1 - e], [size - 1 - e, e], [size - 1 - e, size - 1 - e], [center, center]);
          } else {
            stars.push([center, center]);
          }
          for (const s of stars) {
            if (r === s[0] && c === s[1]) {
              score += 25;
              break;
            }
          }
        }

        candidates.push({ row: r, col: c, score: score });
      }
    }

    if (candidates.length === 0) return { pass: true };

    candidates.sort(function (a, b) { return b.score - a.score; });
    const best = candidates[0];

    /* 局面已基本填满且最佳着法价值极低时虚着结束 */
    if (best.score < 3 && countStones(board) > size * size * 0.35) {
      return { pass: true };
    }

    return best;
  }

  global.GoAI = { getGoMove: getGoMove };
})(window);
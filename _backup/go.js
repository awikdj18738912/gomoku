/* 围棋核心逻辑：棋盘、落子、提子、禁入点、劫争、虚着、数子 */
(function (global) {
  'use strict';

  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const DIRECTIONS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  class GoGame {
    constructor(size) {
      this.size = size || 19;
      this.reset();
    }

    reset() {
      this.board = Array.from({ length: this.size }, function () { return Array(this.size).fill(EMPTY); }, this);
      this.currentPlayer = BLACK;
      this.captures = {};
      this.captures[BLACK] = 0;
      this.captures[WHITE] = 0;
      this.koPoint = null;
      this.consecutivePasses = 0;
      this.gameOver = false;
      this.winner = null;
      this.scoreResult = null;
      this.moves = [];
      this.lastMove = null;
      this.history = [];
    }

    inBounds(r, c) {
      return r >= 0 && r < this.size && c >= 0 && c < this.size;
    }

    /* 搜索包含 (row,col) 的连通棋块，返回棋子列表与气数 */
    getGroup(board, row, col) {
      const color = board[row][col];
      const visited = new Set();
      const stack = [[row, col]];
      const stones = [];
      const liberties = new Set();

      while (stack.length > 0) {
        const cell = stack.pop();
        const cr = cell[0];
        const cc = cell[1];
        const key = cr * this.size + cc;
        if (visited.has(key)) continue;
        visited.add(key);
        stones.push({ row: cr, col: cc });

        for (const d of DIRECTIONS) {
          const nr = cr + d[0];
          const nc = cc + d[1];
          if (!this.inBounds(nr, nc)) continue;
          const val = board[nr][nc];
          if (val === EMPTY) {
            liberties.add(nr * this.size + nc);
          } else if (val === color && !visited.has(nr * this.size + nc)) {
            stack.push([nr, nc]);
          }
        }
      }

      return { stones, liberties, libertyCount: liberties.size };
    }

    /* 落子：自动提子，检查禁入点与劫争，返回落子结果或 null */
    place(row, col) {
      if (this.gameOver) return null;
      if (!this.inBounds(row, col)) return null;
      if (this.board[row][col] !== EMPTY) return null;
      if (this.koPoint && this.koPoint.row === row && this.koPoint.col === col) return null;

      const me = this.currentPlayer;
      const opponent = me === BLACK ? WHITE : BLACK;

      const testBoard = this.board.map(function (r) { return r.slice(); });
      testBoard[row][col] = me;

      const captured = [];
      const processed = new Set();
      for (const d of DIRECTIONS) {
        const nr = row + d[0];
        const nc = col + d[1];
        if (!this.inBounds(nr, nc) || testBoard[nr][nc] !== opponent) continue;
        if (processed.has(nr * this.size + nc)) continue;
        const group = this.getGroup(testBoard, nr, nc);
        if (group.libertyCount === 0) {
          for (const s of group.stones) {
            testBoard[s.row][s.col] = EMPTY;
            captured.push(s);
            processed.add(s.row * this.size + s.col);
          }
        }
      }

      const ownGroup = this.getGroup(testBoard, row, col);
      if (captured.length === 0 && ownGroup.libertyCount === 0) return null;

      this.history.push({
        board: this.board.map(function (r) { return r.slice(); }),
        currentPlayer: this.currentPlayer,
        captures: Object.assign({}, this.captures),
        koPoint: this.koPoint ? { row: this.koPoint.row, col: this.koPoint.col } : null,
        consecutivePasses: this.consecutivePasses,
        lastMove: this.lastMove ? Object.assign({}, this.lastMove) : null
      });

      if (captured.length === 1 && ownGroup.stones.length === 1 && ownGroup.libertyCount === 1) {
        this.koPoint = { row: captured[0].row, col: captured[0].col };
      } else {
        this.koPoint = null;
      }

      this.board = testBoard;
      this.captures[me] += captured.length;
      this.consecutivePasses = 0;
      this.lastMove = { row, col, player: me };
      this.moves.push(this.lastMove);
      this.currentPlayer = me === BLACK ? WHITE : BLACK;
      return { row, col, player: me, captured };
    }

    saveState() {
      this.history.push({
        board: this.board.map(function (r) { return r.slice(); }),
        currentPlayer: this.currentPlayer,
        captures: Object.assign({}, this.captures),
        koPoint: this.koPoint ? { row: this.koPoint.row, col: this.koPoint.col } : null,
        consecutivePasses: this.consecutivePasses,
        lastMove: this.lastMove ? Object.assign({}, this.lastMove) : null
      });
    }

    pass() {
      if (this.gameOver) return;
      this.saveState();
      const me = this.currentPlayer;
      this.consecutivePasses++;
      this.lastMove = { pass: true, player: me };
      this.moves.push(this.lastMove);
      this.currentPlayer = me === BLACK ? WHITE : BLACK;
      if (this.consecutivePasses >= 2) {
        this.gameOver = true;
        this.scoreResult = this.calculateScore();
        this.winner = this.scoreResult.winner;
      }
    }

    resign(player) {
      if (this.gameOver) return;
      this.gameOver = true;
      this.winner = player === BLACK ? WHITE : BLACK;
    }

    /* 中国规则数子：活棋子数 + 围空目数，白方贴 7.5 目 */
    calculateScore() {
      const komi = 7.5;
      let blackArea = 0;
      let whiteArea = 0;
      const territoryMap = [];

      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.board[r][c] === BLACK) blackArea++;
          else if (this.board[r][c] === WHITE) whiteArea++;
        }
      }

      const visited = new Set();
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.board[r][c] !== EMPTY || visited.has(r * this.size + c)) continue;
          const region = [];
          const stack = [[r, c]];
          const bordering = new Set();

          while (stack.length > 0) {
            const cell = stack.pop();
            const cr = cell[0];
            const cc = cell[1];
            const key = cr * this.size + cc;
            if (visited.has(key)) continue;
            visited.add(key);
            region.push({ row: cr, col: cc });

            for (const d of DIRECTIONS) {
              const nr = cr + d[0];
              const nc = cc + d[1];
              if (!this.inBounds(nr, nc)) continue;
              const val = this.board[nr][nc];
              if (val === EMPTY && !visited.has(nr * this.size + nc)) {
                stack.push([nr, nc]);
              } else if (val !== EMPTY) {
                bordering.add(val);
              }
            }
          }

          if (bordering.size === 1) {
            const owner = bordering.has(BLACK) ? BLACK : WHITE;
            if (owner === BLACK) blackArea += region.length;
            else whiteArea += region.length;
            for (const p of region) {
              territoryMap.push({ row: p.row, col: p.col, owner: owner });
            }
          }
        }
      }

      return {
        black: blackArea,
        white: whiteArea + komi,
        komi: komi,
        territoryMap: territoryMap,
        winner: blackArea > whiteArea + komi ? BLACK : WHITE
      };
    }

    undo() {
      if (this.history.length === 0) return false;
      const prev = this.history.pop();
      this.board = prev.board;
      this.currentPlayer = prev.currentPlayer;
      this.captures = prev.captures;
      this.koPoint = prev.koPoint;
      this.consecutivePasses = prev.consecutivePasses;
      this.lastMove = prev.lastMove;
      this.gameOver = false;
      this.winner = null;
      this.scoreResult = null;
      this.moves.pop();
      return true;
    }
  }

  global.GoGame = { GoGame: GoGame, EMPTY: EMPTY, BLACK: BLACK, WHITE: WHITE };
})(window);
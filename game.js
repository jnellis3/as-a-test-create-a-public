const COLS = 10;
const ROWS = 20;
const CELL = 30;
const COLORS = {
  I: "#22d3ee",
  J: "#60a5fa",
  L: "#f59e0b",
  O: "#facc15",
  S: "#34d399",
  T: "#c084fc",
  Z: "#fb7185"
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]]
};

const boardCanvas = document.querySelector("#board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const linesEl = document.querySelector("#lines");
const levelEl = document.querySelector("#level");
const restartButton = document.querySelector("#restartButton");
const pauseButton = document.querySelector("#pauseButton");
const pauseIcon = document.querySelector("#pauseIcon");

let board;
let current;
let next;
let score;
let lines;
let level;
let dropCounter;
let dropInterval;
let lastTime;
let paused;
let gameOver;
let animationFrame;
let repeatTimer;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0
  };
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  return matrix.some((row, y) =>
    row.some((cell, x) => {
      if (!cell) return false;
      const nextX = piece.x + x + offsetX;
      const nextY = piece.y + y + offsetY;
      return nextX < 0 || nextX >= COLS || nextY >= ROWS || (nextY >= 0 && board[nextY][nextX]);
    })
  );
}

function mergePiece() {
  current.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell && current.y + y >= 0) {
        board[current.y + y][current.x + x] = current.type;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (!cleared) return;

  const points = [0, 100, 300, 500, 800][cleared] * level;
  score += points;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(120, 820 - (level - 1) * 70);
}

function spawnPiece() {
  current = next;
  next = randomPiece();
  if (collides(current)) {
    gameOver = true;
    paused = true;
  }
}

function move(offset) {
  if (paused || gameOver) return;
  if (!collides(current, offset, 0)) {
    current.x += offset;
  }
}

function softDrop() {
  if (paused || gameOver) return;
  if (!collides(current, 0, 1)) {
    current.y += 1;
    score += 1;
  } else {
    mergePiece();
    clearLines();
    spawnPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (paused || gameOver) return;
  let distance = 0;
  while (!collides(current, 0, 1)) {
    current.y += 1;
    distance += 1;
  }
  score += distance * 2;
  softDrop();
}

function rotatePiece() {
  if (paused || gameOver) return;
  const rotated = rotate(current.matrix);
  const kicks = [0, -1, 1, -2, 2];
  const kick = kicks.find((offset) => !collides(current, offset, 0, rotated));
  if (kick !== undefined) {
    current.matrix = rotated;
    current.x += kick;
  }
}

function landingPiece() {
  const ghost = {
    ...current,
    matrix: current.matrix
  };

  while (!collides(ghost, 0, 1)) {
    ghost.y += 1;
  }

  return ghost;
}

function drawCell(ctx, x, y, color, size = CELL) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(x * size + 2, y * size + 2, size - 4, 4);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.24)";
  ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
}

function drawGhostCell(ctx, x, y, color, size = CELL) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = color;
  ctx.fillRect(x * size + 4, y * size + 4, size - 8, size - 8);
  ctx.globalAlpha = 0.58;
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.strokeRect(x * size + 3, y * size + 3, size - 6, size - 6);
  ctx.restore();
}

function drawGhostPiece() {
  const ghost = landingPiece();
  if (ghost.y === current.y) return;

  ghost.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell && ghost.y + y >= 0) {
        drawGhostCell(boardCtx, ghost.x + x, ghost.y + y, COLORS[ghost.type]);
      }
    });
  });
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = "#0b0d10";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardCtx.strokeStyle = "rgba(255, 255, 255, 0.045)";
  for (let x = 1; x < COLS; x += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * CELL, 0);
    boardCtx.lineTo(x * CELL, boardCanvas.height);
    boardCtx.stroke();
  }
  for (let y = 1; y < ROWS; y += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * CELL);
    boardCtx.lineTo(boardCanvas.width, y * CELL);
    boardCtx.stroke();
  }

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawCell(boardCtx, x, y, COLORS[type]);
    });
  });

  if (current) {
    drawGhostPiece();
    current.matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) drawCell(boardCtx, current.x + x, current.y + y, COLORS[current.type]);
      });
    });
  }

  if (paused) {
    boardCtx.fillStyle = "rgba(8, 10, 13, 0.72)";
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardCtx.fillStyle = "#f4f7fb";
    boardCtx.font = "800 30px system-ui, sans-serif";
    boardCtx.textAlign = "center";
    boardCtx.fillText(gameOver ? "Game Over" : "Paused", boardCanvas.width / 2, boardCanvas.height / 2);
  }
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = "#10141a";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 24;
  const offsetX = Math.floor((5 - next.matrix[0].length) / 2);
  const offsetY = Math.floor((5 - next.matrix.length) / 2);
  next.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) drawCell(nextCtx, x + offsetX, y + offsetY, COLORS[next.type], size);
    });
  });
}

function updateStats() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines.toString();
  levelEl.textContent = level.toString();
  pauseIcon.textContent = paused && !gameOver ? ">" : "II";
}

function loop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      softDrop();
    }
  }

  drawBoard();
  drawNext();
  updateStats();
  animationFrame = requestAnimationFrame(loop);
}

function newGame() {
  cancelAnimationFrame(animationFrame);
  board = emptyBoard();
  current = randomPiece();
  next = randomPiece();
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  dropInterval = 820;
  lastTime = 0;
  paused = false;
  gameOver = false;
  loop();
}

document.addEventListener("keydown", (event) => {
  const actions = {
    ArrowLeft: () => move(-1),
    ArrowRight: () => move(1),
    ArrowDown: softDrop,
    ArrowUp: rotatePiece,
    " ": hardDrop,
    KeyP: () => {
      if (!gameOver) paused = !paused;
    }
  };
  if (actions[event.key] || actions[event.code]) {
    event.preventDefault();
    (actions[event.key] || actions[event.code])();
  }
});

function runTouchAction(action) {
  if (action === "left") move(-1);
  if (action === "right") move(1);
  if (action === "rotate") rotatePiece();
  if (action === "drop") softDrop();
  if (action === "hardDrop") hardDrop();
}

function stopRepeating() {
  clearInterval(repeatTimer);
  repeatTimer = undefined;
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const action = button.dataset.action;
    runTouchAction(action);

    if (button.dataset.repeat === "true") {
      stopRepeating();
      repeatTimer = setInterval(() => runTouchAction(action), action === "drop" ? 80 : 120);
    }
  });

  button.addEventListener("pointerup", stopRepeating);
  button.addEventListener("pointercancel", stopRepeating);
  button.addEventListener("lostpointercapture", stopRepeating);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
});

pauseButton.addEventListener("click", () => {
  if (!gameOver) paused = !paused;
});
restartButton.addEventListener("click", newGame);

newGame();

/*global
    requestAnimationFrame,
    cancelAnimationFrame
*/
const DEFAULT_HEX_SIZE = 25;
const SQRT_3 = Math.sqrt(3);

var Directions = Object.freeze([
    "SOUTHEAST",
    "SOUTH",
    "SOUTHWEST",
    "NORTHWEST",
    "NORTH",
    "NORTHEAST"
]);

var Masks = Object.freeze({
    VISITED:        0b1,
    CURSOR:         0b10,
    PATH_SOUTHEAST: 0b100,
    PATH_SOUTH:     0b1000,
    PATH_SOUTHWEST: 0b10000,
    PATH_NORTHWEST: 0b100000,
    PATH_NORTH:     0b1000000,
    PATH_NORTHEAST: 0b10000000
});

var ReverseDirectionMasks = Object.freeze({
    PATH_SOUTHEAST: Masks.PATH_NORTHWEST,
    PATH_SOUTH: Masks.PATH_NORTH,
    PATH_SOUTHWEST: Masks.PATH_NORTHEAST,
    PATH_NORTHWEST: Masks.PATH_SOUTHEAST,
    PATH_NORTH: Masks.PATH_SOUTH,
    PATH_NORTHEAST: Masks.PATH_SOUTHWEST
});

var Neighbors = Object.freeze({  
    SOUTHEAST: [1, 0],
    SOUTH: [0, 1],
    SOUTHWEST: [-1, 1],
    NORTHWEST: [-1, 0],
    NORTH: [0, -1],
    NORTHEAST: [1, -1]
});

function getDefaultLineWidth(size) {
    return Math.ceil(size / 4);
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function getNeighborIndex(i, j, i_size, j_size, direction) {
    var value = qrToIndex(...indexToQRCoords(i, j).map((a, i) => a + Neighbors[direction][i]));
    if (value.some(b => b < 0) || value[0] >= i_size || value[1] >= j_size) return false;
    return value;
} 

function indexToQRCoords(i, j) {
    return [i, j - Math.floor(i / 2)];
}

function indexToXY (i, j, size) {
    return qrToXY(...indexToQRCoords(i, j), size);
}

function qrToIndex(q, r) {
    return [q, r + Math.floor(q / 2)];
}

function qrToXY (q, r, size) {
    return [q * 3 / 2, q * SQRT_3 / 2 + r * SQRT_3]
                .map((a, i) => (a + [3/2, SQRT_3/2 + 0.1][i]) * (size || DEFAULT_HEX_SIZE));
}

function getHexCorner(x, y, size, c) {
    return [x + size * (Math.cos(c * Math.PI / 3)), y + size * (Math.sin(c * Math.PI / 3))];
}

function drawHexFromArray(context, array, i, j, size) {
    var x, y, c, sz = size || DEFAULT_HEX_SIZE;
    [x, y] = qrToXY(...indexToQRCoords(i, j), sz);
    context.beginPath();
    context.moveTo(...getHexCorner(x, y, sz, 0));
    for (c = 1; c <= 6; c++) {
        if (array[i][j] & Masks["PATH_" + Directions[c - 1]]) {
            context.moveTo(...getHexCorner(x, y, sz, c));
        } else {
            context.lineTo(...getHexCorner(x, y, sz, c));
        }
    }
    context.strokeStyle = (array[i][j] & Masks.VISITED) ? "#FFFFFF" : "#FF00FF";
    context.lineWidth = getDefaultLineWidth(sz);
    context.stroke();
    if (array[i][j] & Masks.CURSOR) {
        context.fillStyle = "#00FF00";
        context.fillRect(x - .25 * sz, y - .25 * sz, sz / 2, sz / 2);
    } else {
        context.clearRect(x - .3 * sz, y - .3 * sz, .62 * sz, .62 * sz);
    }
}

function Maze(canvasElement, cellsWidth, cellsHeight, cellSize, hollowMode) {
    "use strict";
    if (!canvasElement || !canvasElement.getContext) {
        throw "Could not initialize Game. Argument must be a valid canvas element.";
    }
    var that = this,
        perSecond = 30,
        canvas = canvasElement,
        hollow = hollowMode,
        context = canvas.getContext("2d"),
        cellSize = cellSize || DEFAULT_HEX_SIZE,
        stack = [[0,0]],
        grid = [...Array(cellsWidth || 10)].map(e => new Uint8Array(cellsHeight || 10).fill(0)),
        running = false,
        lastTimeStamp = Date.now(),
        animationFrameHandle,
        update = function (shouldDraw) {
            if (!stack.length) {
                return false;
            }
            var a, b, c, dir, nbrInd, sD = (shouldDraw!==false), neighbors = [];
            [a, b] = stack[stack.length-1];
            
            sD && clearLocalized(a, b)
            
            grid[a][b] |= (Masks.VISITED | Masks.CURSOR);
            for (c = 0; c < Directions.length; c++) {
                nbrInd = getNeighborIndex(a, b, cellsWidth, cellsHeight, Directions[c]);
                if (nbrInd && !(grid[nbrInd[0]][nbrInd[1]] & Masks.VISITED)) {
                    neighbors.push([Directions[c], nbrInd]);
                }
            }
            
            if (neighbors.length) {
                [dir, c] = neighbors[getRandomInt(neighbors.length)];
                grid[a][b] |= Masks["PATH_" + dir];
                grid[c[0]][c[1]] |= ReverseDirectionMasks["PATH_" + dir];
                stack.push(c);
            } else {
                stack.pop();
            }
            
            sD && drawLocalized(a, b);
            
            grid[a][b] ^= Masks.CURSOR;
            return true;
        },
        clearLocalized = function (i, j) {
            var x, y;
            [x, y] = indexToXY(i, j, cellSize);
            context.clearRect(x - 1.7 * cellSize, y - (SQRT_3 + 0.2) * cellSize, 3.4 * cellSize, 2 * (SQRT_3 + 0.2) * cellSize);  
        },
        clearWholeGrid = function () {
            context.clearRect(0, 0, canvas.width, canvas.height);
        },
        drawLocalized = function (i, j) {
            var x, y;
            [x, y] = indexToXY(i, j, cellSize);
            drawHexFromArray(context, grid, i, j, cellSize);
            var neighbors = Directions.map(d => getNeighborIndex(i, j, cellsWidth, cellsHeight, d))
                            .filter((v, i) => !!v);
            neighbors.forEach(nbr => {
                drawHexFromArray(context, grid, ...nbr, cellSize);
            });
        },
        drawWholeGrid = function (forced) {
            if (hollow && !forced) { 
                return; 
            }
            var i, j;
            for (i = 0; i < grid.length; i++) {
               for (j = 0; j < grid[i].length; j++) {
                   drawHexFromArray(context, grid, i, j, cellSize);
               } 
            }
        },
        gameLoop = function () {
            // Get time delta
            var currentTimeStamp = Date.now(),
                dtMs = currentTimeStamp - lastTimeStamp,
                shouldContinue = true;
            if (dtMs > (1000 / perSecond)) {
                lastTimeStamp = currentTimeStamp - (dtMs % (1000 / perSecond));
                shouldContinue = update();
            }
            
            if (shouldContinue && running) {
                animationFrameHandle = requestAnimationFrame(gameLoop);
            } else {
                running = false;
            }
        };
    this.startGame = function () {
        if (!running) {
            drawWholeGrid();
            animationFrameHandle = requestAnimationFrame(gameLoop);
            running = true;
        }
    };
    this.stopGame = function () {
        if (running) {
            cancelAnimationFrame(animationFrameHandle);
            running = false;
        }
    };
    this.resetGame = function () {
        if (running) {
            this.stopGame();
        }
        clearWholeGrid();
        stack = [[0,0]]
        grid = [...Array(cellsWidth || 10)].map(e => new Uint8Array(cellsHeight || 10).fill(0));
        drawWholeGrid();
    };
    this.renderMaze = function (reset) {
        if (reset) {
            this.resetGame();
        }
        clearWholeGrid();

        context.fillStyle = "#FFCCFF";
        context.font = '40px san-serif';

        var textString = "Generating Maze, Please Wait...",
            textWidth = context.measureText(textString).width,
            textHeight = context.measureText("M").width;

        context.fillText(textString, (canvas.width / 2) - (textWidth / 2), (canvas.height / 2) - (textHeight / 2));
            
        setTimeout(() => {
            while(update(false));
            clearWholeGrid();
            drawWholeGrid(true);
        }, 100);
        
    };
    this.clear = function () {
        clearWholeGrid();
    };
    this.setHollow = function (isHollow) {
        hollow = isHollow;  
    };
    this.setPerSecond = function(ps) {
        perSecond = ps || 30;
    };
    clearWholeGrid();
    drawWholeGrid();
}
(function() {
    var ECC_LEVEL_BITS = { L: 1 };
    var VERSION_INFO = {
        1: { size: 21, dataCodewords: 19, eccCodewords: 7, align: [] },
        2: { size: 25, dataCodewords: 34, eccCodewords: 10, align: [6, 18] },
        3: { size: 29, dataCodewords: 55, eccCodewords: 15, align: [6, 22] },
        4: { size: 33, dataCodewords: 80, eccCodewords: 20, align: [6, 26] }
    };

    var EXP_TABLE = new Array(512);
    var LOG_TABLE = new Array(256);

    var x = 1;
    for (var i = 0; i < 255; i++) {
        EXP_TABLE[i] = x;
        LOG_TABLE[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (i = 255; i < 512; i++) EXP_TABLE[i] = EXP_TABLE[i - 255];

    function toUtf8Bytes(text) {
        var value = String(text == null ? '' : text);
        if (typeof TextEncoder !== 'undefined') {
            return Array.from(new TextEncoder().encode(value));
        }
        var escaped = unescape(encodeURIComponent(value));
        var bytes = [];
        for (var i = 0; i < escaped.length; i++) bytes.push(escaped.charCodeAt(i));
        return bytes;
    }

    function pickVersion(byteLength) {
        for (var version = 1; version <= 4; version++) {
            if (byteLength <= VERSION_INFO[version].dataCodewords) return version;
        }
        throw new Error('Le lien est trop long pour le générateur QR intégré.');
    }

    function gfMul(a, b) {
        if (!a || !b) return 0;
        return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
    }

    function bitPush(bits, value, length) {
        for (var i = length - 1; i >= 0; i--) {
            bits.push((value >> i) & 1);
        }
    }

    function makeDataCodewords(bytes, version) {
        var bits = [];
        var dataCapacityBits = VERSION_INFO[version].dataCodewords * 8;

        bitPush(bits, 0x4, 4);
        bitPush(bits, bytes.length, 8);

        for (var i = 0; i < bytes.length; i++) bitPush(bits, bytes[i], 8);

        var remaining = dataCapacityBits - bits.length;
        var terminator = Math.min(4, Math.max(remaining, 0));
        for (i = 0; i < terminator; i++) bits.push(0);
        while (bits.length % 8 !== 0) bits.push(0);

        var data = [];
        for (i = 0; i < bits.length; i += 8) {
            data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
        }

        var padBytes = [0xec, 0x11];
        var padIndex = 0;
        while (data.length < VERSION_INFO[version].dataCodewords) {
            data.push(padBytes[padIndex % 2]);
            padIndex++;
        }

        return data;
    }

    function buildGeneratorPoly(degree) {
        var poly = [1];
        for (var i = 0; i < degree; i++) {
            var next = new Array(poly.length + 1).fill(0);
            for (var j = 0; j < poly.length; j++) {
                next[j] ^= poly[j];
                next[j + 1] ^= gfMul(poly[j], EXP_TABLE[i]);
            }
            poly = next;
        }
        return poly;
    }

    function reedSolomonRemainder(data, eccLength) {
        var generator = buildGeneratorPoly(eccLength);
        var buffer = data.slice();
        for (var i = 0; i < eccLength; i++) buffer.push(0);

        for (i = 0; i < data.length; i++) {
            var factor = buffer[i];
            if (!factor) continue;
            for (var j = 0; j < generator.length; j++) {
                buffer[i + j] ^= gfMul(generator[j], factor);
            }
        }

        return buffer.slice(buffer.length - eccLength);
    }

    function createGrid(size) {
        var grid = new Array(size);
        var reserved = new Array(size);
        for (var y = 0; y < size; y++) {
            grid[y] = new Array(size).fill(null);
            reserved[y] = new Array(size).fill(false);
        }
        return { grid: grid, reserved: reserved };
    }

    function reserve(reserved, y, x) {
        if (y >= 0 && y < reserved.length && x >= 0 && x < reserved.length) {
            reserved[y][x] = true;
        }
    }

    function drawFinder(grid, reserved, top, left) {
        for (var y = -1; y <= 7; y++) {
            for (var x = -1; x <= 7; x++) {
                var row = top + y;
                var col = left + x;
                if (row < 0 || row >= grid.length || col < 0 || col >= grid.length) continue;
                reserve(reserved, row, col);
                if (y === -1 || y === 7 || x === -1 || x === 7) {
                    grid[row][col] = false;
                } else if (y === 0 || y === 6 || x === 0 || x === 6) {
                    grid[row][col] = true;
                } else if (y >= 2 && y <= 4 && x >= 2 && x <= 4) {
                    grid[row][col] = true;
                } else {
                    grid[row][col] = false;
                }
            }
        }
    }

    function drawAlignment(grid, reserved, centerY, centerX) {
        for (var y = -2; y <= 2; y++) {
            for (var x = -2; x <= 2; x++) {
                var row = centerY + y;
                var col = centerX + x;
                if (row < 0 || row >= grid.length || col < 0 || col >= grid.length) continue;
                reserve(reserved, row, col);
                var max = Math.max(Math.abs(y), Math.abs(x));
                if (max === 2 || max === 0) grid[row][col] = true;
                else grid[row][col] = false;
            }
        }
    }

    function drawAlignmentPatterns(grid, reserved, version) {
        var points = VERSION_INFO[version].align;
        if (!points || !points.length) return;
        var size = grid.length;

        for (var i = 0; i < points.length; i++) {
            for (var j = 0; j < points.length; j++) {
                var row = points[i];
                var col = points[j];
                var onTopLeft = row === 6 && col === 6;
                var onTopRight = row === 6 && col === size - 7;
                var onBottomLeft = row === size - 7 && col === 6;
                if (onTopLeft || onTopRight || onBottomLeft) continue;
                drawAlignment(grid, reserved, row, col);
            }
        }
    }

    function drawTiming(grid, reserved) {
        for (var i = 8; i < grid.length - 8; i++) {
            var dark = i % 2 === 0;
            grid[6][i] = dark;
            grid[i][6] = dark;
            reserve(reserved, 6, i);
            reserve(reserved, i, 6);
        }
    }

    function drawDarkModule(grid, reserved, version) {
        var row = 4 * version + 9;
        grid[row][8] = true;
        reserve(reserved, row, 8);
    }

    function reserveFormatAreas(reserved) {
        var size = reserved.length;
        var points = [
            [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
            [size - 1,8],[size - 2,8],[size - 3,8],[size - 4,8],[size - 5,8],[size - 6,8],[size - 7,8],
            [8,size - 8],[8,size - 7],[8,size - 6],[8,size - 5],[8,size - 4],[8,size - 3],[8,size - 2],[8,size - 1]
        ];
        for (var i = 0; i < points.length; i++) reserve(reserved, points[i][0], points[i][1]);
    }

    function formatBits(mask) {
        var data = ((ECC_LEVEL_BITS.L << 3) | mask) << 10;
        var generator = 0x537;
        for (var i = 14; i >= 10; i--) {
            if ((data >> i) & 1) data ^= generator << (i - 10);
        }
        return ((((ECC_LEVEL_BITS.L << 3) | mask) << 10) | (data & 0x3ff)) ^ 0x5412;
    }

    function getFormatBitArray(mask) {
        var value = formatBits(mask);
        var bits = [];
        for (var i = 14; i >= 0; i--) bits.push((value >> i) & 1);
        return bits;
    }

    function placeFormatBits(grid, mask) {
        var size = grid.length;
        var bits = getFormatBitArray(mask);
        var positions = [
            [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
            [size - 1,8],[size - 2,8],[size - 3,8],[size - 4,8],[size - 5,8],[size - 6,8],[size - 7,8],
            [8,size - 8],[8,size - 7],[8,size - 6],[8,size - 5],[8,size - 4],[8,size - 3],[8,size - 2],[8,size - 1]
        ];
        for (var i = 0; i < 15; i++) grid[positions[i][0]][positions[i][1]] = !!bits[i];
        for (i = 0; i < 15; i++) grid[positions[15 + i][0]][positions[15 + i][1]] = !!bits[i];
    }

    var MASKS = [
        function(r, c) { return (r + c) % 2 === 0; },
        function(r, c) { return r % 2 === 0; },
        function(r, c) { return c % 3 === 0; },
        function(r, c) { return (r + c) % 3 === 0; },
        function(r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
        function(r, c) { return ((r * c) % 2 + (r * c) % 3) === 0; },
        function(r, c) { return (((r * c) % 2 + (r * c) % 3) % 2) === 0; },
        function(r, c) { return (((r + c) % 2 + (r * c) % 3) % 2) === 0; }
    ];

    function placeData(grid, reserved, codewords, mask) {
        var bits = [];
        for (var i = 0; i < codewords.length; i++) {
            for (var bit = 7; bit >= 0; bit--) bits.push((codewords[i] >> bit) & 1);
        }

        var bitIndex = 0;
        var directionUp = true;
        for (var col = grid.length - 1; col > 0; col -= 2) {
            if (col === 6) col--;
            for (var y = 0; y < grid.length; y++) {
                var row = directionUp ? grid.length - 1 - y : y;
                for (var offset = 0; offset < 2; offset++) {
                    var xPos = col - offset;
                    if (reserved[row][xPos]) continue;
                    var value = bitIndex < bits.length ? bits[bitIndex++] : 0;
                    if (MASKS[mask](row, xPos)) value ^= 1;
                    grid[row][xPos] = !!value;
                }
            }
            directionUp = !directionUp;
        }
    }

    function scoreGrid(grid) {
        var size = grid.length;
        var score = 0;
        var darkCount = 0;

        for (var y = 0; y < size; y++) {
            var runColor = grid[y][0];
            var runLength = 1;
            for (var x = 0; x < size; x++) {
                if (grid[y][x]) darkCount++;
                if (x === 0) continue;
                if (grid[y][x] === runColor) runLength++;
                else {
                    if (runLength >= 5) score += 3 + (runLength - 5);
                    runColor = grid[y][x];
                    runLength = 1;
                }
            }
            if (runLength >= 5) score += 3 + (runLength - 5);
        }

        for (x = 0; x < size; x++) {
            var colColor = grid[0][x];
            var colRun = 1;
            for (var y2 = 1; y2 < size; y2++) {
                if (grid[y2][x] === colColor) colRun++;
                else {
                    if (colRun >= 5) score += 3 + (colRun - 5);
                    colColor = grid[y2][x];
                    colRun = 1;
                }
            }
            if (colRun >= 5) score += 3 + (colRun - 5);
        }

        for (y = 0; y < size - 1; y++) {
            for (x = 0; x < size - 1; x++) {
                var value = grid[y][x];
                if (grid[y][x + 1] === value && grid[y + 1][x] === value && grid[y + 1][x + 1] === value) score += 3;
            }
        }

        var patterns = [
            [true,false,true,true,true,false,true,false,false,false,false],
            [false,false,false,false,true,false,true,true,true,false,true]
        ];
        for (y = 0; y < size; y++) {
            for (x = 0; x <= size - 11; x++) {
                for (var p = 0; p < patterns.length; p++) {
                    var match = true;
                    for (var k = 0; k < 11; k++) {
                        if (grid[y][x + k] !== patterns[p][k]) { match = false; break; }
                    }
                    if (match) score += 40;
                }
            }
        }
        for (x = 0; x < size; x++) {
            for (y = 0; y <= size - 11; y++) {
                for (p = 0; p < patterns.length; p++) {
                    var matchCol = true;
                    for (k = 0; k < 11; k++) {
                        if (grid[y + k][x] !== patterns[p][k]) { matchCol = false; break; }
                    }
                    if (matchCol) score += 40;
                }
            }
        }

        var percent = darkCount * 100 / (size * size);
        score += Math.floor(Math.abs(percent - 50) / 5) * 10;
        return score;
    }

    function createMatrix(text) {
        var bytes = toUtf8Bytes(text);
        var version = pickVersion(bytes.length);
        var cfg = VERSION_INFO[version];
        var data = makeDataCodewords(bytes, version);
        var ecc = reedSolomonRemainder(data, cfg.eccCodewords);
        var codewords = data.concat(ecc);
        var best = null;

        for (var mask = 0; mask < 8; mask++) {
            var base = createGrid(cfg.size);
            drawFinder(base.grid, base.reserved, 0, 0);
            drawFinder(base.grid, base.reserved, 0, cfg.size - 7);
            drawFinder(base.grid, base.reserved, cfg.size - 7, 0);
            drawAlignmentPatterns(base.grid, base.reserved, version);
            drawTiming(base.grid, base.reserved);
            drawDarkModule(base.grid, base.reserved, version);
            reserveFormatAreas(base.reserved);
            placeData(base.grid, base.reserved, codewords, mask);
            placeFormatBits(base.grid, mask);

            var score = scoreGrid(base.grid);
            if (!best || score < best.score) best = { grid: base.grid, score: score };
        }

        return best.grid;
    }

    function renderToCanvas(canvas, grid, options) {
        options = options || {};
        var dark = options.color && options.color.dark ? options.color.dark : '#000';
        var light = options.color && options.color.light ? options.color.light : '#fff';
        var margin = typeof options.margin === 'number' ? options.margin : 4;
        var width = typeof options.width === 'number' ? options.width : 128;
        var total = grid.length + margin * 2;
        var scale = width / total;
        var ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = width;
        ctx.clearRect(0, 0, width, width);
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, width, width);
        ctx.fillStyle = dark;
        ctx.imageSmoothingEnabled = false;

        for (var y = 0; y < grid.length; y++) {
            for (var x = 0; x < grid.length; x++) {
                if (grid[y][x]) {
                    ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
                }
            }
        }
    }

    window.QRCode = {
        toCanvas: function(canvas, text, options, cb) {
            try {
                var grid = createMatrix(text);
                renderToCanvas(canvas, grid, options);
                if (typeof cb === 'function') cb(null);
            } catch (err) {
                if (typeof cb === 'function') cb(err);
                else throw err;
            }
        }
    };
})();
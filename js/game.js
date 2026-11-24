/**
 * 雷霆战机 —— 一个用 Canvas 写的飞机大战小游戏
 * 课程作业 / 个人练习项目
 *
 * 主要功能：
 *   1. 键盘（方向键 / WASD）和手机拖动两种操作方式
 *   2. 三种敌机、两种道具、三条命
 *   3. 分数、最高分（存在浏览器本地）、暂停、重新开始
 *
 * 代码结构：
 *   先定义游戏状态和数据，再写 update（更新逻辑）和 draw（绘制），
 *   最后用 requestAnimationFrame 跑主循环。
 */

(function () {
    'use strict';

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');

    var W = canvas.width;   // 画布宽 480
    var H = canvas.height;  // 画布高 720

    // 页面元素
    var scoreEl = document.getElementById('score');
    var bestEl = document.getElementById('best');
    var livesEl = document.getElementById('lives');
    var overlay = document.getElementById('overlay');
    var ovTitle = document.getElementById('ovTitle');
    var ovSub = document.getElementById('ovSub');
    var ovTips = document.getElementById('ovTips');
    var startBtn = document.getElementById('startBtn');
    var pauseTip = document.getElementById('pauseTip');

    // ---------- 全局状态 ----------
    var state = 'ready';       // ready / playing / paused / over
    var score = 0;
    var best = parseInt(localStorage.getItem('thunder_best') || '0', 10);
    var lastTime = 0;
    var elapsed = 0;           // 本局经过的秒数
    var spawnTimer = 0;        // 距离上次刷怪的时间（毫秒）
    var spawnInterval = 820;   // 刷怪间隔（毫秒）
    var difficulty = 1;
    var diffTimer = 0;

    var player = null;
    var playerBullets = [];
    var enemyBullets = [];
    var enemies = [];
    var particles = [];
    var items = [];
    var stars = [];

    var keys = {};
    var pointer = { active: false, x: W / 2, y: H - 90 };

    // ---------- 初始化 ----------
    function initStars() {
        stars = [];
        for (var i = 0; i < 70; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                speed: 30 + Math.random() * 90,
                size: Math.random() < 0.8 ? 1 : 2,
                alpha: 0.3 + Math.random() * 0.6
            });
        }
    }

    function resetGame() {
        player = {
            x: W / 2,
            y: H - 90,
            w: 32,
            h: 38,
            speed: 320,
            hp: 3,
            maxHp: 3,
            invincible: 0,
            power: 1,      // 火力等级：1 单发 / 2 双发 / 3 三发
            shield: 0,     // 护盾层数
            fireCd: 0
        };
        playerBullets = [];
        enemyBullets = [];
        enemies = [];
        particles = [];
        items = [];
        score = 0;
        elapsed = 0;
        spawnTimer = 0;
        spawnInterval = 820;
        difficulty = 1;
        diffTimer = 0;
        pointer.active = false;
        pointer.x = player.x;
        pointer.y = player.y;
        updateHud();
    }

    function updateHud() {
        scoreEl.textContent = score;
        bestEl.textContent = Math.max(best, score);   // 超过最高分时实时显示
        var hearts = '';
        for (var i = 0; i < player.maxHp; i++) {
            hearts += i < player.hp ? '♥' : '♡';
        }
        livesEl.textContent = hearts;
    }

    // ---------- 开始 / 结束 / 暂停 ----------
    function startGame() {
        resetGame();
        state = 'playing';
        overlay.classList.add('hide');
        pauseTip.classList.remove('show');
    }

    function gameOver() {
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem('thunder_best', String(best));
        }
        updateHud();
        ovTitle.textContent = '游戏结束';
        ovSub.textContent = '本局得分 ' + score + '　最高分 ' + best;
        startBtn.textContent = '再来一次';
        ovTips.textContent = '按空格也能重新开始';
        overlay.classList.remove('hide');
    }

    function togglePause() {
        if (state === 'playing') {
            state = 'paused';
            pauseTip.classList.add('show');
        } else if (state === 'paused') {
            state = 'playing';
            pauseTip.classList.remove('show');
        }
    }

    // ---------- 输入 ----------
    document.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) >= 0) {
            e.preventDefault();
        }
        keys[e.code] = true;

        if (e.code === 'Space' || e.code === 'Enter') {
            if (state === 'ready' || state === 'over') {
                startGame();
            }
        }
        if (e.code === 'KeyP') {
            togglePause();
        }
    });

    document.addEventListener('keyup', function (e) {
        keys[e.code] = false;
    });

    function canvasPos(e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (state === 'ready' || state === 'over') {
            startGame();
        }
        var p = canvasPos(e);
        pointer.active = true;
        pointer.x = p.x;
        pointer.y = p.y;
    });

    canvas.addEventListener('pointermove', function (e) {
        if (!pointer.active) {
            return;
        }
        var p = canvasPos(e);
        pointer.x = p.x;
        pointer.y = p.y;
    });

    window.addEventListener('pointerup', function () {
        pointer.active = false;
    });

    startBtn.addEventListener('click', function () {
        startGame();
    });

    // 切换标签页时自动暂停，回来不会直接被撞
    window.addEventListener('blur', function () {
        if (state === 'playing') {
            togglePause();
        }
    });

    // ---------- 生成敌机 ----------
    function pickEnemyType() {
        var r = Math.random();
        if (difficulty >= 4 && r < 0.10) {
            return 'elite';
        }
        if (difficulty >= 2 && r < 0.38) {
            return 'mid';
        }
        return 'small';
    }

    function spawnEnemy() {
        var type = pickEnemyType();
        var e = { type: type, phase: Math.random() * 6.28, shootCd: 1.2 + Math.random() };

        if (type === 'small') {
            e.w = 26;
            e.h = 26;
            e.hp = 1;
            e.speed = 130 + difficulty * 12;
            e.score = 100;
        } else if (type === 'mid') {
            e.w = 40;
            e.h = 40;
            e.hp = 3;
            e.speed = 85 + difficulty * 6;
            e.score = 200;
        } else {
            e.w = 56;
            e.h = 56;
            e.hp = 8;
            e.speed = 62 + difficulty * 4;
            e.score = 500;
        }

        e.maxHp = e.hp;
        e.x = 40 + Math.random() * (W - 80);
        e.y = -e.h;
        enemies.push(e);
    }

    // ---------- 玩家射击 ----------
    function shoot() {
        var p = player;
        if (p.power === 1) {
            addPlayerBullet(p.x, p.y - 20, 0);
        } else if (p.power === 2) {
            addPlayerBullet(p.x - 9, p.y - 18, 0);
            addPlayerBullet(p.x + 9, p.y - 18, 0);
        } else {
            addPlayerBullet(p.x, p.y - 22, 0);
            addPlayerBullet(p.x - 11, p.y - 14, -90);
            addPlayerBullet(p.x + 11, p.y - 14, 90);
        }
    }

    function addPlayerBullet(x, y, vx) {
        playerBullets.push({
            x: x,
            y: y,
            vx: vx,
            vy: -640,
            w: 5,
            h: 14,
            dmg: 1
        });
    }

    // ---------- 爆炸粒子 ----------
    function explode(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 40 + Math.random() * 180;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.45 + Math.random() * 0.35,
                maxLife: 0.8,
                size: 2 + Math.random() * 3,
                color: color
            });
        }
    }

    // ---------- 碰撞 ----------
    function isHit(a, b) {
        return Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
            Math.abs(a.y - b.y) < (a.h + b.h) / 2;
    }

    // ---------- 玩家受伤 ----------
    function hurtPlayer() {
        if (player.invincible > 0) {
            return;
        }
        if (player.shield > 0) {
            player.shield = 0;
            player.invincible = 0.8;
            explode(player.x, player.y, '#7ee0ff', 14);
            return;
        }
        player.hp -= 1;
        player.invincible = 1.6;
        explode(player.x, player.y, '#ff8066', 18);
        updateHud();
        if (player.hp <= 0) {
            explode(player.x, player.y, '#ffd166', 40);
            gameOver();
        }
    }

    // ---------- 掉落道具 ----------
    function maybeDropItem(e) {
        var roll = Math.random();
        if (e.type === 'elite') {
            items.push(makeItem(e.x, e.y, roll < 0.7 ? 'power' : 'shield'));
        } else if (e.type === 'mid' && roll < 0.22) {
            items.push(makeItem(e.x, e.y, roll < 0.12 ? 'power' : 'shield'));
        } else if (e.type === 'small' && roll < 0.03) {
            items.push(makeItem(e.x, e.y, 'shield'));
        }
    }

    function makeItem(x, y, kind) {
        return { x: x, y: y, w: 22, h: 22, vy: 95, kind: kind, t: 0 };
    }

    // ---------- 更新 ----------
    function update(dt) {
        elapsed += dt;
        diffTimer += dt;
        if (diffTimer >= 12) {
            diffTimer = 0;
            difficulty += 1;
            spawnInterval = Math.max(340, spawnInterval - 85);
        }

        updateStars(dt);
        updatePlayer(dt);
        updatePlayerBullets(dt);
        updateEnemyBullets(dt);
        updateEnemies(dt);
        updateItems(dt);
        updateParticles(dt);
        handleCollisions();

        spawnTimer += dt * 1000;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnEnemy();
        }
    }

    function updateStars(dt) {
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            s.y += s.speed * dt;
            if (s.y > H) {
                s.y = -2;
                s.x = Math.random() * W;
            }
        }
    }

    function updatePlayer(dt) {
        var p = player;
        var dx = 0;
        var dy = 0;

        if (keys['ArrowLeft'] || keys['KeyA']) {
            dx -= 1;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            dx += 1;
        }
        if (keys['ArrowUp'] || keys['KeyW']) {
            dy -= 1;
        }
        if (keys['ArrowDown'] || keys['KeyS']) {
            dy += 1;
        }

        if (dx !== 0 || dy !== 0) {
            // 斜着走的时候速度归一化，不然斜向会更快
            var len = Math.sqrt(dx * dx + dy * dy);
            p.x += (dx / len) * p.speed * dt;
            p.y += (dy / len) * p.speed * dt;
            pointer.x = p.x;
            pointer.y = p.y;
        } else if (pointer.active) {
            // 手机拖动：飞机跟着手指走，做一点缓动
            var k = Math.min(1, dt * 16);
            p.x += (pointer.x - p.x) * k;
            p.y += (pointer.y - p.y) * k;
        }

        // 限制在画面内
        p.x = Math.max(20, Math.min(W - 20, p.x));
        p.y = Math.max(60, Math.min(H - 30, p.y));

        if (p.invincible > 0) {
            p.invincible -= dt;
        }

        // 射击冷却
        p.fireCd -= dt;
        var firing = keys['Space'] || pointer.active;
        if (firing && p.fireCd <= 0) {
            shoot();
            p.fireCd = 0.14;
        }
    }

    function updatePlayerBullets(dt) {
        for (var i = playerBullets.length - 1; i >= 0; i--) {
            var b = playerBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.y < -20 || b.x < -20 || b.x > W + 20) {
                playerBullets.splice(i, 1);
            }
        }
    }

    function updateEnemyBullets(dt) {
        for (var i = enemyBullets.length - 1; i >= 0; i--) {
            var b = enemyBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
                enemyBullets.splice(i, 1);
            }
        }
    }

    function updateEnemies(dt) {
        for (var i = enemies.length - 1; i >= 0; i--) {
            var e = enemies[i];
            e.y += e.speed * dt;

            // 中型机左右摆动
            if (e.type === 'mid') {
                e.x += Math.sin(elapsed * 2 + e.phase) * 45 * dt;
            }
            e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));

            // 中型和精英机会开火
            if (e.type !== 'small' && e.y > 0) {
                e.shootCd -= dt;
                if (e.shootCd <= 0) {
                    e.shootCd = e.type === 'elite' ? 1.8 : 2.2;
                    enemyShoot(e);
                }
            }

            if (e.y > H + e.h) {
                enemies.splice(i, 1);
            }
        }
    }

    function enemyShoot(e) {
        if (e.type === 'mid') {
            aimAtPlayer(e.x, e.y, 200);
        } else {
            // 精英机打三发扇形
            for (var i = -1; i <= 1; i++) {
                var angle = Math.PI / 2 + i * 0.32;
                enemyBullets.push({
                    x: e.x,
                    y: e.y + 20,
                    vx: Math.cos(angle) * 200,
                    vy: Math.sin(angle) * 200,
                    w: 10,
                    h: 10
                });
            }
        }
    }

    function aimAtPlayer(x, y, speed) {
        var dx = player.x - x;
        var dy = player.y - y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        enemyBullets.push({
            x: x,
            y: y,
            vx: (dx / len) * speed,
            vy: (dy / len) * speed,
            w: 10,
            h: 10
        });
    }

    function updateItems(dt) {
        for (var i = items.length - 1; i >= 0; i--) {
            var it = items[i];
            it.y += it.vy * dt;
            it.t += dt;
            if (it.y > H + 30) {
                items.splice(i, 1);
            }
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    // ---------- 碰撞处理 ----------
    function handleCollisions() {
        var i, j;

        // 子弹打敌机
        for (i = playerBullets.length - 1; i >= 0; i--) {
            var b = playerBullets[i];
            for (j = enemies.length - 1; j >= 0; j--) {
                var e = enemies[j];
                if (isHit(b, e)) {
                    e.hp -= b.dmg;
                    playerBullets.splice(i, 1);
                    explode(b.x, b.y, '#ffe082', 4);
                    if (e.hp <= 0) {
                        score += e.score;
                        explode(e.x, e.y, e.type === 'elite' ? '#c08bff' : '#ff8066',
                            e.type === 'small' ? 10 : 22);
                        maybeDropItem(e);
                        enemies.splice(j, 1);
                        updateHud();
                    }
                    break;
                }
            }
        }

        // 敌机子弹打玩家
        for (i = enemyBullets.length - 1; i >= 0; i--) {
            if (isHit(enemyBullets[i], player)) {
                enemyBullets.splice(i, 1);
                hurtPlayer();
            }
        }

        // 敌机撞玩家
        for (i = enemies.length - 1; i >= 0; i--) {
            if (isHit(enemies[i], player)) {
                explode(enemies[i].x, enemies[i].y, '#ff8066', 16);
                enemies.splice(i, 1);
                hurtPlayer();
            }
        }

        // 吃道具
        for (i = items.length - 1; i >= 0; i--) {
            if (isHit(items[i], player)) {
                if (items[i].kind === 'power') {
                    player.power = Math.min(3, player.power + 1);
                } else {
                    player.shield = 1;
                }
                explode(items[i].x, items[i].y, items[i].kind === 'power' ? '#8bff9e' : '#7ee0ff', 10);
                items.splice(i, 1);
            }
        }
    }

    // ---------- 绘制 ----------
    function drawBackground() {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#101a30');
        g.addColorStop(0.6, '#0a1222');
        g.addColorStop(1, '#060a13');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = '#dff1ff';
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
    }

    function drawPlayer() {
        var p = player;
        // 无敌时闪烁
        if (p.invincible > 0 && Math.floor(p.invincible * 12) % 2 === 0) {
            return;
        }

        ctx.save();
        ctx.translate(p.x, p.y);

        // 尾焰
        ctx.fillStyle = 'rgba(255, 170, 60, 0.9)';
        ctx.beginPath();
        ctx.moveTo(-5, 16);
        ctx.lineTo(0, 24 + Math.random() * 8);
        ctx.lineTo(5, 16);
        ctx.closePath();
        ctx.fill();

        // 机翼
        ctx.fillStyle = '#3aa6d6';
        ctx.beginPath();
        ctx.moveTo(-8, 4);
        ctx.lineTo(-19, 16);
        ctx.lineTo(-6, 12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, 4);
        ctx.lineTo(19, 16);
        ctx.lineTo(6, 12);
        ctx.closePath();
        ctx.fill();

        // 机身
        ctx.fillStyle = '#8ce9ff';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(9, 8);
        ctx.lineTo(0, 3);
        ctx.lineTo(-9, 8);
        ctx.closePath();
        ctx.fill();

        // 驾驶舱
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -4, 3, 0, Math.PI * 2);
        ctx.fill();

        // 护盾
        if (p.shield > 0) {
            ctx.strokeStyle = 'rgba(126, 224, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 27, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawEnemies() {
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            ctx.save();
            ctx.translate(e.x, e.y);

            if (e.type === 'small') {
                ctx.fillStyle = '#ff6b6b';
                ctx.beginPath();
                ctx.moveTo(0, 13);
                ctx.lineTo(11, -10);
                ctx.lineTo(0, -4);
                ctx.lineTo(-11, -10);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffd166';
                ctx.fillRect(-3, -2, 6, 6);
            } else if (e.type === 'mid') {
                ctx.fillStyle = '#ff9f43';
                ctx.beginPath();
                ctx.moveTo(0, 20);
                ctx.lineTo(18, 2);
                ctx.lineTo(12, -16);
                ctx.lineTo(-12, -16);
                ctx.lineTo(-18, 2);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffd166';
                ctx.beginPath();
                ctx.arc(0, 2, 6, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#a56bff';
                ctx.beginPath();
                ctx.moveTo(0, 28);
                ctx.lineTo(22, 10);
                ctx.lineTo(28, -12);
                ctx.lineTo(0, -24);
                ctx.lineTo(-28, -12);
                ctx.lineTo(-22, 10);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffd166';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // 血条（只有被打过才显示）
            if (e.type !== 'small' && e.hp < e.maxHp) {
                var bw = e.w;
                var bx = e.x - bw / 2;
                var by = e.y - e.h / 2 - 8;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(bx, by, bw, 4);
                ctx.fillStyle = '#7ee0ff';
                ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
            }
        }
    }

    function drawBullets() {
        var i;
        for (i = 0; i < playerBullets.length; i++) {
            var b = playerBullets[i];
            ctx.fillStyle = '#ffe082';
            ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        }
        for (i = 0; i < enemyBullets.length; i++) {
            var e = enemyBullets[i];
            ctx.fillStyle = '#ff7eb6';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.w / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawItems() {
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var isPower = it.kind === 'power';
            var color = isPower ? '#8bff9e' : '#7ee0ff';

            // 上下轻微浮动
            var offset = Math.sin(it.t * 6) * 3;
            ctx.save();
            ctx.translate(it.x, it.y + offset);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isPower ? 'P' : 'S', 0, 1);
            ctx.restore();
        }
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function draw() {
        drawBackground();
        if (state === 'ready') {
            // 开始界面也画一架飞机当背景
            if (player) {
                drawPlayer();
            }
            return;
        }
        drawItems();
        drawEnemies();
        drawBullets();
        drawPlayer();
        drawParticles();
    }

    // ---------- 主循环 ----------
    function loop(now) {
        if (!lastTime) {
            lastTime = now;
        }
        var dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        if (state === 'playing') {
            update(dt);
        }
        draw();
        requestAnimationFrame(loop);
    }

    // ---------- 启动 ----------
    initStars();
    resetGame();
    state = 'ready';
    overlay.classList.remove('hide');
    requestAnimationFrame(loop);
})();

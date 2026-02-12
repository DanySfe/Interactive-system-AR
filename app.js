document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    const state = {
        name: '',
        socialId: '',
        baseScore: 0,
        crimes: [],
        finalScore: 0,
        penaltyTotal: 0,
        verdict: null, // 'utopia' | 'dystopia'
        scanComplete: false
    };
    let trackerTask = null;

    const CRIME_DATABASE = [
        { name: 'PETTY THEFT', points: 30 },
        { name: 'VANDALISM (CLASS C)', points: 45 },
        { name: 'UNAUTHORIZED SURVEILLANCE', points: 80 },
        { name: 'DIGITAL FRAUD', points: 120 },
        { name: 'ASSAULT', points: 150 },
        { name: 'CYBER TERRORISM', points: 200 },
        { name: 'CONTRABAND POSSESSION', points: 90 },
        { name: 'CURFEW VIOLATION', points: 20 },
        { name: 'PUBLIC ENDANGERMENT', points: 110 },
        { name: 'INSUBORDINATION', points: 60 },
        { name: 'DATA TRAFFICKING', points: 140 },
        { name: 'REPEAT OFFENSE', points: 50 },
        { name: 'RESOURCE HOARDING', points: 75 }
    ];

    // --- DOM ELEMENTS ---
    const screens = {
        identity: document.getElementById('screen-identity'),
        processing: document.getElementById('screen-processing'),
        verdict: document.getElementById('screen-verdict')
    };

    const inputs = {
        name: document.getElementById('citizen-name'),
        btnStart: document.getElementById('btn-start'),
        btnVerdict: document.getElementById('btn-verdict'),
        btnRestart: document.getElementById('btn-restart'),
        btnReview: document.getElementById('btn-review')
    };

    const display = {
        name: document.getElementById('display-name'),
        id: document.getElementById('display-id'),
        crimeList: document.getElementById('crime-list'),
        baseScore: document.getElementById('score-base'),
        penaltyScore: document.getElementById('score-penalty'),
        totalScore: document.getElementById('score-total'),
        verdictTitle: document.getElementById('verdict-title'),
        verdictMsg: document.getElementById('verdict-message'),
        finalScore: document.getElementById('verdict-score'),
        statusBox: document.getElementById('verdict-status')
    };

    const media = {
        video: document.getElementById('camera-feed'),
        canvas: document.getElementById('photo-canvas'),
        fallback: document.getElementById('camera-fallback'),
        overlay: document.getElementById('scan-overlay')
    };

    // --- INIT ---
    function init() {
        if (inputs.btnStart) inputs.btnStart.addEventListener('click', handleStart);
        if (inputs.btnVerdict) inputs.btnVerdict.addEventListener('click', showVerdict);
        if (inputs.btnRestart) inputs.btnRestart.addEventListener('click', restartSystem);
        if (inputs.btnReview) inputs.btnReview.addEventListener('click', returnToProfile);

        // Enter key support
        if (inputs.name) {
            inputs.name.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleStart();
            });
        }

        initParticles();

        // Fix: Update effect canvases on resize to prevent stretching with DPI
        window.addEventListener('resize', () => {
            const dpr = window.devicePixelRatio || 1;
            ['dystopia-hazard', 'utopia-fireworks'].forEach(id => {
                const c = document.getElementById(id);
                if (c) {
                    c.width = window.innerWidth * dpr;
                    c.height = window.innerHeight * dpr;
                    const ctx = c.getContext('2d');
                    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
                    ctx.scale(dpr, dpr);
                }
            });
        });
    }

    // --- HANDLERS ---
    function handleStart() {
        const name = inputs.name.value.trim().toUpperCase();
        if (!name) {
            alert('IDENTITY REQUIRED');
            return;
        }

        state.name = name;
        generateProfileData();
        switchScreen('processing');
        startScanningProcess();
    }

    function switchScreen(screenName) {
        // Hide all
        Object.values(screens).forEach(s => {
            if (s) {
                s.classList.remove('active');
                s.classList.add('hidden');
            }
        });

        // Show target
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
            setTimeout(() => {
                screens[screenName].classList.add('active');
            }, 50);
        }
    }

    // --- LOGIC ---
    // Robust Alternating Logic: Even = Utopia, Odd = Dystopia
    let runCount = parseInt(localStorage.getItem('run_count') || '0');
    let forceUtopia = (runCount % 2 === 0);
    localStorage.setItem('run_count', (runCount + 1).toString());

    console.log(`System Run #${runCount}: Target ${forceUtopia ? 'UTOPIA' : 'DYSTOPIA'}`);

    function generateProfileData() {
        // 1. Social ID
        state.socialId = Math.floor(Math.random() * 900000000 + 100000000).toString()
            .replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');

        // 2. Rigid Alternating Logic
        if (forceUtopia) {
            // UTOPIA: High base, few crimes
            state.baseScore = Math.floor(Math.random() * 150) + 750; // 750-900

            // 0-1 minor crimes
            state.crimes = [];
            if (Math.random() > 0.5) {
                const minorCrimes = CRIME_DATABASE.filter(c => c.points < 50);
                if (minorCrimes.length > 0) {
                    state.crimes.push(minorCrimes[Math.floor(Math.random() * minorCrimes.length)]);
                }
            }
        } else {
            // DYSTOPIA: Low base, heavy crimes
            state.baseScore = Math.floor(Math.random() * 200) + 250; // 250-450

            // 3-5 heavy crimes
            state.crimes = [];
            const crimeCount = Math.floor(Math.random() * 3) + 3;
            const crimePool = [...CRIME_DATABASE];

            for (let i = 0; i < crimeCount; i++) {
                if (crimePool.length === 0) break;
                const idx = Math.floor(Math.random() * crimePool.length);
                state.crimes.push(crimePool[idx]);
                crimePool.splice(idx, 1);
            }
        }



        // 4. Calculate final
        state.penaltyTotal = state.crimes.reduce((acc, c) => acc + c.points, 0);
        let rawScore = state.baseScore - state.penaltyTotal;
        // Clamp 0-999
        state.finalScore = Math.max(0, Math.min(999, rawScore));

        // 5. Verdict
        state.verdict = state.finalScore >= 500 ? 'utopia' : 'dystopia';
        localStorage.setItem('last_verdict', state.verdict);
    }

    // --- SCANNING ---
    async function startScanningProcess() {
        // Stop any existing tracking to prevent instant snap
        if (trackerTask) {
            trackerTask.stop();
            trackerTask = null;
        }

        // Reset UI
        if (inputs.btnVerdict) inputs.btnVerdict.classList.add('disabled');
        state.scanComplete = false;

        // Initialize Map Now (Panel Visible)
        setTimeout(initMap, 100);

        // Populate static data immediately? No, wait for scan.
        display.name.textContent = 'SCANNING...';
        display.id.textContent = 'SCANNING...';
        display.baseScore.textContent = '...';
        display.penaltyScore.textContent = '...';
        display.totalScore.textContent = 'CALCULATING...';
        display.crimeList.innerHTML = '';

        // Start Camera
        try {
            console.log("Requesting camera access...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });

            media.video.srcObject = stream;
            media.video.onloadedmetadata = () => {
                media.video.play().catch(e => console.error("Play error:", e));
                initFaceTracking(); // Start tracking
            };

            media.video.classList.remove('hidden');
            media.fallback.style.display = 'none';
        } catch (err) {
            console.warn('Camera Access Failed:', err);
            alert("SYSTEM ERROR: Camera Device Not Found or Access Denied.\n\nSimulating with Fallback Mode.");

            media.fallback.style.display = 'flex';
            media.video.classList.add('hidden');

            // Fallback timer if camera fails
            setTimeout(finalizeScan, 3000);
        }

        // Animation
        media.overlay.classList.add('active'); // Show scan lines
    }

    function initFaceTracking() {
        if (typeof tracking === 'undefined') {
            console.warn("Tracking.js not loaded. Fallback to timer.");
            setTimeout(finalizeScan, 3000);
            return;
        }

        const tracker = new tracking.ObjectTracker('face');
        tracker.setInitialScale(2.0); // Detection range expanded
        tracker.setStepSize(1.5); // More sensitive
        tracker.setEdgesDensity(0.1);

        try {
            trackerTask = tracking.track('#camera-feed', tracker);
        } catch (e) { console.error("Tracking init error", e); setTimeout(finalizeScan, 3000); return; }

        let stabilityCount = 0;
        const scanText = document.querySelector('.scan-text');
        const meshContainer = document.getElementById('face-mesh-container');

        tracker.on('track', function (event) {
            if (state.scanComplete) return;

            if (event.data.length === 0) {
                // Decay fast if lost
                stabilityCount = Math.max(0, stabilityCount - 2);
                if (scanText && stabilityCount === 0) {
                    scanText.textContent = "SEARCHING FOR SUBJECT...";
                    scanText.style.color = "#fff";
                    scanText.style.borderColor = "var(--neon-cyan)";
                }
                // Center if lost
                if (meshContainer) {
                    meshContainer.style.left = '50%';
                    meshContainer.style.top = '50%';
                    meshContainer.style.opacity = '0.5';
                }
            } else {
                // RAPID LOCK ON
                stabilityCount += 5;
                const face = event.data[0];

                if (meshContainer) {
                    const videoEl = document.getElementById('camera-feed');
                    if (videoEl) {
                        const vw = videoEl.offsetWidth;
                        const vh = videoEl.offsetHeight;

                        const centerX = face.x + (face.width / 2);
                        const centerY = face.y + (face.height / 2);

                        // Mirror logic: 100% - X%
                        const leftObj = 100 - ((centerX / vw) * 100);
                        const topObj = (centerY / vh) * 100;

                        meshContainer.style.left = `${leftObj}%`;
                        meshContainer.style.top = `${topObj}%`;
                        meshContainer.style.opacity = '1';

                        // Scale mesh based on face width (approx 150px ref)
                        // Make mesh visually larger too (1.2x baseline)
                        const scale = Math.max(1.0, Math.min(1.8, (face.width / 150) * 1.2));
                        meshContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
                    }
                }

                if (scanText) {
                    // Visual percent
                    const percent = Math.min(100, Math.floor((stabilityCount / 20) * 100));
                    scanText.textContent = `SUBJECT DETECTED... ANALYZING (${percent}%)`;
                    scanText.style.color = "var(--neon-green)";
                    scanText.style.borderColor = "var(--neon-green)";
                }

                // Threshold ~4 frames
                if (stabilityCount > 20) {
                    state.scanComplete = true;
                    if (trackerTask) trackerTask.stop(); // Stop scanning
                    finalizeScan();
                }
            }
        });

        // Failsafe
        setTimeout(() => {
            if (!state.scanComplete) {
                if (trackerTask) trackerTask.stop();
                finalizeScan();
            }
        }, 15000);
    }

    function finalizeScan() {
        // Freeze frame
        if (media.video.srcObject) {
            const context = media.canvas.getContext('2d');
            media.canvas.width = media.video.videoWidth;
            media.canvas.height = media.video.videoHeight;
            context.drawImage(media.video, 0, 0, media.canvas.width, media.canvas.height);

            // Stop stream
            const tracks = media.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());

            // Show canvas, hide video
            media.video.classList.add('hidden');
            media.canvas.classList.remove('hidden');
        }

        media.overlay.classList.remove('active');
        state.scanComplete = true;

        populateProfileUI();
    }

    function populateProfileUI() {
        // Typewriter effect simulation or just text
        display.name.textContent = state.name;
        display.id.textContent = state.socialId;

        // Render Crimes
        state.crimes.forEach(crime => {
            const li = document.createElement('li');
            li.className = 'crime-item';
            li.innerHTML = `
                <span>${crime.name}</span>
                <span class="crime-points">-${crime.points}</span>
            `;
            display.crimeList.appendChild(li);
        });

        display.baseScore.textContent = state.baseScore;
        display.penaltyScore.textContent = `-${state.penaltyTotal}`;

        // Animate count up for total score
        animateValue(display.totalScore, 0, state.finalScore, 1000);

        // Enable button
        setTimeout(() => {
            inputs.btnVerdict.classList.remove('disabled');
        }, 1000);
    }

    function showVerdict() {
        switchScreen('verdict');

        // Determine Theme
        document.body.className = ''; // reset

        // Map elements
        const mapTarget = document.getElementById('map-target');
        const mapOverlay = document.querySelector('.map-overlay-text');

        setTimeout(() => {
            if (state.verdict === 'utopia') {
                document.body.classList.add('state-utopia');
                display.verdictTitle.textContent = 'UTOPIA';
                display.statusBox.textContent = 'ACCESS GRANTED';
                display.verdictMsg.textContent = `Citizen ${state.name} has been cleared for entry into the High-Value Residential Zone.`;

                // Map Animation
                if (mapTarget) {
                    mapTarget.setAttribute('transform', 'translate(80, 140)'); // Utopia coords
                    mapTarget.classList.remove('hidden');
                }
                triggerUtopiaEffects();
                if (mapOverlay) mapOverlay.textContent = 'TARGET LOCKED: SECTOR 1';

            } else {
                document.body.classList.add('state-dystopia');
                display.verdictTitle.textContent = 'DYSTOPIA';
                display.statusBox.textContent = 'ACCESS DENIED';
                display.verdictMsg.textContent = `Citizen ${state.name} has failed the social credit requirements. Relocation to Restricted Sector 7 immediately.`;

                // Map Animation
                if (mapTarget) {
                    mapTarget.classList.remove('hidden');
                    mapTarget.setAttribute('transform', 'translate(300, 120)'); // Dystopia coords
                }
                triggerDystopiaEffects();
                if (mapOverlay) mapOverlay.textContent = 'TARGET LOCKED: SECTOR 7';
            }
            display.finalScore.textContent = state.finalScore.toString().padStart(3, '0');
        }, 500);
    }

    function restartSystem() {
        // Full System Reboot to clear all artifacts and reset viewport
        document.body.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        document.body.style.opacity = '0';
        document.body.style.transform = 'scale(0.95)'; // Shrink effect

        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    function returnToProfile() {
        document.body.className = '';
        switchScreen('processing');
        // Data persists, so no need to regen
    }

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // --- MAP ---
    function initMap() {
        const canvas = document.getElementById('mapCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Wait for layout
        setTimeout(() => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0) return; // Hidden or not layouted yet

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);

            // Background
            ctx.fillStyle = '#050a10';
            ctx.fillRect(0, 0, rect.width, rect.height);

            // Grid
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
            ctx.lineWidth = 1;

            const step = 40;
            for (let x = 0; x < rect.width; x += step) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke();
            }
            for (let y = 0; y < rect.height; y += step) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
            }

            // Utopia (Left Side) - Cyan Buildings
            for (let i = 0; i < 30; i++) {
                const w = Math.random() * 50 + 10;
                const h = Math.random() * 50 + 10;
                const x = Math.random() * ((rect.width / 2) - w - 20) + 20;
                const y = Math.random() * (rect.height - h - 20) + 10;

                ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
                ctx.strokeStyle = '#0ff';
                ctx.lineWidth = 1;

                ctx.fillRect(x, y, w, h);
                ctx.strokeRect(x, y, w, h);
            }

            // Dystopia (Right Side) - Red/Dark Buildings
            for (let i = 0; i < 30; i++) {
                const w = Math.random() * 60 + 20;
                const h = Math.random() * 60 + 20;
                const x = Math.random() * ((rect.width / 2) - w - 20) + (rect.width / 2);
                const y = Math.random() * (rect.height - h - 20) + 10;

                ctx.fillStyle = 'rgba(255, 7, 58, 0.15)';
                ctx.strokeStyle = '#ff073a';
                ctx.lineWidth = 1;

                ctx.fillRect(x, y, w, h);
                ctx.strokeRect(x, y, w, h);
            }

            // Partition Line
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(rect.width / 2, 0);
            ctx.lineTo(rect.width / 2, rect.height);
            ctx.stroke();
            ctx.setLineDash([]);

            // Labels
            ctx.fillStyle = '#0ff';
            ctx.font = '12px "Share Tech Mono"'; // Ensure font is loaded or use generic
            ctx.fillText("SECTOR A: UTOPIA", 20, 30);

            ctx.fillStyle = '#ff073a';
            ctx.fillText("SECTOR B: DYSTOPIA", rect.width - 150, 30);
        }, 100);
    }

    // --- PARTICLES.JS ---
    function initParticles() {
        if (typeof particlesJS === 'undefined') {
            setTimeout(initParticles, 200);
            return;
        }

        const getParticlesConfig = (colorHex) => ({
            "particles": {
                "number": { "value": 110, "density": { "enable": true, "value_area": 800 } }, /* Increased Density */
                "color": { "value": colorHex },
                "shape": { "type": "circle" },
                "opacity": { "value": 1, "random": true }, /* MAX BRIGHTNESS */
                "size": { "value": 4, "random": true }, /* Larger */
                "line_linked": {
                    "enable": true,
                    "distance": 160,
                    "color": colorHex,
                    "opacity": 0.9, /* VERY BRIGHT LINES */
                    "width": 1.5
                },
                "move": {
                    "enable": true,
                    "speed": 1.5,
                    "direction": "none",
                    "random": true,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false
                }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": {
                    "onhover": { "enable": true, "mode": "grab" },
                    "onclick": { "enable": true, "mode": "push" },
                    "resize": true
                },
                "modes": {
                    "grab": { "distance": 180, "line_linked": { "opacity": 1 } }
                }
            },
            "retina_detect": true
        });

        // Left Side: Utopia (Cyan)
        particlesJS('particles-left', getParticlesConfig('#00ffff'));

        // Right Side: Dystopia (Red)
        particlesJS('particles-right', getParticlesConfig('#ff073a'));
    }

    // --- UTOPIA EFFECTS ---
    function triggerUtopiaEffects() {
        const canvas = document.getElementById('utopia-fireworks');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Fix Stretch: Use DPI
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        let fireworks = [];
        let particles = [];

        class Firework {
            constructor() {
                this.x = Math.random() * w;
                this.y = h;
                this.targetY = Math.random() * (h * 0.4);
                this.speed = 12 + Math.random() * 5;
                this.angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.2;
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
                this.gravity = 0.05;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vy += this.gravity;
            }
            draw() {
                ctx.fillStyle = '#00ffff';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        class Particle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.angle = Math.random() * Math.PI * 2;
                this.speed = Math.random() * 6 + 2;
                this.friction = 0.95;
                this.gravity = 0.1;
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
                this.alpha = 1;
                this.decay = Math.random() * 0.015 + 0.005;
            }
            update() {
                this.vx *= this.friction;
                this.vy *= this.friction;
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;
            }
            draw() {
                ctx.save();
                ctx.globalAlpha = this.alpha;
                ctx.fillStyle = '#00ffff';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        function loop() {
            if (!document.body.classList.contains('state-utopia')) {
                ctx.clearRect(0, 0, canvas.width, canvas.height); // Logical clear
                return;
            }

            // Fade
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, w, h); // Use logical w/h

            if (Math.random() < 0.05) fireworks.push(new Firework());

            for (let i = fireworks.length - 1; i >= 0; i--) {
                fireworks[i].update();
                fireworks[i].draw();

                if (fireworks[i].vy >= 0 || fireworks[i].y <= fireworks[i].targetY) {
                    // Explode
                    for (let j = 0; j < 50; j++) particles.push(new Particle(fireworks[i].x, fireworks[i].y));
                    fireworks.splice(i, 1);
                }
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update();
                particles[i].draw();
                if (particles[i].alpha <= 0) particles.splice(i, 1);
            }

            requestAnimationFrame(loop);
        }
        loop();
    }

    // --- DYSTOPIA EFFECTS ---
    function triggerDystopiaEffects() {
        const canvas = document.getElementById('dystopia-hazard');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Fix Stretch: Use DPI
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        let symbols = [];
        const chars = "⚠☣☠✖⛔";

        class HazardSymbol {
            constructor() {
                this.x = Math.random() * w;
                this.y = -50;
                this.speed = Math.random() * 8 + 5;
                this.text = chars[Math.floor(Math.random() * chars.length)];
                this.size = Math.random() * 60 + 20;
                this.opacity = Math.random() * 0.8 + 0.2;
            }
            update() {
                this.y += this.speed;
                // Jitter
                this.x += (Math.random() - 0.5) * 5;
            }
            draw() {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff0000';
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = '#ff073a';
                ctx.font = `bold ${this.size}px Arial`;
                ctx.fillText(this.text, this.x, this.y);
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
            }
        }

        function loop() {
            if (!document.body.classList.contains('state-dystopia')) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            // Trail
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, w, h);

            // Flash
            if (Math.random() < 0.03) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                ctx.fillRect(0, 0, w, h);
            }

            if (Math.random() < 0.15) symbols.push(new HazardSymbol());

            for (let i = symbols.length - 1; i >= 0; i--) {
                symbols[i].update();
                symbols[i].draw();
                if (symbols[i].y > h + 50) symbols.splice(i, 1);
            }

            requestAnimationFrame(loop);
        }
        loop();
    }

    init();
});

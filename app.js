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
    let forceUtopia = true; // Toggle for alternating verdicts

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

        // Flip the toggle for next person
        forceUtopia = !forceUtopia;

        // 4. Calculate final
        state.penaltyTotal = state.crimes.reduce((acc, c) => acc + c.points, 0);
        let rawScore = state.baseScore - state.penaltyTotal;
        // Clamp 0-999
        state.finalScore = Math.max(0, Math.min(999, rawScore));

        // 5. Verdict
        state.verdict = state.finalScore >= 500 ? 'utopia' : 'dystopia';
    }

    // --- SCANNING ---
    async function startScanningProcess() {
        // Reset UI
        inputs.btnVerdict.classList.add('disabled');
        state.scanComplete = false;

        // Populate static data immediately? No, wait for scan.
        display.name.textContent = 'SCANNING...';
        display.id.textContent = 'SCANNING...';
        display.baseScore.textContent = '...';
        display.penaltyScore.textContent = '...';
        display.totalScore.textContent = 'CALCULATING...';
        display.crimeList.innerHTML = '';

        // Start Camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            media.video.srcObject = stream;
            media.video.play();
            media.fallback.style.display = 'none';
        } catch (err) {
            console.warn('Camera denied:', err);
            media.fallback.style.display = 'flex';
        }

        // Animation
        media.overlay.classList.add('active'); // Show scan lines

        // Scan duration 2.5s
        setTimeout(finalizeScan, 2500);
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
                    mapTarget.classList.remove('hidden');
                    mapTarget.setAttribute('transform', 'translate(80, 140)'); // Utopia coords
                }
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
                if (mapOverlay) mapOverlay.textContent = 'TARGET LOCKED: SECTOR 7';
            }
            display.finalScore.textContent = state.finalScore.toString().padStart(3, '0');
        }, 500);
    }

    function restartSystem() {
        // Clear state
        state.name = '';
        state.socialId = '';
        state.crimes = [];
        inputs.name.value = '';
        document.body.className = ''; // remove theme classes

        // Reset Video UI
        media.canvas.classList.add('hidden');
        media.video.classList.remove('hidden');
        media.video.srcObject = null;

        switchScreen('identity');
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

    init();
});

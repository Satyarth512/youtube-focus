console.log("YouTube Focus: Content Script Active");

let scrapeAttempts = 0;

// Run on load and on navigation (SPA)
// Run on load and on navigation (SPA)
window.addEventListener('load', init);
// Use a more nuanced observer or interval to check for navigation
setInterval(init, 1000);

// GLOBAL EVENT DELEGATION
// This replaces individual event listeners to fix issues where elements are replaced/re-rendered
document.addEventListener('click', async (e) => {
    // 1. Handle "Course Settings" Button
    if (e.target.closest('#yt-course-menu')) {
        e.preventDefault();
        e.stopImmediatePropagation();

        // Fetch fresh data from storage to ensure we have the latest state
        chrome.storage.local.get(['currentCourse', 'currentModuleIndex'], (data) => {
            if (data.currentCourse) {
                showCourseMenu(data.currentCourse, data.currentModuleIndex || 0);
            } else {
                alert("No active course found.");
            }
        });
        return;
    }

    // 2. Handle "Start Module" Button
    if (e.target.closest('#yt-start-module')) {
        e.preventDefault();
        chrome.storage.local.get(['currentCourse', 'currentModuleIndex'], async (data) => {
            if (data.currentCourse) {
                const index = data.currentModuleIndex || 0;
                const module = data.currentCourse.modules[index];
                if (module) {
                    const query = encodeURIComponent(module.searchQuery);
                    await chrome.storage.local.set({ isAutosurfing: true });
                    window.location.href = `https://www.youtube.com/results?search_query=${query}`;
                }
            }
        });
        return;
    }

    // 3. Handle "Clear Course" Button
    if (e.target.closest('#clear-course')) {
        e.preventDefault();
        await chrome.storage.local.remove(['currentCourse', 'currentModuleIndex']);
        location.reload();
        return;
    }

    // 4. Handle "Recalculate/Distraction" Clicks (Delegated inside setupDistractionGuard already, but can be moved here if needed)
}, true);

// Helper Functions - Course Menu & History
function showCourseMenu(course, currentIndex) {
    console.log('[DEBUG] showCourseMenu called with:', course, currentIndex);
    window.lastCourse = course; // debug export

    const menuOverlay = document.createElement('div');
    Object.assign(menuOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.95)', zIndex: '2147483647',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    });

    menuOverlay.innerHTML = `
        <div style="background:#1a1a1a; padding:40px; border-radius:12px; max-width:500px; color:white;">
            <h2>Course Settings</h2>
            <p style="margin:20px 0;">Current: ${course.courseTitle}</p>
            <p style="margin:20px 0;">Progress: Module ${currentIndex + 1} of ${course.modules.length}</p>
            
            <button id="menu-resume" style="width:100%; padding:15px; margin:10px 0; font-size:16px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer;">
                ▶️ Resume Learning
            </button>
            
            <button id="menu-pause" style="width:100%; padding:15px; margin:10px 0; font-size:16px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer;">
                ⏸️ Pause Course (Free Browse)
            </button>
            
            <button id="menu-switch" style="width:100%; padding:15px; margin:10px 0; font-size:16px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer;">
                🔄 Switch to New Course
            </button>
            
            <button id="menu-abandon" style="width:100%; padding:15px; margin:10px 0; font-size:16px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer;">
                🗑️ Abandon Course
            </button>
        </div>
    `;

    document.body.appendChild(menuOverlay);

    document.getElementById('menu-resume').addEventListener('click', () => {
        menuOverlay.remove();
    });

    document.getElementById('menu-pause').addEventListener('click', async () => {
        await chrome.storage.local.set({ coursePaused: true });
        alert('Course paused. You can browse freely. Come back to resume anytime!');
        menuOverlay.remove();
        document.getElementById('yt-focus-guard').remove();
        document.body.style.overflow = '';
    });

    document.getElementById('menu-switch').addEventListener('click', async () => {
        const confirmed = confirm('Save your progress and start a new course?');
        if (confirmed) {
            await chrome.storage.local.get(['courseHistory'], (data) => {
                const history = data.courseHistory || [];
                history.push({
                    course: course,
                    lastModule: currentIndex,
                    pausedAt: new Date().toISOString()
                });
                chrome.storage.local.set({ courseHistory: history });
            });
            await chrome.storage.local.remove(['currentCourse', 'currentModuleIndex']);
            location.reload();
        }
    });

    document.getElementById('menu-abandon').addEventListener('click', async () => {
        const confirmed = confirm('Are you sure? All progress will be lost.');
        if (confirmed) {
            await chrome.storage.local.remove(['currentCourse', 'currentModuleIndex', 'watchHistory']);
            location.reload();
        }
    });
}

function trackVideoWatch(videoTitle, wasRelevant) {
    chrome.storage.local.get(['watchHistory'], (data) => {
        const history = data.watchHistory || [];
        history.push({
            title: videoTitle,
            timestamp: new Date().toISOString(),
            wasRelevant: wasRelevant
        });
        if (history.length > 20) history.shift();
        chrome.storage.local.set({ watchHistory: history });
    });
}

function checkForRabbitHole() {
    chrome.storage.local.get(['watchHistory'], (data) => {
        const history = data.watchHistory || [];
        const recent = history.slice(-3);
        const allOffTopic = recent.every(v => !v.wasRelevant);
        if (allOffTopic && recent.length === 3) {
            alert('🐰 Rabbit Hole Detected! Refocus on your learning!');
        }
    });
}

// Main Logic
async function init() {
    const isHome = window.location.pathname === '/';
    const isResults = window.location.pathname === '/results';

    // Persistent check for active course
    chrome.storage.local.get(['currentCourse', 'currentModuleIndex', 'isAutosurfing'], async (data) => {

        // SCENARIO 1: We are Autosurfing (Just landed on Search Results)
        if (isResults && data.isAutosurfing) {
            // User manually navigated to search results for this module
            // Just remove the overlay and let them choose
            await chrome.storage.local.set({ isAutosurfing: false });
            scrapeAttempts = 0;

            const existing = document.getElementById('yt-focus-guard');
            if (existing) {
                existing.remove();
                document.body.style.overflow = '';
            }

            // Show a small notification
            const notification = document.createElement('div');
            Object.assign(notification.style, {
                position: 'fixed', top: '20px', right: '20px', zIndex: '9999',
                backgroundColor: '#4CAF50', color: 'white', padding: '15px 25px',
                borderRadius: '8px', fontSize: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            });
            notification.innerText = '✅ Choose your video from the results below';
            document.body.appendChild(notification);

            setTimeout(() => notification.remove(), 3000);
            return;
        }

        // SCENARIO 2: Home Page or General Block
        if (isHome) {
            // Safety removed to allow navigation to persist flag
            createOverlay();
        } else if (window.location.pathname === '/watch') {
            // We are watching a video. Remove the guard!
            const existing = document.getElementById('yt-focus-guard');
            if (existing) {
                existing.remove();
                document.body.style.overflow = '';
            }

            // Inject "Complete Module" Button
            chrome.storage.local.get(['currentCourse', 'currentModuleIndex'], (data) => {
                if (data.currentCourse && typeof data.currentModuleIndex === 'number') {
                    const btnId = 'yt-complete-module-btn';
                    if (document.getElementById(btnId)) return;

                    const btn = document.createElement('button');
                    btn.id = btnId;
                    btn.innerText = "✅ Complete Module";
                    Object.assign(btn.style, {
                        position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999',
                        padding: '15px 25px', fontSize: '16px', fontWeight: 'bold',
                        backgroundColor: '#4CAF50', color: 'white', border: 'none',
                        borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    });

                    btn.addEventListener('click', async () => {
                        const moduleTitle = data.currentCourse.modules[data.currentModuleIndex].title;
                        btn.innerText = "Generating Quiz...";
                        btn.disabled = true;

                        // Get API Key and generate quiz
                        chrome.storage.local.get(['apiKey'], (items) => {
                            chrome.runtime.sendMessage({
                                action: "generateQuiz",
                                moduleTitle: moduleTitle,
                                apiKey: items.apiKey
                            }, (quizData) => {
                                if (quizData.error) {
                                    console.error('Quiz generation failed:', quizData.error);
                                    // Fallback: Use a generic quiz
                                    const fallbackQuiz = {
                                        questions: [
                                            {
                                                question: `What did you learn about ${moduleTitle}?`,
                                                options: [
                                                    "I understood the core concepts",
                                                    "I need to review this topic",
                                                    "I found it challenging",
                                                    "I'm ready to move forward"
                                                ],
                                                correct: 0,
                                                explanation: "Great! Reflection is key to learning."
                                            },
                                            {
                                                question: "How confident do you feel about this topic?",
                                                options: ["Very confident", "Somewhat confident", "Need more practice", "Not confident"],
                                                correct: 0,
                                                explanation: "Honest self-assessment helps you learn better."
                                            },
                                            {
                                                question: "Will you apply what you learned?",
                                                options: ["Yes, immediately", "Yes, soon", "Maybe later", "Just learning for now"],
                                                correct: 0,
                                                explanation: "Application solidifies knowledge!"
                                            }
                                        ]
                                    };
                                    showQuizModal(fallbackQuiz, moduleTitle, data, items.apiKey);
                                } else {
                                    showQuizModal(quizData, moduleTitle, data, items.apiKey);
                                }
                            });
                        });
                    });

                    document.body.appendChild(btn);
                }
            });
        }

        // ALWAYS set up distraction guard if there's an active course
        setupDistractionGuard(data);
    });
}

let distractionGuardSetup = false;

function setupDistractionGuard(data) {
    if (!data.currentCourse || distractionGuardSetup) return;
    distractionGuardSetup = true;

    console.log('Setting up AI distraction guard for:', data.currentCourse.courseTitle);

    document.addEventListener('click', async (e) => {
        const link = e.target.closest('a[href*="/watch?v="]');
        if (!link) return;

        // Allow clicks on the current video
        const currentPath = window.location.pathname + window.location.search;
        const clickedPath = new URL(link.href).pathname + new URL(link.href).search;
        if (currentPath === clickedPath) return;

        // Get video title - Improved extraction
        let videoTitle = 'Unknown Video';

        // Strategy 1: Explicit #video-title element (most reliable for search results/home)
        // We look for the main title element inside the clicked container
        const titleEl = link.querySelector('#video-title') ||
            link.closest('ytd-video-renderer')?.querySelector('#video-title') ||
            link.closest('ytd-rich-item-renderer')?.querySelector('#video-title') ||
            link.closest('ytd-compact-video-renderer')?.querySelector('#video-title');

        if (titleEl) {
            videoTitle = titleEl.innerText;
        }
        // Strategy 2: Title attribute on the link itself (if present and useful)
        else if (link.title && link.title.length > 5) {
            videoTitle = link.title;
        }
        // Strategy 3: Aria-label with strict cleanup
        else if (link.getAttribute('aria-label')) {
            const ariaLabel = link.getAttribute('aria-label');
            // Remove "by ChannelName" suffix commonly found in aria-labels
            // e.g., "Video Title by ChannelName 2 years ago..."
            videoTitle = ariaLabel.replace(/\sby\s.+/, '');
        }
        else {
            // Fallback: Check if the text content looks like a title
            // Avoid subtitle text by checking length and structure
            videoTitle = link.innerText.split('\n')[0];
        }

        videoTitle = videoTitle.trim();
        console.log('Extracted Video Title:', videoTitle);

        // Strict validation: If title seems to be a subtitle or too short/long description
        // Example bad title: "in this video we'll talk about..." (starts with lowercase usually subtitles)
        // or just too generic.
        if (videoTitle.length < 3 || videoTitle.includes('sponsored') || /^[a-z]/.test(videoTitle)) {
            // If extraction failed or got ad text/subtitle, verify fallback
            console.log('Title extraction ambiguous (subtitle detected?), checking secondary sources...');
            // Try one more time with a broader search up the tree
            const parentTitle = link.closest('#dismissible')?.querySelector('#video-title')?.innerText;
            if (parentTitle) {
                videoTitle = parentTitle.trim();
            } else {
                console.log('Could not reliably extract title. Skipping check.');
                window.location.href = link.href;
                return;
            }
        }

        // Show "Checking..." message
        const checkingMsg = document.createElement('div');
        Object.assign(checkingMsg.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: '#1a1a1a', color: 'white', padding: '20px 40px',
            borderRadius: '8px', zIndex: '99999', fontSize: '16px'
        });
        checkingMsg.innerText = '🤔 Checking if this is relevant...';
        document.body.appendChild(checkingMsg);

        // Ask AI if this video is relevant
        chrome.storage.local.get(['apiKey', 'watchHistory'], (items) => {
            const moduleTitle = data.currentCourse.modules[data.currentModuleIndex]?.title || 'current topic';
            const courseName = data.currentCourse.courseTitle;
            const watchHistory = items.watchHistory || [];

            // Get recent watch history (last 5 videos)
            const recentVideos = watchHistory.slice(-5).map(v => v.title).join(', ');

            chrome.runtime.sendMessage({
                action: "checkVideoRelevance",
                videoTitle: videoTitle,
                moduleTitle: moduleTitle,
                courseName: courseName,
                recentVideos: recentVideos,
                apiKey: items.apiKey
            }, (result) => {
                checkingMsg.remove();

                if (result.error || !result.isRelevant) {
                    // Video is OFF-TOPIC - warn user
                    const confirmed = confirm(
                        `⚠️ This might be a distraction!\n\n` +
                        `Video: "${videoTitle}"\n` +
                        `Your current focus: ${moduleTitle}\n\n` +
                        `${result.reason || 'This video seems unrelated to your learning path.'}\n\n` +
                        `Do you still want to watch it?`
                    );

                    if (confirmed) {
                        // Track this as a distraction in history
                        trackVideoWatch(videoTitle, false);
                        window.location.href = link.href;
                    } else {
                        console.log('User stayed focused!');
                    }
                } else {
                    // Video is RELEVANT - allow it
                    console.log('Video is relevant, allowing:', result.reason);
                    trackVideoWatch(videoTitle, true);
                    window.location.href = link.href;
                }
            });
        });
    }, true);
}

function showQuizModal(quizData, moduleTitle, courseData, apiKey) {
    // Remove complete button
    const btn = document.getElementById('yt-complete-module-btn');
    if (btn) btn.remove();

    // Create quiz modal
    const modal = document.createElement('div');
    modal.id = 'yt-quiz-modal';
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.9)', zIndex: '10000',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
        backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '12px',
        maxWidth: '600px', width: '90%', color: 'white'
    });

    modal.appendChild(container);
    document.body.appendChild(modal);

    let currentQ = 0;
    let score = 0;
    let answers = [];

    function renderQuestion() {
        const q = quizData.questions[currentQ];
        container.innerHTML = `
            <h2 style="margin-bottom:10px;">Question ${currentQ + 1}/3</h2>
            <p style="font-size:18px; margin-bottom:30px;">${q.question}</p>
            <div id="quiz-options"></div>
            <div id="quiz-feedback" style="margin-top:20px; min-height:60px;"></div>
        `;

        const optionsDiv = container.querySelector('#quiz-options');
        q.options.forEach((opt, i) => {
            const optBtn = document.createElement('button');
            optBtn.innerText = opt;
            optBtn.className = 'quiz-option';
            Object.assign(optBtn.style, {
                display: 'block', width: '100%', padding: '15px', margin: '10px 0',
                fontSize: '16px', backgroundColor: '#333', color: 'white',
                border: '2px solid #555', borderRadius: '8px', cursor: 'pointer',
                transition: 'all 0.2s'
            });

            optBtn.addEventListener('click', () => checkAnswer(i, optBtn));
            optionsDiv.appendChild(optBtn);
        });
    }

    function checkAnswer(selected, btn) {
        const q = quizData.questions[currentQ];
        const feedback = container.querySelector('#quiz-feedback');
        const allBtns = container.querySelectorAll('.quiz-option');

        // Disable all buttons
        allBtns.forEach(b => b.disabled = true);

        const isCorrect = selected === q.correct;
        answers.push({ question: q.question, selected, correct: q.correct, isCorrect });

        if (isCorrect) {
            score++;
            btn.style.backgroundColor = '#4CAF50';
            btn.style.borderColor = '#4CAF50';
            feedback.innerHTML = `<p style="color:#4CAF50;">✅ Correct! ${q.explanation}</p>`;
        } else {
            btn.style.backgroundColor = '#f44336';
            btn.style.borderColor = '#f44336';
            allBtns[q.correct].style.backgroundColor = '#4CAF50';
            allBtns[q.correct].style.borderColor = '#4CAF50';
            feedback.innerHTML = `<p style="color:#f44336;">❌ ${q.explanation}</p>`;
        }

        // Next button
        setTimeout(() => {
            const nextBtn = document.createElement('button');
            nextBtn.innerText = currentQ < 2 ? 'Next Question' : 'See Results';
            Object.assign(nextBtn.style, {
                padding: '12px 30px', fontSize: '16px', backgroundColor: '#2196F3',
                color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
                marginTop: '20px'
            });
            nextBtn.addEventListener('click', () => {
                currentQ++;
                if (currentQ < 3) {
                    renderQuestion();
                } else {
                    showResults();
                }
            });
            feedback.appendChild(nextBtn);
        }, 1500);
    }

    function showResults() {
        container.innerHTML = `
            <h2>Quiz Complete!</h2>
            <p style="font-size:24px; margin:20px 0;">Score: ${score}/3</p>
            <div id="ai-feedback" style="margin:20px 0; padding:20px; background:#333; border-radius:8px;">
                <p>Analyzing your performance...</p>
            </div>
        `;

        // Get AI analysis
        chrome.runtime.sendMessage({
            action: "analyzeQuizResults",
            moduleTitle: moduleTitle,
            score: score,
            answers: answers,
            apiKey: apiKey
        }, (analysis) => {
            const feedbackDiv = container.querySelector('#ai-feedback');
            feedbackDiv.innerHTML = `<p>${analysis.feedback || 'Great job!'}</p>`;

            const continueBtn = document.createElement('button');
            continueBtn.innerText = analysis.recommendation === 'review_module' ? 'Review Module' : 'Next Module';
            Object.assign(continueBtn.style, {
                padding: '15px 40px', fontSize: '18px', backgroundColor: '#4CAF50',
                color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
                marginTop: '20px'
            });
            continueBtn.addEventListener('click', () => {
                modal.remove();
                if (analysis.recommendation === 'review_module') {
                    alert('Rewatch the video to strengthen your understanding!');
                    location.reload();
                } else {
                    advanceModule(courseData);
                }
            });
            container.appendChild(continueBtn);
        });
    }

    renderQuestion();
}

async function advanceModule(data) {
    const nextIndex = data.currentModuleIndex + 1;
    await chrome.storage.local.set({ currentModuleIndex: nextIndex, isAutosurfing: false });

    const total = data.currentCourse.modules.length;
    if (nextIndex >= total) {
        alert("🎉 COURSE COMPLETED! You are a Hero.");
        await chrome.storage.local.remove(['currentCourse', 'currentModuleIndex']);
    } else {
        alert(`Module Completed! Unlocking Module ${nextIndex + 1}...`);
    }
    window.location.href = 'https://www.youtube.com/';
}

function scrapeVideosFromPage() {
    let videos = [];

    // Robust selector strategy: Select ALL links with #video-title ID
    // YouTube uses this ID on both row and grid layouts
    const titleLinks = document.querySelectorAll('a#video-title');

    titleLinks.forEach((link) => {
        if (videos.length >= 8) return;

        // Ensure it's a valid video link
        const href = link.href;
        if (!href || !href.includes('/watch?v=')) return;

        const videoId = href.split('v=')[1]?.split('&')[0];
        const title = link.innerText?.trim() || link.title;

        if (!videoId || !title) return;

        // Try to find channel/duration relative to the link
        // Use closest renderer to scope searches
        const renderer = link.closest('ytd-video-renderer') || link.closest('ytd-rich-item-renderer') || link.closest('ytd-compact-video-renderer');
        let channel = "Unknown";
        let duration = "Unknown";

        if (renderer) {
            // Try various selectors for channel name
            const channelEl = renderer.querySelector('#channel-info #text') || renderer.querySelector('.ytd-channel-name') || renderer.querySelector('#text-container');
            if (channelEl) channel = channelEl.innerText?.trim();

            // Try various selectors for duration
            const durEl = renderer.querySelector('span.ytd-thumbnail-overlay-time-status-renderer') || renderer.querySelector('.badge-shape-wiz__text');
            if (durEl) duration = durEl.innerText?.trim();
        }

        videos.push({ videoId, title, channel, duration });
    });

    return videos;
}

function createOverlay() {
    const existing = document.getElementById('yt-focus-guard');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'yt-focus-guard';

    chrome.storage.local.get(['currentCourse', 'currentModuleIndex'], (data) => {


        if (data.currentCourse && typeof data.currentModuleIndex === 'number') {
            // Render Course View
            const course = data.currentCourse;
            const index = data.currentModuleIndex;
            const currentModule = course.modules[index];

            console.log(`Current Module Index: ${index}, Total Modules: ${course.modules.length}`);

            if (!currentModule) {
                // Course Complete
                overlay.innerHTML = `<h1>🎓 Course Complete!</h1><p>You finished ${course.courseTitle}.</p>
                <button id="clear-course" style="margin-top:20px; padding:10px 20px; font-size:16px; cursor:pointer;">Start New Course</button>`;
                document.body.appendChild(overlay);
                document.body.style.overflow = 'hidden';

            } else {
                overlay.innerHTML = `
                <h2>📚 ${course.courseTitle}</h2>
                <h3>Module ${index + 1}: ${currentModule.title}</h3>
                <p>Click below to find the specific video for this module.</p>
                <div id="yt-focus-status"></div>
                <button id="yt-start-module" style="padding:15px; background:white; color:black; border:none; border-radius:4px; font-size:1.2rem; cursor:pointer;">
                    Start Module ${index + 1}
                </button>
                <button id="yt-course-menu" style="margin-top:15px; padding:10px 20px; background:#333; color:white; border:none; border-radius:4px; cursor:pointer;">
                    ⚙️ Course Settings
                </button>
              `;

                document.body.appendChild(overlay);
                document.body.style.overflow = 'hidden';
            }
        } else {

            // Render "New Intent" View
            overlay.innerHTML = `
                <h1>🎓 Zero to Hero</h1>
                <input type="text" id="yt-focus-input" placeholder="I want to become an expert in..." autocomplete="off">
                <div id="yt-focus-status"></div>
              `;

            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
            const input = overlay.querySelector('#yt-focus-input');
            input.focus();

            input.addEventListener('keypress', (e) => handleInput(e, input, overlay));
        }
    });
}

async function handleInput(e, input, overlay) {
    if (e.key === 'Enter') {
        const intent = input.value.trim();
        if (!intent) return;

        const status = overlay.querySelector('#yt-focus-status');
        status.innerText = "Designing your Curriculum (MiniMax AI)...";

        chrome.storage.local.get(['apiKey'], (items) => {
            if (!items.apiKey) { status.innerText = "Error: No API Key."; return; }

            chrome.runtime.sendMessage(
                { action: "generateCourse", intent: intent, apiKey: items.apiKey },
                (response) => {
                    if (response.error) {
                        status.innerText = "Error: " + response.error;
                    } else {
                        status.innerText = "Curriculum Created! Reloading...";
                        location.reload();
                    }
                }
            );
        });
    }
}
// End of content.js

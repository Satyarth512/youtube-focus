const MINIMAX_URL = "https://api.minimax.io/v1/chat/completions";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "generateCourse") {
        generateCourse(request.intent, request.apiKey).then(sendResponse);
        return true;
    }
    if (request.action === "selectBestVideo") {
        selectBestVideo(request.candidates, request.topic, request.apiKey).then(sendResponse);
        return true;
    }
    if (request.action === "generateQuiz") {
        generateQuiz(request.moduleTitle, request.apiKey).then(sendResponse);
        return true;
    }
    if (request.action === "analyzeQuizResults") {
        analyzeQuizResults(request.moduleTitle, request.score, request.answers, request.apiKey).then(sendResponse);
        return true;
    }
    if (request.action === "checkVideoRelevance") {
        checkVideoRelevance(request.videoTitle, request.moduleTitle, request.courseName, request.recentVideos, request.apiKey).then(sendResponse);
        return true;
    }
});

async function checkVideoRelevance(videoTitle, moduleTitle, courseName, recentVideos, apiKey) {
    try {
        const response = await fetch(MINIMAX_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "MiniMax-M2",
                messages: [{
                    role: "system",
                    content: `You are a focus coach. Determine if a video is relevant to the user's current learning goal.
                    
                    User is learning: "${moduleTitle}" in course "${courseName}"
                    Video they want to watch: "${videoTitle}"
                    Recent watch history: ${recentVideos || 'None'}
                    
                    Return ONLY valid JSON:
                    {
                      "isRelevant": true/false,
                      "reason": "Brief explanation"
                    }
                    
                    isRelevant should be TRUE if the video is about the same topic or a closely related concept.
                    isRelevant should be FALSE if:
                    - It's entertainment, unrelated topic, or distraction
                    - The user is going down a rabbit hole (watch history shows pattern of off-topic videos)
                    - The video is too advanced/basic compared to current module`
                }],
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Relevance API Error:', response.status, errorText);
            return { isRelevant: false, reason: `API Error ${response.status}: ${errorText.substring(0, 100)}` };
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return { isRelevant: false, reason: "Invalid API response structure" };
        }

        const content = data.choices[0].message.content;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');

        if (jsonStart === -1) return { isRelevant: false, reason: "Analysis failed (No JSON)" };

        return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    } catch (e) {
        console.error('Relevance check error:', e);
        return { isRelevant: false, reason: "Network/Code Error: " + e.message };
    }
}

async function generateQuiz(moduleTitle, apiKey) {
    try {
        const response = await fetch(MINIMAX_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "MiniMax-M2",
                messages: [{
                    role: "system",
                    content: `You are a learning assessment expert. Generate 3 multiple-choice questions to test understanding of: "${moduleTitle}".
          
          CRITICAL: Return ONLY valid JSON.
          Format:
          {
            "questions": [
              {
                "question": "Question text here?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct": 0,
                "explanation": "Why this answer is correct"
              }
            ]
          }`
                }],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Quiz API Error:', response.status, errorText);
            return { error: `Quiz generation failed: ${response.status}` };
        }

        const data = await response.json();
        console.log('Quiz API Response:', data);

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid API response structure:', data);
            return { error: "Invalid API response" };
        }

        const content = data.choices[0].message.content;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');

        if (jsonStart === -1) {
            console.error('No JSON in response:', content);
            return { error: "No JSON found" };
        }

        return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    } catch (e) {
        console.error('Quiz generation exception:', e);
        return { error: e.message };
    }
}

async function analyzeQuizResults(moduleTitle, score, answers, apiKey) {
    try {
        const response = await fetch(MINIMAX_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "MiniMax-M2",
                messages: [{
                    role: "system",
                    content: `You are a learning coach. The student just completed a quiz on "${moduleTitle}".
          Score: ${score}/3
          Their answers: ${JSON.stringify(answers)}
          
          Provide personalized feedback in JSON:
          {
            "feedback": "2-3 sentences of encouragement and advice",
            "recommendation": "next_module" or "review_module" or "take_break"
          }`
                }],
                temperature: 0.5
            })
        });

        if (!response.ok) return { feedback: "Great effort! Keep learning.", recommendation: "next_module" };

        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');

        if (jsonStart === -1) return { feedback: "Well done!", recommendation: "next_module" };

        return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    } catch (e) {
        return { feedback: "Keep going!", recommendation: "next_module" };
    }
}

async function selectBestVideo(candidates, topic, apiKey) {
    try {
        const response = await fetch(MINIMAX_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "MiniMax-M2",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Curator.
            The user is learning: "${topic}".
            
            You are given a list of YouTube search results.
            Analyze the Titles, Views, and Durations.
            Select the SINGLE best video that is:
            1. Relevant to the topic.
            2. High quality (good views/channel).
            3. Not too long, not too short (unless topic requires it).
            
            CRITICAL: Return ONLY valid JSON.
            Format: { "videoId": "THE_ID", "reason": "Why you picked it" }`
                    },
                    {
                        role: "user",
                        content: `Topic: ${topic}\n\nCandidates:\n${JSON.stringify(candidates)}`
                    }
                ],
                temperature: 0.1
            })
        });

        if (!response.ok) return { error: "API Error" };
        const data = await response.json();
        const content = data.choices[0].message.content;

        // Extract JSON
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        if (jsonStart === -1) return { error: "No JSON" };

        return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    } catch (e) {
        return { error: e.message };
    }
}

async function generateCourse(intent, apiKey) {
    try {
        const response = await fetch(MINIMAX_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "MiniMax-M2",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Professor designing a "Zero to Hero" video curriculum.
            
            1. Analyze the user's goal (e.g. "Learn DevOps").
            2. Break it down into 5-8 sequential video topics.
            3. For each topic, provide a specific YouTube Search Query to find the best video.
            
            CRITICAL: Return ONLY valid JSON.
            Format:
            {
              "courseTitle": "Devops Masterclass",
              "modules": [
                { "title": "1. What is DevOps?", "searchQuery": "What is DevOps explained" },
                { "title": "2. Linux Basics", "searchQuery": "Linux for DevOps beginners" }
              ]
            }`
                    },
                    {
                        role: "user",
                        content: `Create a Zero to Hero course for: "${intent}"`
                    }
                ],
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return { error: `API Error: ${response.status} - ${err}` };
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return { error: "Invalid API response structure." };
        }

        // JSON Extraction
        const content = data.choices[0].message.content;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');

        if (jsonStart === -1 || jsonEnd === -1) return { error: "No JSON found." };

        const cleanJson = content.substring(jsonStart, jsonEnd + 1);

        try {
            const course = JSON.parse(cleanJson);
            // Save to storage immediately
            await chrome.storage.local.set({ currentCourse: course, currentModuleIndex: 0 });
            return { success: true, course: course };
        } catch (e) {
            return { error: "AI response was not valid JSON." };
        }
    } catch (error) {
        return { error: error.message };
    }
}

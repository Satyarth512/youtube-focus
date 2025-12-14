
# 🚀 How to Publish "YouTube Focus AI" to the Chrome Web Store

## 1. Prerequisites
- **Google Account**: You need a Google account.
- **Developer Account**: One-time registration fee of **$5 USD**.
- **Privacy Policy**: Since we request permissions for `storage` and `activeTab`, you may need a simple privacy policy hosted somewhere (GitHub Pages works great).

## 2. Prepare Your Package
✅ **Done!** I have already created the zip file for you:
`youtube-focus-v1.0.zip` (Located in your project folder)

## 3. Submit to Chrome Web Store
1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
2. Click **+ New Item**.
3. Upload the `youtube-focus-v1.0.zip` file.

## 4. Fill in Store Listing
You will need to provide the following details. Here is a generated draft for you:

### **Title**
YouTube Focus AI - Zero to Hero Learning

### **Description**
Turn YouTube into a focused learning machine.
Stop doom-scrolling and start learning! "YouTube Focus AI" blocks distractions and creates personalized "Zero to Hero" video curriculums for any skill you want to learn.

**Key Features:**
- 🎓 **AI Curriculum Generator:** Just type "Learn Python" or "Cooking Basics" and get a structured module-by-module video path.
- 🛡️ **Distraction Guard:** The AI monitors links you click. If you try to watch a cat video while learning Python, it will gently warn you!
- 🧠 **Quiz Mode:** After every module, take a generated 3-question quiz to verify your knowledge before moving on.
- ⏸️ **Focus Mode:** Hides the default YouTube feed and sidebar recommendations to keep you in the zone.

### **Category**
Productivity / Education

## 5. Privacy & Permissions
In the **Privacy** tab, you must declare what data you collect.
- **Permissions Used:** `storage`, `activeTab`, `scripting`.
- **Justification:**
    - "The extension stores the user's generated course progress locally."
    - "It accesses the active tab to inject the focus overlay and check video titles for relevance."
- **Data Usage:** "No data is sent to third-party servers except for the AI content generation (MiniMax API), which is stateless."

## 6. Screenshots
You will need to upload screenshots (1280x800).
*Recommendation: Take screenshots of:*
1. The "Zero to Hero" input overlay.
2. The "Course Dashboard" showing modules.
3. The "Distraction Guard" warning popup.
4. The "Quiz" modal.

## 7. Publish!
Once verified, click **Submit for Review**. It usually takes 24-48 hours.

---
**Note on API Keys:**
Currently, users need to input their own MiniMax API Key in the extension options. Ensure you mention this in the description, or you will need to bundle a key (not recommended for security/cost).

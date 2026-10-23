# StudyDuel Browser Extension ⏱️

A beautiful, high-performance browser extension for **Chrome**, **Brave**, **Safari**, **Edge**, and **Arc** to track study and work sessions right from your browser toolbar.

Inspired by TimeCamp’s quick-logging workflow, tailored specifically for **StudyDuel**.

---

## ✨ Features

- **Login Once**: Log in once with your StudyDuel account or 1-click connect to an open StudyDuel browser tab. It securely remembers your session.
- **Project & Task Hierarchy**: Browse your full account project list with color badges and nested subjects/tasks.
- **Searchable Task Picker**: Instant real-time search across all projects, subtasks, and suggested shortcuts.
- **Rich Running Timer View**:
  - Live ticking digital clock with monospace typography.
  - Project color dot & breadcrumb indicator.
  - Active session notes preview.
  - Start time timestamp and duration counter.
- **Real-Time Toolbar Badge**:
  - Displays live running duration (e.g. `14m`, `1.5h`) directly on the extension icon in your browser toolbar with an emerald badge indicator.
- **Two-Way Web App Sync**:
  - Timers started in the extension immediately update open StudyDuel tabs.
  - Timers stopped on the web app immediately update the extension badge and status.
- **Audio Chimes**: Subtle, high-fidelity Web Audio tones on timer start and stop.
- **Quick Links**: 1-click "Go to Timesheet" navigation to your StudyDuel dashboard.

---

## 🚀 How to Install & Load the Extension

### 1. Chrome / Brave / Edge / Arc (Chromium Browsers)

1. Open your browser extension manager:
   - **Brave**: `brave://extensions`
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
2. Enable **Developer mode** (toggle switch in the top right corner).
3. Click the **Load unpacked** button.
4. Select the `StudyDuel/extension` folder:
   ```
   /Users/sisirath/StudyDuel/extension
   ```
5. Click **Select Folder**. The **StudyDuel — Time Tracking** extension will now appear in your browser toolbar!
6. *(Tip)* Pin the StudyDuel icon to your browser toolbar for instant 1-click access anytime.

---

### 2. Apple Safari (macOS)

Safari supports standard WebExtensions Manifest V3:
1. Open **Safari Settings** (`⌘ ,`) → **Advanced** tab → Check **Show features for web developers** (or **Show Develop menu in menu bar**).
2. Go to the **Develop** menu in the top bar → Check **Allow Unsigned Extensions**.
3. In Terminal, build the Safari app wrapper using Apple's standard Web Extension converter:
   ```bash
   xcrun safari-web-extension-converter /Users/sisirath/StudyDuel/extension --macos-only
   ```
4. Build and run in Xcode once, then enable the StudyDuel extension in Safari Extensions settings.

---

## 🛠️ Development & Local Testing

1. Start your local StudyDuel server & frontend:
   ```bash
   npm run dev
   ```
2. Open the extension popup from your browser toolbar.
3. You can sign in using your account email and password, click **Connect Tab** to link an open tab, or click **Demo Mode** for instant offline testing!

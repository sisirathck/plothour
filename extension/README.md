# PlotHour browser timer — 1.1.1

The extension does one job: sign in, select a project and optional subproject, start a timer, and stop/save it. The server confirms every change. Closing the popup does not stop the timer.

## Use the updated extension

In Chrome, Brave or Edge, open the browser's extensions page. If PlotHour is already loaded from this repository's `extension` directory, press **Reload** on its card. Otherwise use **Load unpacked** and select this directory. Packaged downloads must be extracted first. Safari requires conversion and building with Apple's Web Extension tools; that platform has not been verified here.

1. Open the popup.
2. Choose **Continue with Google** to sign in in the main app, or use email and password. For local testing only, expand **Connection settings** and set the app address to your Vite origin such as `http://127.0.0.1:5175`. Local and deployed accounts are separate environments.
3. For Google, complete sign-in in the new PlotHour tab and reopen the popup. Keep that app tab open: authenticated requests use its HTTP-only cookie without copying the Google credential or session token. **Connect signed-in browser tab** also connects an existing signed-in tab. Reload existing app tabs once after updating the extension.
4. Choose a project and optional subproject; press **Start timer**.
5. Press **Stop & save session**. Success appears only after the server confirms the save.

Use **Refresh projects & timer** after changing projects elsewhere. The toolbar badge refreshes in the background. The web app polls the same timer state. There is no fake login, offline recording, or fallback sample project list. If the server is unavailable, the popup reports the failure and preserves the last confirmed timer display.

A separately deployed backend needs these source changes deployed before it can provide the updated transactional timer, session connection, and pause/resume behavior. The app address is editable; `plothour.com` is the default from this repository's existing configuration.

## Checks

`npm run test:runtime` from the repository root exercises the actual extension service-worker source against the local API using disposable synthetic accounts. It covers login, account projects, subproject selection, start and stop. It does not replace testing an installed popup in each supported browser.

Extension storage contains the signed session token, never the password. Sign out clears extension credentials without signing the web app out. Session revocation on the server also applies to the extension.

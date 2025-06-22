# Changelog

All notable changes to this project will be documented in this file.

### **[v2.1.0] - 2025-06-22**

This version introduces a major UI overhaul by adopting the Bootstrap framework and includes numerous bug fixes and refinements based on user feedback.

#### Changed

* **UI Framework**: Replaced the entire custom stylesheet with the Bootstrap 5 framework for a more robust and consistent design system.
* **React 18 API**: Updated the application to use the modern `createRoot` API, resolving the legacy `ReactDOM.render` warning.
* **Search Functionality**: Restored the "Search Dancers" tab to its original behavior of grouping results by performer.
* **Authentication Location**: Moved the "Admin Sign-In" and "Sign Out" buttons from the main header to the "Settings" tab for better organization.
* **Changelog Rendering**: Replaced the custom Markdown parsing function with the `marked.js` library for more accurate and reliable rendering.

#### Fixed

* **Dark Mode Styling**: Corrected multiple styling inconsistencies in dark mode, including:
    * Accordion chevron icon color in both collapsed and expanded states.
    * Active theme button color in Settings.
    * Text color for program numbers and performers.
    * Header and divider colors in the changelog display.
* **Favorite Star Color**: The favorite star icon now correctly uses the pink application theme color in both light and dark modes.

### **[v2.0.0] - 2025-06-21**

This version introduces robust admin controls, a refined user interface with multiple search options, and a flexible theme switcher.

#### Added

* **Dual Search Modes**: Implemented two separate search tabs: "Search Acts" and "Search Dancers".
* **Theme Switcher**: Added a UI control to allow users to switch between Light, Dark, and System-based themes for better accessibility and user preference.
* **Admin "Start/Stop Tracking"**: Introduced a master toggle button for authorized admins to globally enable or disable the live "Now Performing" tracker for all users.
* **Sticky Tracker Controls**: Added `+` and `-` controls to the sticky header for authorized admins, allowing for easier act number updates while scrolled down.

#### Fixed

* **Scrolling/Swiping Conflict**: Corrected the swipe navigation logic to only trigger on horizontal swipes, preventing accidental tab changes when scrolling vertically.

### **[v1.5.0] - 2025-06-21**

This major update introduced live tracking capabilities using a real-time database and enhanced security with user authentication.

#### Added

* **Live "Now Performing" Tracker**: Integrated Firebase Firestore to track the currently performing act number in real-time.
* **Admin-Only Controls**: The tracker can now only be controlled by authorized users.
* **Google Sign-In**: Switched from anonymous authentication to Google Sign-In to identify authorized admins by their email address.
* **Anonymous Access**: The app is now accessible to the public anonymously by default.
* **Act Title in Tracker**: The tracker now displays both the act number and the act title.
* **Sticky Header**: The "Now Performing" tracker now sticks to the top of the screen when the user scrolls down.

#### Changed

* **Data Security**: Moved Firebase configuration and authorized user emails from the main `app.js` file into a separate, more secure `config.js` file.
* **Data Obfuscation**: Changed the data source from a readable `.json` file to a Base64-encoded `.dat` file.

#### Fixed

* **Character Encoding**: Resolved an issue where special characters were decoding incorrectly from the data file.
* **Authentication Flow**: Addressed an issue where the sign-in button would disappear on load by adding an "Authenticating..." state.

### **[v1.0.0] - 2025-06-21**

Initial stable release of the modern web application.

#### Added

* **React-Based Application**: Converted the original Vue.js application to a modern React-based Single Page App (SPA).
* **PWA Capabilities**: Made the application a Progressive Web App, allowing it to be installed on a device's home screen and work offline.
* **File-Based Structure**: Organized the project by separating HTML, CSS, and JavaScript into their own files.
* **Icon Library**: Replaced basic SVG icons with Font Awesome for a more professional look.
* **Favorites System**: Users can mark dancers as favorites, and these selections are saved using browser `localStorage`.

#### Changed

* **Styling**: Removed Tailwind CSS and replaced it with a custom stylesheet.
* **UI/UX**: Refined the main title and subheading for better visual hierarchy.
/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/preload.ts":
/*!************************!*\
  !*** ./src/preload.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var electron__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! electron */ \"electron\");\n/* harmony import */ var electron__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(electron__WEBPACK_IMPORTED_MODULE_0__);\n\nconst electronAPI = {\n    login: (credentials) => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('login', credentials),\n    logout: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('logout'),\n    checkWslStatus: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('check-wsl-status'),\n    checkReplicantStatus: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('check-replicant-status'),\n    startWsl: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('start-wsl'),\n    stopReplicant: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('stop-replicant'),\n    getSystemMetrics: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('get-system-metrics'),\n    runDiagnostics: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('run-diagnostics'),\n    onDebugLog: (callback) => {\n        const handler = (_event, log) => callback(log);\n        electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.on('debug-log', handler);\n    },\n    removeDebugLogListener: (callback) => {\n        // Note: We need to store the handler reference to remove it properly\n        // For now, we'll remove all listeners\n        electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.removeAllListeners('debug-log');\n    },\n    runTests: (testType) => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('run-tests', testType),\n    runTestSuite: (suiteName) => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('run-test-suite', suiteName),\n    getTestDiagnostics: () => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('get-test-diagnostics'),\n    onTestProgress: (callback) => {\n        const handler = (_event, progress) => callback(progress);\n        electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.on('test-progress', handler);\n    }\n};\nelectron__WEBPACK_IMPORTED_MODULE_0__.contextBridge.exposeInMainWorld('electronAPI', electronAPI);\n\n\n//# sourceURL=webpack://one-filer-login/./src/preload.ts?\n}");

/***/ }),

/***/ "electron":
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("electron");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/preload.ts");
/******/ 	
/******/ })()
;
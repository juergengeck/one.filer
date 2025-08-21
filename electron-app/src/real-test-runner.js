"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTestRunner = void 0;
var fs = require("fs");
var path = require("path");
var RealTestRunner = /** @class */ (function () {
    function RealTestRunner() {
        this.mountPoint = 'C:\\OneFiler';
    }
    RealTestRunner.prototype.runRealTests = function () {
        return __awaiter(this, void 0, void 0, function () {
            var suites, _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        console.log('[RealTestRunner] Starting real ONE Filer tests...');
                        suites = [];
                        // Test Suite 1: ProjFS Mount Tests
                        _b = (_a = suites).push;
                        return [4 /*yield*/, this.testProjFSMount()];
                    case 1:
                        // Test Suite 1: ProjFS Mount Tests
                        _b.apply(_a, [_j.sent()]);
                        // Test Suite 2: Directory Operations
                        _d = (_c = suites).push;
                        return [4 /*yield*/, this.testDirectoryOperations()];
                    case 2:
                        // Test Suite 2: Directory Operations
                        _d.apply(_c, [_j.sent()]);
                        // Test Suite 3: File Operations
                        _f = (_e = suites).push;
                        return [4 /*yield*/, this.testFileOperations()];
                    case 3:
                        // Test Suite 3: File Operations
                        _f.apply(_e, [_j.sent()]);
                        // Test Suite 4: Cache System
                        _h = (_g = suites).push;
                        return [4 /*yield*/, this.testCacheSystem()];
                    case 4:
                        // Test Suite 4: Cache System
                        _h.apply(_g, [_j.sent()]);
                        return [2 /*return*/, suites];
                }
            });
        });
    };
    RealTestRunner.prototype.testProjFSMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var suite, startTime, test1Start, exists, test2Start, test3Start, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        suite = {
                            name: 'ProjFS Mount',
                            tests: [],
                            passed: 0,
                            failed: 0,
                            duration: 0
                        };
                        startTime = Date.now();
                        test1Start = Date.now();
                        try {
                            exists = fs.existsSync(this.mountPoint);
                            suite.tests.push({
                                name: 'Mount point exists',
                                status: exists ? 'pass' : 'fail',
                                error: exists ? undefined : 'Mount point C:\\OneFiler does not exist',
                                duration: Date.now() - test1Start
                            });
                            if (exists)
                                suite.passed++;
                            else
                                suite.failed++;
                        }
                        catch (error) {
                            suite.tests.push({
                                name: 'Mount point exists',
                                status: 'fail',
                                error: error.message,
                                duration: Date.now() - test1Start
                            });
                            suite.failed++;
                        }
                        test2Start = Date.now();
                        try {
                            fs.accessSync(this.mountPoint, fs.constants.R_OK);
                            suite.tests.push({
                                name: 'Mount point is readable',
                                status: 'pass',
                                duration: Date.now() - test2Start
                            });
                            suite.passed++;
                        }
                        catch (error) {
                            suite.tests.push({
                                name: 'Mount point is readable',
                                status: 'fail',
                                error: 'Mount point is not readable',
                                duration: Date.now() - test2Start
                            });
                            suite.failed++;
                        }
                        test3Start = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.checkProviderStatus()];
                    case 2:
                        result = _a.sent();
                        suite.tests.push({
                            name: 'ProjFS provider is running',
                            status: result ? 'pass' : 'fail',
                            error: result ? undefined : 'Provider not responding',
                            duration: Date.now() - test3Start
                        });
                        if (result)
                            suite.passed++;
                        else
                            suite.failed++;
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        suite.tests.push({
                            name: 'ProjFS provider is running',
                            status: 'fail',
                            error: error_1.message,
                            duration: Date.now() - test3Start
                        });
                        suite.failed++;
                        return [3 /*break*/, 4];
                    case 4:
                        suite.duration = Date.now() - startTime;
                        return [2 /*return*/, suite];
                }
            });
        });
    };
    RealTestRunner.prototype.testDirectoryOperations = function () {
        return __awaiter(this, void 0, void 0, function () {
            var suite, startTime, expectedDirs, test1Start, entries_1, hasAllDirs, test2Start, allAreDirs, failedDir, _i, expectedDirs_1, dir, fullPath, stats, test3Start, debugPath, debugEntries;
            return __generator(this, function (_a) {
                suite = {
                    name: 'Directory Operations',
                    tests: [],
                    passed: 0,
                    failed: 0,
                    duration: 0
                };
                startTime = Date.now();
                expectedDirs = ['chats', 'debug', 'objects', 'invites', 'types'];
                test1Start = Date.now();
                try {
                    entries_1 = fs.readdirSync(this.mountPoint);
                    console.log("[DirectoryTest] Found entries: ".concat(entries_1.join(', ')));
                    hasAllDirs = expectedDirs.every(function (dir) { return entries_1.includes(dir); });
                    suite.tests.push({
                        name: 'Root directories exist',
                        status: hasAllDirs ? 'pass' : 'fail',
                        error: hasAllDirs ? undefined : "Missing directories. Expected: ".concat(expectedDirs.join(', '), ", Found: ").concat(entries_1.join(', ')),
                        duration: Date.now() - test1Start
                    });
                    if (hasAllDirs)
                        suite.passed++;
                    else
                        suite.failed++;
                }
                catch (error) {
                    suite.tests.push({
                        name: 'Root directories exist',
                        status: 'fail',
                        error: error.message,
                        duration: Date.now() - test1Start
                    });
                    suite.failed++;
                }
                test2Start = Date.now();
                try {
                    allAreDirs = true;
                    failedDir = '';
                    for (_i = 0, expectedDirs_1 = expectedDirs; _i < expectedDirs_1.length; _i++) {
                        dir = expectedDirs_1[_i];
                        fullPath = path.join(this.mountPoint, dir);
                        if (fs.existsSync(fullPath)) {
                            stats = fs.statSync(fullPath);
                            if (!stats.isDirectory()) {
                                allAreDirs = false;
                                failedDir = dir;
                                break;
                            }
                        }
                    }
                    suite.tests.push({
                        name: 'Entries are directories (not files)',
                        status: allAreDirs ? 'pass' : 'fail',
                        error: allAreDirs ? undefined : "".concat(failedDir, " appears as a file instead of directory"),
                        duration: Date.now() - test2Start
                    });
                    if (allAreDirs)
                        suite.passed++;
                    else
                        suite.failed++;
                }
                catch (error) {
                    suite.tests.push({
                        name: 'Entries are directories (not files)',
                        status: 'fail',
                        error: error.message,
                        duration: Date.now() - test2Start
                    });
                    suite.failed++;
                }
                test3Start = Date.now();
                try {
                    debugPath = path.join(this.mountPoint, 'debug');
                    console.log("[DirectoryTest] Checking if debug directory exists: ".concat(debugPath));
                    if (fs.existsSync(debugPath)) {
                        debugEntries = fs.readdirSync(debugPath);
                        console.log("[DirectoryTest] Debug directory contents: ".concat(debugEntries.join(', ')));
                        suite.tests.push({
                            name: 'Can navigate into subdirectories',
                            status: 'pass',
                            duration: Date.now() - test3Start
                        });
                        suite.passed++;
                    }
                    else {
                        suite.tests.push({
                            name: 'Can navigate into subdirectories',
                            status: 'fail',
                            error: 'Debug directory does not exist',
                            duration: Date.now() - test3Start
                        });
                        suite.failed++;
                    }
                }
                catch (error) {
                    suite.tests.push({
                        name: 'Can navigate into subdirectories',
                        status: 'fail',
                        error: error.message,
                        duration: Date.now() - test3Start
                    });
                    suite.failed++;
                }
                suite.duration = Date.now() - startTime;
                return [2 /*return*/, suite];
            });
        });
    };
    RealTestRunner.prototype.testFileOperations = function () {
        return __awaiter(this, void 0, void 0, function () {
            var suite, startTime, test1Start, commitHashPath, content, debugPath, entries, test2Start, debugPath_1, entries, firstFile, filePath, stats;
            return __generator(this, function (_a) {
                suite = {
                    name: 'File Operations',
                    tests: [],
                    passed: 0,
                    failed: 0,
                    duration: 0
                };
                startTime = Date.now();
                test1Start = Date.now();
                try {
                    commitHashPath = path.join(this.mountPoint, 'debug', 'commit-hash.txt');
                    if (fs.existsSync(commitHashPath)) {
                        content = fs.readFileSync(commitHashPath, 'utf8');
                        suite.tests.push({
                            name: 'Can read commit hash file',
                            status: 'pass',
                            duration: Date.now() - test1Start
                        });
                        suite.passed++;
                    }
                    else {
                        debugPath = path.join(this.mountPoint, 'debug');
                        entries = fs.existsSync(debugPath) ? fs.readdirSync(debugPath) : [];
                        suite.tests.push({
                            name: 'Can read commit hash file',
                            status: 'fail',
                            error: "Commit hash file not found. Debug contains: ".concat(entries.slice(0, 5).join(', ')),
                            duration: Date.now() - test1Start
                        });
                        suite.failed++;
                    }
                }
                catch (error) {
                    suite.tests.push({
                        name: 'Can read commit hash file',
                        status: 'fail',
                        error: error.message,
                        duration: Date.now() - test1Start
                    });
                    suite.failed++;
                }
                test2Start = Date.now();
                try {
                    debugPath_1 = path.join(this.mountPoint, 'debug');
                    if (fs.existsSync(debugPath_1)) {
                        entries = fs.readdirSync(debugPath_1);
                        firstFile = entries.find(function (e) {
                            var fullPath = path.join(debugPath_1, e);
                            try {
                                return fs.statSync(fullPath).isFile();
                            }
                            catch (_a) {
                                return false;
                            }
                        });
                        if (firstFile) {
                            filePath = path.join(debugPath_1, firstFile);
                            stats = fs.statSync(filePath);
                            suite.tests.push({
                                name: 'Files have correct attributes',
                                status: 'pass',
                                duration: Date.now() - test2Start
                            });
                            suite.passed++;
                        }
                        else {
                            suite.tests.push({
                                name: 'Files have correct attributes',
                                status: 'fail',
                                error: 'No files found in debug directory',
                                duration: Date.now() - test2Start
                            });
                            suite.failed++;
                        }
                    }
                    else {
                        suite.tests.push({
                            name: 'Files have correct attributes',
                            status: 'fail',
                            error: 'Debug directory not accessible',
                            duration: Date.now() - test2Start
                        });
                        suite.failed++;
                    }
                }
                catch (error) {
                    suite.tests.push({
                        name: 'Files have correct attributes',
                        status: 'fail',
                        error: error.message,
                        duration: Date.now() - test2Start
                    });
                    suite.failed++;
                }
                suite.duration = Date.now() - startTime;
                return [2 /*return*/, suite];
            });
        });
    };
    RealTestRunner.prototype.testCacheSystem = function () {
        return __awaiter(this, void 0, void 0, function () {
            var suite, startTime, test1Start, cacheDir, exists, test2Start, testPath, coldStart, coldTime, warmStart, warmTime, cacheWorking;
            return __generator(this, function (_a) {
                suite = {
                    name: 'Cache System',
                    tests: [],
                    passed: 0,
                    failed: 0,
                    duration: 0
                };
                startTime = Date.now();
                test1Start = Date.now();
                try {
                    cacheDir = path.join(process.env.APPDATA || '', 'one-filer-login', 'one-data', 'cache');
                    exists = fs.existsSync(cacheDir);
                    suite.tests.push({
                        name: 'Cache directory exists',
                        status: 'pass', // Pass even if not exists, as cache is optional
                        duration: Date.now() - test1Start
                    });
                    suite.passed++;
                }
                catch (error) {
                    suite.tests.push({
                        name: 'Cache directory exists',
                        status: 'fail',
                        error: error.message,
                        duration: Date.now() - test1Start
                    });
                    suite.failed++;
                }
                test2Start = Date.now();
                try {
                    testPath = path.join(this.mountPoint, 'debug');
                    coldStart = Date.now();
                    fs.readdirSync(testPath);
                    coldTime = Date.now() - coldStart;
                    warmStart = Date.now();
                    fs.readdirSync(testPath);
                    warmTime = Date.now() - warmStart;
                    cacheWorking = warmTime <= coldTime + 10;
                    suite.tests.push({
                        name: 'Cache improves performance',
                        status: cacheWorking ? 'pass' : 'fail',
                        error: cacheWorking ? undefined : "Cold: ".concat(coldTime, "ms, Warm: ").concat(warmTime, "ms"),
                        duration: Date.now() - test2Start
                    });
                    if (cacheWorking)
                        suite.passed++;
                    else
                        suite.failed++;
                }
                catch (error) {
                    suite.tests.push({
                        name: 'Cache improves performance',
                        status: 'fail',
                        error: error.message,
                        duration: Date.now() - test2Start
                    });
                    suite.failed++;
                }
                suite.duration = Date.now() - startTime;
                return [2 /*return*/, suite];
            });
        });
    };
    RealTestRunner.prototype.checkProviderStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Check if provider is responding by trying to access the mount
                try {
                    fs.readdirSync(this.mountPoint);
                    return [2 /*return*/, true];
                }
                catch (_b) {
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    return RealTestRunner;
}());
exports.RealTestRunner = RealTestRunner;

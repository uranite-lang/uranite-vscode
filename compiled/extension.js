"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let languageClient;
let serverOutputChannel;
let serverStatusBarItem;
function resolveServerBinaryPath(extensionContext) {
    const configuredPath = vscode_1.workspace
        .getConfiguration("uranite")
        .get("lspPath", "");
    if (configuredPath && fs.existsSync(configuredPath)) {
        return configuredPath;
    }
    const workspaceFolders = vscode_1.workspace.workspaceFolders;
    if (workspaceFolders) {
        for (const workspaceFolder of workspaceFolders) {
            const buildPath = path.join(workspaceFolder.uri.fsPath, "build", "uranite-lsp");
            if (fs.existsSync(buildPath)) {
                return buildPath;
            }
        }
    }
    const globalPaths = [
        "/usr/local/bin/uranite-lsp",
        "/usr/bin/uranite-lsp",
        path.join(require("os").homedir(), ".local", "bin", "uranite-lsp"),
    ];
    for (const globalPath of globalPaths) {
        if (fs.existsSync(globalPath)) {
            return globalPath;
        }
    }
    return undefined;
}
let restartInProgress = false;
function selectLspBinaryPath() {
    return __awaiter(this, void 0, void 0, function* () {
        const dialogOptions = {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: "Select Uranite LSP Binary",
            filters: { "Executable": ["*"] },
        };
        const selectedFiles = yield vscode_1.window.showOpenDialog(dialogOptions);
        if (!selectedFiles || selectedFiles.length === 0) {
            return undefined;
        }
        const selectedPath = selectedFiles[0].fsPath;
        if (!fs.existsSync(selectedPath)) {
            vscode_1.window.showErrorMessage(`Selected file does not exist: ${selectedPath}`);
            return undefined;
        }
        try {
            fs.accessSync(selectedPath, fs.constants.X_OK);
        }
        catch (_a) {
            const forceUse = yield vscode_1.window.showWarningMessage(`Selected file is not executable: ${selectedPath}`, "Use Anyway", "Cancel");
            if (forceUse !== "Use Anyway") {
                return undefined;
            }
        }
        const targetScope = yield vscode_1.window.showQuickPick([
            { label: "User Settings", description: "Apply globally for all workspaces", target: vscode_1.ConfigurationTarget.Global },
            { label: "Workspace Settings", description: "Apply only to current workspace", target: vscode_1.ConfigurationTarget.Workspace },
        ], { placeHolder: "Where should this setting be saved?" });
        if (!targetScope) {
            return undefined;
        }
        yield vscode_1.workspace.getConfiguration("uranite").update("lspPath", selectedPath, targetScope.target);
        serverOutputChannel.appendLine(`LSP binary path set to: ${selectedPath}`);
        return selectedPath;
    });
}
function restartLanguageServer(extensionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        if (restartInProgress) {
            return;
        }
        restartInProgress = true;
        try {
            serverStatusBarItem.text = "$(loading~spin) Uranite LSP";
            yield stopLanguageServer();
            yield startLanguageServer(extensionContext);
        }
        finally {
            restartInProgress = false;
        }
    });
}
function startLanguageServer(extensionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        const serverBinaryPath = resolveServerBinaryPath(extensionContext);
        if (!serverBinaryPath) {
            const userChoice = yield vscode_1.window.showWarningMessage("Uranite LSP binary not found. Build the compiler or configure the path.", "Browse...", "Open Settings");
            if (userChoice === "Browse...") {
                const selectedPath = yield selectLspBinaryPath();
                if (selectedPath) {
                    yield restartLanguageServer(extensionContext);
                    return;
                }
            }
            else if (userChoice === "Open Settings") {
                vscode_1.commands.executeCommand("workbench.action.openSettings", "uranite.lspPath");
            }
            serverStatusBarItem.text = "$(warning) Uranite LSP";
            serverStatusBarItem.tooltip = "Language server binary not found";
            return;
        }
        serverOutputChannel.appendLine(`Starting Uranite LSP: ${serverBinaryPath}`);
        const serverOptions = {
            command: serverBinaryPath,
            transport: node_1.TransportKind.stdio,
        };
        const traceLevel = vscode_1.workspace
            .getConfiguration("uranite")
            .get("trace.server", "off");
        const clientOptions = {
            documentSelector: [{ scheme: "file", language: "uranite" }],
            outputChannel: serverOutputChannel,
            traceOutputChannel: serverOutputChannel,
            initializationOptions: {
                semanticHighlighting: vscode_1.workspace
                    .getConfiguration("uranite")
                    .get("semanticHighlighting.enabled", true),
                modulesPath: vscode_1.workspace
                    .getConfiguration("uranite")
                    .get("modulesPath", ""),
            },
        };
        languageClient = new node_1.LanguageClient("uranite-lsp", "Uranite Language Server", serverOptions, clientOptions);
        try {
            yield languageClient.start();
            serverStatusBarItem.text = "$(check) Uranite LSP";
            serverStatusBarItem.tooltip = `Connected: ${serverBinaryPath}`;
            serverOutputChannel.appendLine("Uranite LSP server started successfully");
        }
        catch (startError) {
            serverStatusBarItem.text = "$(error) Uranite LSP";
            serverStatusBarItem.tooltip = "Failed to start language server";
            serverOutputChannel.appendLine(`Failed to start LSP: ${startError}`);
            vscode_1.window.showErrorMessage(`Failed to start Uranite LSP: ${startError}`);
        }
    });
}
function stopLanguageServer() {
    return __awaiter(this, void 0, void 0, function* () {
        if (languageClient) {
            yield languageClient.stop();
            languageClient = undefined;
        }
    });
}
function activate(extensionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        serverOutputChannel = vscode_1.window.createOutputChannel("Uranite Language Server");
        serverStatusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 10);
        serverStatusBarItem.text = "$(loading~spin) Uranite LSP";
        serverStatusBarItem.tooltip = "Starting language server...";
        serverStatusBarItem.show();
        extensionContext.subscriptions.push(serverStatusBarItem);
        extensionContext.subscriptions.push(vscode_1.commands.registerCommand("uranite.restartServer", () => __awaiter(this, void 0, void 0, function* () {
            serverOutputChannel.appendLine("Restarting Uranite LSP server...");
            yield restartLanguageServer(extensionContext);
        })));
        extensionContext.subscriptions.push(vscode_1.commands.registerCommand("uranite.selectLspPath", () => __awaiter(this, void 0, void 0, function* () {
            const selectedPath = yield selectLspBinaryPath();
            if (selectedPath) {
                serverOutputChannel.appendLine("Restarting with new LSP binary...");
                yield restartLanguageServer(extensionContext);
            }
        })));
        extensionContext.subscriptions.push(vscode_1.commands.registerCommand("uranite.buildFile", () => __awaiter(this, void 0, void 0, function* () {
            const activeEditor = vscode_1.window.activeTextEditor;
            if (!activeEditor || activeEditor.document.languageId !== "uranite") {
                vscode_1.window.showWarningMessage("No active Uranite file to build.");
                return;
            }
            const sourceFilePath = activeEditor.document.uri.fsPath;
            const workspaceFolder = vscode_1.workspace.getWorkspaceFolder(activeEditor.document.uri);
            const buildCommand = vscode_1.workspace
                .getConfiguration("uranite")
                .get("buildCommand", "");
            const compilerPath = buildCommand || (workspaceFolder
                ? path.join(workspaceFolder.uri.fsPath, "build", "uranite")
                : "uranite");
            const outputName = path.basename(sourceFilePath, ".urn");
            const terminal = vscode_1.window.createTerminal("Uranite Build");
            terminal.show();
            terminal.sendText(`${compilerPath} "${sourceFilePath}" -o "${outputName}"`);
        })));
        extensionContext.subscriptions.push(vscode_1.workspace.onDidChangeConfiguration((configChangeEvent) => {
            if (configChangeEvent.affectsConfiguration("uranite.lspPath") ||
                configChangeEvent.affectsConfiguration("uranite.modulesPath")) {
                restartLanguageServer(extensionContext);
            }
        }));
        yield startLanguageServer(extensionContext);
    });
}
exports.activate = activate;
function deactivate() {
    return __awaiter(this, void 0, void 0, function* () {
        yield stopLanguageServer();
    });
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
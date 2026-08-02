import * as path from "path";
import * as fs from "fs";
import {
	ConfigurationTarget,
	ExtensionContext,
	OpenDialogOptions,
	workspace,
	window,
	commands,
	OutputChannel,
	StatusBarItem,
	StatusBarAlignment,
} from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";

let languageClient: LanguageClient | undefined;
let serverOutputChannel: OutputChannel;
let serverStatusBarItem: StatusBarItem;

function resolveServerBinaryPath(extensionContext: ExtensionContext): string | undefined {
	const configuredPath = workspace
		.getConfiguration("uranite")
		.get<string>("lspPath", "");

	if (configuredPath && fs.existsSync(configuredPath)) {
		return configuredPath;
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

async function selectLspBinaryPath(): Promise<string | undefined> {
	const dialogOptions: OpenDialogOptions = {
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		title: "Select Uranite LSP Binary",
		filters: { "Executable": ["*"] },
	};

	const selectedFiles = await window.showOpenDialog(dialogOptions);
	if (!selectedFiles || selectedFiles.length === 0) {
		return undefined;
	}

	const selectedPath = selectedFiles[0].fsPath;

	if (!fs.existsSync(selectedPath)) {
		window.showErrorMessage(`Selected file does not exist: ${selectedPath}`);
		return undefined;
	}

	try {
		fs.accessSync(selectedPath, fs.constants.X_OK);
	} catch {
		const forceUse = await window.showWarningMessage(
			`Selected file is not executable: ${selectedPath}`,
			"Use Anyway",
			"Cancel"
		);
		if (forceUse !== "Use Anyway") {
			return undefined;
		}
	}

	const targetScope = await window.showQuickPick(
		[
			{ label: "User Settings", description: "Apply globally for all workspaces", target: ConfigurationTarget.Global },
			{ label: "Workspace Settings", description: "Apply only to current workspace", target: ConfigurationTarget.Workspace },
		],
		{ placeHolder: "Where should this setting be saved?" }
	);

	if (!targetScope) {
		return undefined;
	}

	await workspace.getConfiguration("uranite").update("lspPath", selectedPath, targetScope.target);
	serverOutputChannel.appendLine(`LSP binary path set to: ${selectedPath}`);
	return selectedPath;
}

async function restartLanguageServer(extensionContext: ExtensionContext): Promise<void> {
	if (restartInProgress) {
		return;
	}
	restartInProgress = true;
	try {
		serverStatusBarItem.text = "$(loading~spin) Uranite LSP";
		await stopLanguageServer();
		await startLanguageServer(extensionContext);
	} finally {
		restartInProgress = false;
	}
}

async function startLanguageServer(extensionContext: ExtensionContext): Promise<void> {
	const serverBinaryPath = resolveServerBinaryPath(extensionContext);
	if (!serverBinaryPath) {
		const userChoice = await window.showWarningMessage(
			"Uranite LSP binary not found. Build the compiler or configure the path.",
			"Browse...",
			"Open Settings"
		);
		if (userChoice === "Browse...") {
			const selectedPath = await selectLspBinaryPath();
			if (selectedPath) {
				await restartLanguageServer(extensionContext);
				return;
			}
		} else if (userChoice === "Open Settings") {
			commands.executeCommand("workbench.action.openSettings", "uranite.lspPath");
		}
		serverStatusBarItem.text = "$(warning) Uranite LSP";
		serverStatusBarItem.tooltip = "Language server binary not found";
		return;
	}

	serverOutputChannel.appendLine(`Starting Uranite LSP: ${serverBinaryPath}`);

	const serverOptions: ServerOptions = {
		command: serverBinaryPath,
		transport: TransportKind.stdio,
	};

	const traceLevel = workspace
		.getConfiguration("uranite")
		.get<string>("trace.server", "off");

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "uranite" }],
		outputChannel: serverOutputChannel,
		traceOutputChannel: serverOutputChannel,
		initializationOptions: {
			semanticHighlighting: workspace
				.getConfiguration("uranite")
				.get<boolean>("semanticHighlighting.enabled", true),
			modulesPath: workspace
				.getConfiguration("uranite")
				.get<string>("modulesPath", ""),
		},
	};

	languageClient = new LanguageClient(
		"uranite-lsp",
		"Uranite Language Server",
		serverOptions,
		clientOptions
	);

	try {
		await languageClient.start();
		serverStatusBarItem.text = "$(check) Uranite LSP";
		serverStatusBarItem.tooltip = `Connected: ${serverBinaryPath}`;
		serverOutputChannel.appendLine("Uranite LSP server started successfully");
	} catch (startError) {
		serverStatusBarItem.text = "$(error) Uranite LSP";
		serverStatusBarItem.tooltip = "Failed to start language server";
		serverOutputChannel.appendLine(`Failed to start LSP: ${startError}`);
		window.showErrorMessage(`Failed to start Uranite LSP: ${startError}`);
	}
}

async function stopLanguageServer(): Promise<void> {
	if (languageClient) {
		await languageClient.stop();
		languageClient = undefined;
	}
}

export async function activate(extensionContext: ExtensionContext): Promise<void> {
	serverOutputChannel = window.createOutputChannel("Uranite Language Server");

	serverStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
	serverStatusBarItem.text = "$(loading~spin) Uranite LSP";
	serverStatusBarItem.tooltip = "Starting language server...";
	serverStatusBarItem.show();
	extensionContext.subscriptions.push(serverStatusBarItem);

	extensionContext.subscriptions.push(
		commands.registerCommand("uranite.restartServer", async () => {
			serverOutputChannel.appendLine("Restarting Uranite LSP server...");
			await restartLanguageServer(extensionContext);
		})
	);

	extensionContext.subscriptions.push(
		commands.registerCommand("uranite.selectLspPath", async () => {
			const selectedPath = await selectLspBinaryPath();
			if (selectedPath) {
				serverOutputChannel.appendLine("Restarting with new LSP binary...");
				await restartLanguageServer(extensionContext);
			}
		})
	);

	extensionContext.subscriptions.push(
		commands.registerCommand("uranite.buildFile", async () => {
			const activeEditor = window.activeTextEditor;
			if (!activeEditor || activeEditor.document.languageId !== "uranite") {
				window.showWarningMessage("No active Uranite file to build.");
				return;
			}

			const sourceFilePath = activeEditor.document.uri.fsPath;
			const workspaceFolder = workspace.getWorkspaceFolder(activeEditor.document.uri);
			const buildCommand = workspace
				.getConfiguration("uranite")
				.get<string>("buildCommand", "");

			const compilerPath = buildCommand || (workspaceFolder
				? path.join(workspaceFolder.uri.fsPath, "build", "uranite")
				: "uranite");

			const outputName = path.basename(sourceFilePath, ".urn");
			const terminal = window.createTerminal("Uranite Build");
			terminal.show();
			terminal.sendText(`${compilerPath} "${sourceFilePath}" -o "${outputName}"`);
		})
	);

	extensionContext.subscriptions.push(
		workspace.onDidChangeConfiguration((configChangeEvent) => {
			if (
				configChangeEvent.affectsConfiguration("uranite.lspPath") ||
				configChangeEvent.affectsConfiguration("uranite.modulesPath")
			) {
				restartLanguageServer(extensionContext);
			}
		})
	);

	await startLanguageServer(extensionContext);
}

export async function deactivate(): Promise<void> {
	await stopLanguageServer();
}

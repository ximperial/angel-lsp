import * as path from 'path';
import {workspace, ExtensionContext, commands, debug, window, WorkspaceEdit, Range, Position, DebugConfigurationProvider, WorkspaceFolder, DebugConfiguration, CancellationToken, ProviderResult} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import * as vscode from "vscode";

let s_client: LanguageClient;
let s_wc3ColorPreview: Wc3ColorPreviewManager | undefined;

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: {module: serverModule, transport: TransportKind.ipc},
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [
            {scheme: 'file', language: 'angelscript'},
            {scheme: 'file', language: 'angelscript-predefined'}
        ],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    // Create the language client and start the client.
    s_client = new LanguageClient(
        'angelScript',
        'AngelScript Language Server',
        serverOptions,
        clientOptions
    );

    // Register custom command
    s_client.onRequest("angelScript/smartBackspace", params1 => {
        console.log(params1); // TODO: Implement this!
    });

    subscribeCommands(context);
    s_wc3ColorPreview = new Wc3ColorPreviewManager(context);

    // Start the client. This will also launch the server
    s_client.start();
}

export function deactivate(): Thenable<void> | undefined {
    s_wc3ColorPreview?.dispose();

    if (!s_client) {
        return undefined;
    }
    return s_client.stop();
}

// -----------------------------------------------

class AngelScriptConfigurationProvider implements DebugConfigurationProvider {
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        return config;
    }

    resolveDebugConfigurationWithSubstitutedVariables(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        return config;
    }
}

class AngelScriptDebugAdapterServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    async createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): Promise<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterServer(session.configuration.port, session.configuration.address);
    }
}

class AngelScriptDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
	createDebugAdapterTracker(session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterTracker> {
		return {};
	}
}

class Wc3ColorPreviewManager implements vscode.Disposable {
    private readonly _disposables: vscode.Disposable[] = [];

    private readonly _decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

    public constructor(context: ExtensionContext) {
        this._disposables.push(
            window.onDidChangeActiveTextEditor(editor => {
                if (editor !== undefined) {
                    this.updateEditor(editor);
                }
            }),
            window.onDidChangeVisibleTextEditors(editors => {
                editors.forEach(editor => this.updateEditor(editor));
            }),
            workspace.onDidChangeTextDocument(event => {
                window.visibleTextEditors
                    .filter(editor => editor.document === event.document)
                    .forEach(editor => this.updateEditor(editor));
            })
        );

        window.visibleTextEditors.forEach(editor => this.updateEditor(editor));
        context.subscriptions.push(this);
    }

    public dispose() {
        this._disposables.forEach(disposable => disposable.dispose());
        this._decorationTypes.forEach(decorationType => decorationType.dispose());
        this._decorationTypes.clear();
    }

    private updateEditor(editor: vscode.TextEditor) {
        if (!isAngelScriptEditor(editor)) {
            this.clearEditor(editor);
            return;
        }

        const rangesByColor = collectWc3ColorRanges(editor.document);
        const activeColors = new Set(rangesByColor.keys());

        for (const [rgba, ranges] of rangesByColor) {
            const decorationType = this.getDecorationType(rgba);
            editor.setDecorations(decorationType, ranges);
        }

        for (const [rgba, decorationType] of this._decorationTypes) {
            if (!activeColors.has(rgba)) {
                editor.setDecorations(decorationType, []);
            }
        }
    }

    private clearEditor(editor: vscode.TextEditor) {
        for (const decorationType of this._decorationTypes.values()) {
            editor.setDecorations(decorationType, []);
        }
    }

    private getDecorationType(rgba: string) {
        const existing = this._decorationTypes.get(rgba);
        if (existing !== undefined) {
            return existing;
        }

        const created = window.createTextEditorDecorationType({
            color: rgba,
        });
        this._decorationTypes.set(rgba, created);
        return created;
    }
}

function isAngelScriptEditor(editor: vscode.TextEditor) {
    const languageId = editor.document.languageId;
    return languageId === 'angelscript' || languageId === 'angelscript-predefined';
}

function collectWc3ColorRanges(document: vscode.TextDocument) {
    const rangesByColor = new Map<string, vscode.Range[]>();
    const text = document.getText();
    const colorBegin = /\|c([0-9A-Fa-f]{8})/g;

    let match: RegExpExecArray | null;
    while ((match = colorBegin.exec(text)) !== null) {
        const color = match[1];
        const coloredTextStart = match.index + match[0].length;
        const resetIndex = text.indexOf('|r', coloredTextStart);
        if (resetIndex === -1 || resetIndex <= coloredTextStart) {
            continue;
        }

        const rgba = wc3HexToCssColor(color);
        const start = document.positionAt(coloredTextStart);
        const end = document.positionAt(resetIndex);
        const ranges = rangesByColor.get(rgba) ?? [];
        ranges.push(new Range(start, end));
        rangesByColor.set(rgba, ranges);
    }

    return rangesByColor;
}

function wc3HexToCssColor(argb: string) {
    const alpha = parseInt(argb.slice(0, 2), 16) / 255;
    const red = parseInt(argb.slice(2, 4), 16);
    const green = parseInt(argb.slice(4, 6), 16);
    const blue = parseInt(argb.slice(6, 8), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
}

function subscribeCommands(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand('angelScript.debug.printGlobalScope', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const uri = editor.document.uri.toString();
                const result = await s_client.sendRequest("angelScript/printGlobalScope", {uri: uri});
                vscode.window.showInformationMessage(`Print Global Scope: ${result}`);
            } else {
                vscode.window.showInformationMessage('No active editor');
            }
        })
    );
    context.subscriptions.push(debug.registerDebugConfigurationProvider("angel-lsp-dap", new AngelScriptConfigurationProvider()));
    context.subscriptions.push(debug.registerDebugAdapterDescriptorFactory("angel-lsp-dap", new AngelScriptDebugAdapterServerDescriptorFactory()));
    context.subscriptions.push(debug.registerDebugAdapterTrackerFactory("angel-lsp-dap", new AngelScriptDebugAdapterTrackerFactory()));
}

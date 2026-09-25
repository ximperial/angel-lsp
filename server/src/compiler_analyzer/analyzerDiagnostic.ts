import * as lsp from 'vscode-languageserver/node';
import {getGlobalSettings} from '../core/settings';
import {TextLocation} from '../compiler_tokenizer/textLocation';
import {ActionHint} from './actionHint';

const sourceName = 'AngelScript - Analyzer';

const s_sessionStack: lsp.Diagnostic[][] = [];

function beginSession() {
    s_sessionStack.push([]);
}

function error(location: TextLocation, message: string) {
    const severity = getGlobalSettings().suppressAnalyzerErrors
        ? lsp.DiagnosticSeverity.Warning
        : lsp.DiagnosticSeverity.Error;
    const currentSession = s_sessionStack.at(-1);
    if (currentSession === undefined) {
        throw new Error('analyzerDiagnostic.error() called without active session');
    }

    currentSession.push({
        severity: severity,
        range: location.clone(),
        message: message,
        source: sourceName
    });
}

function hint(location: TextLocation, hint: ActionHint, message: string) {
    const currentSession = s_sessionStack.at(-1);
    if (currentSession === undefined) {
        throw new Error('analyzerDiagnostic.hint() called without active session');
    }

    currentSession.push({
        severity: lsp.DiagnosticSeverity.Hint,
        range: location.clone(),
        message: message,
        source: sourceName,
        data: hint
    });
}

function endSession(): lsp.Diagnostic[] {
    return s_sessionStack.pop() ?? [];
}

export const analyzerDiagnostic = {
    beginSession,
    error,
    hint,
    endSession
} as const;

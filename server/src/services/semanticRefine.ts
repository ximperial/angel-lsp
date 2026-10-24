import {TokenObject} from '../compiler_tokenizer/tokenObject';
import {TokenHighlight, TokenHighlightModifier} from '../core/highlight';
import {NodeName} from '../compiler_parser/nodeObject';
import {SymbolGlobalScope, SymbolScope} from '../compiler_analyzer/symbolScope';
import {SymbolObject, VariableSymbol} from '../compiler_analyzer/symbolObject';

// The parser highlights every identifier as 'variable' because it cannot know what a name refers to.
// After analysis we know, so retag each identifier by its resolved symbol
// (property / parameter / method / enumMember / class ...).

interface HighlightInfo {
    type: TokenHighlight;
    modifier: number; // Bitmask: bit i = tokenHighlightModifierList[i]
}

const modifierBit = (modifier: TokenHighlightModifier) => 1 << modifier;

function normalizePath(path: string): string {
    try {
        return decodeURIComponent(path).toLowerCase();
    } catch {
        return path.toLowerCase();
    }
}

function isPredefinedToken(token: TokenObject): boolean {
    return token.location.path.endsWith('as.predefined');
}

function isParameter(scope: SymbolScope | undefined, token: TokenObject): boolean {
    const node = scope?.linkedNode;
    if (node?.nodeName === NodeName.Func) {
        return node.paramList.params.some(param => param.identifier === token);
    } else if (node?.nodeName === NodeName.Lambda) {
        return node.paramList.some(param => param.identifier === token);
    }

    return false;
}

function classifyVariable(globalScope: SymbolGlobalScope, symbol: VariableSymbol, modifier: number): HighlightInfo {
    const readonly = modifierBit(TokenHighlightModifier.Readonly);
    if (symbol.identifierToken.highlight.tokenHighlight === TokenHighlight.EnumMember) {
        return {type: TokenHighlight.EnumMember, modifier: modifier | readonly};
    }

    const scope = globalScope.resolveScope(symbol.scopePath);
    if (scope?.linkedNode?.nodeName === NodeName.Enum) {
        return {type: TokenHighlight.EnumMember, modifier: modifier | readonly};
    }

    if (symbol.type?.isConst === true) {
        modifier |= readonly;
    }

    if (symbol.isInstanceMember) {
        return {type: TokenHighlight.Property, modifier};
    } else if (isParameter(scope, symbol.identifierToken)) {
        return {type: TokenHighlight.Parameter, modifier};
    }

    if (symbol.scopePath.length === 0 || scope?.isPureNamespaceScope() === true) {
        // Global or namespace-level variable
        modifier |= modifierBit(TokenHighlightModifier.Static);
    }

    return {type: TokenHighlight.Variable, modifier};
}

function classify(globalScope: SymbolGlobalScope, symbol: SymbolObject): HighlightInfo | undefined {
    const modifier = isPredefinedToken(symbol.identifierToken) ? modifierBit(TokenHighlightModifier.DefaultLibrary) : 0;

    if (symbol.isVariable()) {
        return classifyVariable(globalScope, symbol, modifier);
    } else if (symbol.isFunction()) {
        return {type: symbol.isInstanceMember ? TokenHighlight.Method : TokenHighlight.Function, modifier};
    } else if (symbol.isType()) {
        if (symbol.isTemplateParameterType) {
            return {type: TokenHighlight.TypeParameter, modifier};
        }

        switch (symbol.linkedNode?.nodeName) {
        case NodeName.Enum:
            return {type: TokenHighlight.Enum, modifier};
        case NodeName.Interface:
            return {type: TokenHighlight.Interface, modifier};
        case NodeName.Class:
            return {type: TokenHighlight.Class, modifier};
        default:
            return {type: TokenHighlight.Type, modifier};
        }
    }

    return undefined;
}

function applyHighlight(token: TokenObject, info: HighlightInfo | undefined) {
    if (info === undefined || token.isIdentifierToken() === false || token.isVirtual()) {
        return;
    }

    token.setHighlight(info.type, info.modifier as TokenHighlightModifier);
}

// The merged global scope also holds every included file; only subtrees that the file contributed to can hold
// its declarations, so the rest (e.g. all of as.predefined) is skipped.
function forEachSymbol(scope: SymbolScope, filepath: string, visit: (symbol: SymbolObject) => void) {
    for (const holder of scope.symbolTable.values()) {
        holder.toList().forEach(visit);
    }

    for (const child of scope.childScopeTable.values()) {
        if (child.hasContributor(filepath)) {
            forEachSymbol(child, filepath, visit);
        }
    }
}

/**
 * Retag identifier highlights in the file `uri` using the analyzed global scope.
 * Covers both declarations and references located in that file.
 */
export function refineSemanticHighlights(uri: string, globalScope: SymbolGlobalScope) {
    const targetPath = normalizePath(uri);
    const pathMatchCache = new Map<string, boolean>();
    const isInTarget = (token: TokenObject): boolean => {
        const path = token.location.path;
        if (path === '') {
            return false;
        }

        let matched = pathMatchCache.get(path);
        if (matched === undefined) {
            matched = normalizePath(path) === targetPath;
            pathMatchCache.set(path, matched);
        }

        return matched;
    };

    const infoCache = new Map<SymbolObject, HighlightInfo | undefined>();
    const classifyCached = (symbol: SymbolObject) => {
        if (infoCache.has(symbol) === false) {
            infoCache.set(symbol, classify(globalScope, symbol));
        }

        return infoCache.get(symbol);
    };

    try {
        const declaration = modifierBit(TokenHighlightModifier.Declaration);
        forEachSymbol(globalScope, globalScope.getContext().filepath, symbol => {
            if (isInTarget(symbol.identifierToken) === false) {
                return;
            }

            const info = classifyCached(symbol);
            if (info !== undefined) {
                applyHighlight(symbol.identifierToken, {type: info.type, modifier: info.modifier | declaration});
            }
        });

        for (const reference of globalScope.markers.reference) {
            if (isInTarget(reference.fromToken)) {
                applyHighlight(reference.fromToken, classifyCached(reference.toSymbol));
            }
        }
    } catch (e) {
        // Highlighting is cosmetic, so it must never break the analysis.
    }
}

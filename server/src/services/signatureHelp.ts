import {FunctionSymbol} from '../compiler_analyzer/symbolObject';
import {Position, SignatureHelp, URI} from 'vscode-languageserver';
import {ParameterInformation, SignatureInformation} from 'vscode-languageserver-types';
import {FunctionCallMarker} from '../compiler_analyzer/marker';
import {SymbolGlobalScope} from '../compiler_analyzer/symbolScope';
import {TextPosition} from '../compiler_tokenizer/textLocation';
import {applyTemplateMapping} from '../compiler_analyzer/resolvedType';
import {getDocumentCommentOfSymbol} from './utils';
import {stringifyResolvedType} from '../compiler_analyzer/symbolStringifier';
import {areFunctionsOverloadEquals} from '../compiler_analyzer/functionOverload';
import {Node_Parameter} from '../compiler_parser/nodeObject';

export function provideSignatureHelp(
    globalScope: SymbolGlobalScope,
    caret: Position,
    uri: URI,
    previousHelp?: SignatureHelp
): SignatureHelp {
    const caretPosition = new TextPosition(caret.line, caret.character);

    // Since the nesting is deeper toward the end, iterate from the back.
    const markers = globalScope.markers.functionCall;
    for (let i = markers.length - 1; i >= 0; i--) {
        const info = markers[i];

        // Check if the caller location is at the cursor position in the scope.
        const shouldExtend = info.callerArgumentsNode.nodeRange.end.text == ','; // ',' indicates that user is still typing.
        const location = info.callerArgumentsNode.nodeRange.extendForward(shouldExtend ? 1 : 0); // Extend to the next token of ')'
        if (location.getBoundingLocation().positionInRange(caret) === false) {
            continue;
        }

        const callee = sortFunctionsByPriority(info.calleeFuncHolder.overloadList)[0];
        const expectedCallee = globalScope
            .resolveScope(callee.scopePath)
            ?.lookupSymbolWithParent(callee.actualIdentifierToken.text);
        if (!expectedCallee?.isFunctionHolder()) {
            continue;
        }

        const overloads = dropDuplicateSignatures(sortFunctionsByPriority(expectedCallee.overloadList));
        const activeArg = getActiveArgument(info, caretPosition);
        const signatures = overloads.map(overload => getFunctionSignature(info, overload, activeArg));

        return {
            signatures: signatures,
            activeSignature: selectActiveSignature(info, overloads, signatures, activeArg, previousHelp)
        };
    }

    return {signatures: []};
}

interface ActiveArgument {
    /** Index of the argument under the caret, counting commas typed so far. */
    readonly index: number;

    /** The name if the argument under the caret is a named argument such as `name: value`. */
    readonly name: string | undefined;

    /** The number of arguments the caller has started typing. */
    readonly count: number;
}

function getActiveArgument(info: FunctionCallMarker, caret: TextPosition): ActiveArgument {
    const argList = info.callerArgumentsNode.argList;

    let index = 0;
    for (let i = 0; i < argList.length; i++) {
        const range = argList[i].assign.nodeRange;
        if (caret.isLessThan(range.start.location.start)) {
            break;
        }

        index = i;
        const comma = range.end.next;
        if (comma?.text === ',' && caret.isLessThan(comma.location.end) === false) {
            index = i + 1;
        }
    }

    const name = index < argList.length ? argList[index].identifier?.text : undefined;
    return {index: index, name: name, count: Math.max(argList.length, index + 1)};
}

function getFunctionSignature(info: FunctionCallMarker, expectedCallee: FunctionSymbol, activeArg: ActiveArgument) {
    const params = expectedCallee.linkedNode.paramList.params;
    const parameters: ParameterInformation[] = [];

    let signatureLabel = expectedCallee.actualIdentifierToken.text + '(';
    for (let i = 0; i < params.length; i++) {
        const param = params[i];
        const paramType = expectedCallee.parameterTypes[i];

        let label = stringifyResolvedType(applyTemplateMapping(paramType, info.calleeTemplateMapping));
        if (param.identifier !== undefined) {
            label += ' ' + param.identifier.text;
        }

        if (param.isVariadic) {
            label += ' ...';
        }

        if (i > 0) {
            signatureLabel += ', ';
        }

        // Offsets make the client highlight the exact parameter even when two parameters share a label.
        const labelStart = signatureLabel.length;
        signatureLabel += label;
        parameters.push({label: [labelStart, signatureLabel.length]});
    }

    signatureLabel += ')';

    const signature: SignatureInformation = {
        label: signatureLabel,
        parameters: parameters,
        activeParameter: getActiveParameterIndex(params, activeArg),
        documentation: getDocumentCommentOfSymbol(expectedCallee)
    };

    return signature;
}

function getActiveParameterIndex(params: readonly Node_Parameter[], activeArg: ActiveArgument): number {
    if (activeArg.name !== undefined) {
        const namedIndex = params.findIndex(param => param.identifier?.text === activeArg.name);
        if (namedIndex >= 0) {
            return namedIndex;
        }
    }

    if (activeArg.index >= params.length && params.length > 0 && params[params.length - 1].isVariadic) {
        return params.length - 1;
    }

    // An index past the end tells the client not to highlight anything, which signals "too many arguments".
    return activeArg.index;
}

function canAcceptArgumentCount(callee: FunctionSymbol, count: number): boolean {
    const params = callee.linkedNode.paramList.params;
    return count <= params.length || (params.length > 0 && params[params.length - 1].isVariadic);
}

function selectActiveSignature(
    info: FunctionCallMarker,
    overloads: readonly FunctionSymbol[],
    signatures: readonly SignatureInformation[],
    activeArg: ActiveArgument,
    previousHelp: SignatureHelp | undefined
): number {
    // The overload the analyzer actually resolved is the most reliable answer.
    const resolved = info.resolvedCallee;
    if (resolved !== undefined) {
        const resolvedIndex = overloads.findIndex(
            overload => overload === resolved || areFunctionsOverloadEquals(overload, resolved)
        );
        if (resolvedIndex >= 0) {
            return resolvedIndex;
        }
    }

    // While the call is incomplete, keep the overload the user picked with the arrow keys if it still fits.
    const previousIndex = previousHelp?.activeSignature;
    if (previousIndex !== undefined && previousHelp !== undefined) {
        const previousLabel = previousHelp.signatures[previousIndex]?.label;
        const sameIndex = signatures.findIndex(signature => signature.label === previousLabel);
        if (sameIndex >= 0 && canAcceptArgumentCount(overloads[sameIndex], activeArg.count)) {
            return sameIndex;
        }
    }

    // Otherwise choose the overload with the fewest parameters that still accepts what has been typed.
    let bestIndex = -1;
    for (let i = 0; i < overloads.length; i++) {
        if (canAcceptArgumentCount(overloads[i], activeArg.count) === false) {
            continue;
        }

        if (
            bestIndex < 0 ||
            overloads[i].linkedNode.paramList.params.length < overloads[bestIndex].linkedNode.paramList.params.length
        ) {
            bestIndex = i;
        }
    }

    return Math.max(bestIndex, 0);
}

// as.predefined may redeclare a project function with the same parameters; showing both only adds noise.
function dropDuplicateSignatures(functions: FunctionSymbol[]): FunctionSymbol[] {
    return functions.filter(
        (func, index) => functions.slice(0, index).some(earlier => areFunctionsOverloadEquals(earlier, func)) === false
    );
}

// Project declarations are listed before as.predefined ones that they redeclare.
function sortFunctionsByPriority(functions: readonly FunctionSymbol[]): FunctionSymbol[] {
    return [...functions].sort((lhs, rhs) => getFunctionPriority(lhs) - getFunctionPriority(rhs));
}

function getFunctionPriority(symbol: FunctionSymbol): number {
    return symbol.identifierToken.location.path.endsWith('as.predefined') ? 1 : 0;
}

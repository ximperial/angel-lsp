import {provideSignatureHelp} from '../../../src/services/signatureHelp';
import {inspectFileContents, makeFileContentList} from '../../inspectorUtils';
import {CaretMap} from '../caretMap';
import {SignatureHelp} from 'vscode-languageserver';

function signatureHelpAt(content: string, caretIndex: number, previousHelp?: SignatureHelp): SignatureHelp {
    const fileContentList = makeFileContentList([{uri: 'file:///path/to/file_1.as', content: content}]);

    const caretMap = new CaretMap();
    caretMap.processFiles(fileContentList);

    const inspector = inspectFileContents(fileContentList);
    const target = caretMap.get(caretIndex);
    const globalScope = inspector.getRecord(target.uri).analyzerScope.globalScope;

    return provideSignatureHelp(
        globalScope,
        {line: target.position.line, character: target.position.character},
        target.uri,
        previousHelp
    );
}

function expectActive(help: SignatureHelp, label: string, activeParameter: number) {
    const active = help.signatures[help.activeSignature ?? 0];
    if (active?.label !== label) {
        throw new Error(`Expected active signature '${label}', got '${active?.label}'`);
    }

    if (active.activeParameter !== activeParameter) {
        throw new Error(`Expected active parameter ${activeParameter}, got ${active.activeParameter}`);
    }
}

const overloadSource = `
    void Damage(int target) {}
    void Damage(int target, float amount) {}
    void Damage(int target, float amount, bool pure) {}
    void Damage(bool flag) {}

    void main() {
        Damage(true$C0$);
        Damage(1, 2.0f$C1$);
        Damage(1, $C2$
        Damage(1, 2.0f, true, $C3$
        Damage($C4$);
    }
`;

describe('signatureHelp/overload', () => {
    it('selects the overload resolved by argument types', () => {
        expectActive(signatureHelpAt(overloadSource, 0), 'Damage(bool flag)', 0);
    });

    it('selects the overload resolved by argument count', () => {
        expectActive(signatureHelpAt(overloadSource, 1), 'Damage(int target, float amount)', 1);
    });

    it('selects the smallest overload that fits an incomplete call', () => {
        expectActive(signatureHelpAt(overloadSource, 2), 'Damage(int target, float amount)', 1);
    });

    it('does not highlight a parameter when too many arguments are typed', () => {
        const help = signatureHelpAt(overloadSource, 3);
        const active = help.signatures[help.activeSignature ?? 0];
        if (active.activeParameter !== 3) {
            throw new Error(`Expected out-of-range active parameter 3, got ${active.activeParameter}`);
        }
    });

    it('keeps the overload the user picked while it still fits', () => {
        const first = signatureHelpAt(overloadSource, 4);
        const picked = first.signatures.findIndex(signature => signature.label === 'Damage(int target, float amount, bool pure)');
        expectActive(signatureHelpAt(overloadSource, 4, {...first, activeSignature: picked}), 'Damage(int target, float amount, bool pure)', 0);
    });

    it('uses label offsets so duplicate parameter labels highlight correctly', () => {
        const help = signatureHelpAt(
            `
            void Pair(int v, int v) {}
            void main() { Pair(1, $C0$); }
            `,
            0
        );
        const signature = help.signatures[0];
        const label = signature.parameters![1].label as [number, number];
        if (signature.label.substring(label[0], label[1]) !== 'int v' || label[0] === 5) {
            throw new Error(`Unexpected second parameter offsets ${JSON.stringify(label)}`);
        }
    });
});

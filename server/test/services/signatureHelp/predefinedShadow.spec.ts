import {provideSignatureHelp} from "../../../src/services/signatureHelp";
import {inspectFileContents, makeFileContentList} from "../../inspectorUtils";
import {CaretMap} from "../caretMap";

describe('signatureHelp/predefinedShadow', () => {
    it('prefers project overload details over predefined duplicates', () => {
        const fileContentList = makeFileContentList([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                    void SetupMap(int ticks);
                `
            },
            {
                uri: 'file:///path/to/file_1.as',
                content: `
                    void SetupMap(int delay) {
                    }

                    void main() {
                        SetupMap($C0$);
                    }
                `
            }
        ]);

        const caretMap = new CaretMap();
        caretMap.processFiles(fileContentList);

        const inspector = inspectFileContents(fileContentList);
        const target = caretMap.get(0);
        const globalScope = inspector.getRecord(target.uri).analyzerScope.globalScope;

        const help = provideSignatureHelp(
            globalScope,
            {line: target.position.line, character: target.position.character},
            target.uri
        );

        if (help.signatures.length === 0) {
            throw new Error('Expected at least one signature');
        }

        if (help.signatures[0].label !== 'SetupMap(int delay)') {
            throw new Error(`Expected project signature first, got '${help.signatures[0].label}'`);
        }
    });
});

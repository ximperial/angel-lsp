import {provideCompletion} from "../../../src/services/completion";
import {inspectFileContents, makeFileContentList} from "../../inspectorUtils";
import {CaretMap} from "../caretMap";

describe('completion/predefinedShadow', () => {
    it('prefers project symbols over predefined symbols for duplicate labels', () => {
        const fileContentList = makeFileContentList([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                    class UnitData {
                        int health;
                    }
                `
            },
            {
                uri: 'file:///path/to/file_1.as',
                content: `
                    class UnitData {
                        int mana;
                    }

                    void main() {
                        Unit$C0$
                    }
                `
            }
        ]);

        const caretMap = new CaretMap();
        caretMap.processFiles(fileContentList);

        const inspector = inspectFileContents(fileContentList);
        const target = caretMap.get(0);
        const globalScope = inspector.getRecord(target.uri).analyzerScope.globalScope;

        const completions = provideCompletion(globalScope, target.position)
            .filter(item => item.item.label === 'UnitData');

        if (completions.length !== 1) {
            throw new Error(`Expected one UnitData completion, but got ${completions.length}`);
        }

        const symbol = completions[0].symbol;
        if (symbol === undefined || symbol.toList()[0].identifierToken.location.path !== 'file:///path/to/file_1.as') {
            throw new Error('Expected UnitData completion to prefer project symbol from file_1.as');
        }
    });
});

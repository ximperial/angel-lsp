import {ok} from 'node:assert';
import {DiagnosticSeverity} from 'vscode-languageserver-types';
import {inspectFileContents, makeFileContentList} from '../../inspectorUtils';

// A derived class in an included file may inherit a base declared later in the including file.
// Only the including file is checked: file_mid.as on its own does not see Base, which is expected.
describe('analyzer/freeDeclareIncludeMix', () => {
    it('resolves a base class declared after the include in the including file', () => {
        const fileContentList = makeFileContentList([
            {
                uri: 'file:///path/to/file_mid.as',
                content: `
                    class Mid : Base {
                        int midValue;
                    }
                `
            },
            {
                uri: 'file:///path/to/main.as',
                content: `
                    #include "file_mid.as"

                    class Leaf : Mid {
                        int total() {
                            return baseValue + midValue;
                        }
                    }

                    class Base {
                        int baseValue;
                    }
                `
            }
        ]);

        const record = inspectFileContents(fileContentList).getRecord('file:///path/to/main.as');
        const problems = [...record.diagnosticsInParser, ...record.diagnosticsInAnalyzer].filter(
            diagnostic =>
                diagnostic.severity === DiagnosticSeverity.Error || diagnostic.severity === DiagnosticSeverity.Warning
        );

        ok(problems.length === 0, problems.map(problem => problem.message).join(', '));
    });
});

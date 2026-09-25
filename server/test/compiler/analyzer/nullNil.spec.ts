import {expectError, expectSuccess} from './utils';

describe('analyzer/nullNil', () => {
    it('accepts case 1', () => {
        expectSuccess(`// null can be assigned to AngelScript handles.
            class Foo { }

            void main() {
                Foo@ a = null;
            }
        `);
    });

    it('accepts case 2', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                class handle { }
                class agent : handle { }
                class war3image : agent { }
                class widget : war3image { }
                class unit : widget { }
                class player : agent { }
                class ability : agent { }
                class buff : ability { }
                class unitpool : handle { }
                class effect : war3image { }
            `
            },
            {
                uri: 'file:///path/to/file.as',
                content: `// nil follows the Warcraft handle hierarchy from common.j.
                void main() {
                    handle anyHandle = nil;
                    player whichPlayer = nil;
                    unit whichUnit = nil;
                    buff whichBuff = nil;
                    unitpool whichPool = nil;
                    effect whichEffect = nil;
                }
            `
            }
        ]);
    });

    it('rejects case 3', () => {
        expectError(`// null cannot be assigned to non-handle types.
            class Foo { }

            void main() {
                Foo value = null;
            }
        `);
    });

    it('rejects case 4', () => {
        expectError(`// nil cannot be assigned to primitive types.
            void main() {
                int value = nil;
            }
        `);
    });

    it('rejects case 5', () => {
        expectError(`// nil cannot be assigned to ordinary AngelScript handles.
            class Foo { }

            void main() {
                Foo@ value = nil;
            }
        `);
    });
});

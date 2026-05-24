import {expectSuccess} from "./utils";

describe('analyzer/warcraftHandleIntCast', () => {
    expectSuccess([{
        uri: 'file:///path/to/as.predefined',
        content: `
            class handle { }
            class flagtype : handle { }
            class targetflag : flagtype { }
            void AcceptInt(int value);
            const targetflag TARGET_FLAG_EMPTY;
        `
    }, {
        uri: 'file:///path/to/file.as',
        content: `
            void main() {
                AcceptInt(TARGET_FLAG_EMPTY);
            }
        `
    }]);
});

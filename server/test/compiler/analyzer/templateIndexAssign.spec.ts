import {expectSuccess} from "./utils";

describe('analyzer/templateIndexAssign', () => {
    expectSuccess([{
        uri: 'file:///path/to/as.predefined',
        content: `
            class array<T> {
                T& opIndex(uint index);
                const T& opIndex(uint index) const;
                uint length() const;
            }
        `
    }, {
        uri: 'file:///path/to/file.as',
        content: `
            void main() {
                array<bool> flags;
                flags[0] = true;
            }
        `
    }]);
});

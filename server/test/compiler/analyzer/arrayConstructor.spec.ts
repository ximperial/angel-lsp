import {expectSuccess} from './utils';

describe('analyzer/arrayConstructor', () => {
    it('accepts case 1', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                class array<T> {
                    array();
                    array(uint length);
                    array(uint length, const T&in value);
                    array(const array<T>&in other);
                    T& opIndex(uint index);
                    const T& opIndex(uint index) const;
                    uint length() const;
                }
            `
            },
            {
                uri: 'file:///path/to/file.as',
                content: `
                void main() {
                    array<int> empty();
                    array<int> sized(5);
                    array<int> filled(5, 1);
                    array<int> copied(filled);
                }
            `
            }
        ]);
    });
});

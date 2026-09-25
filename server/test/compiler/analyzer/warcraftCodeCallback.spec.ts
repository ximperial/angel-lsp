import {expectSuccess} from './utils';

describe('analyzer/warcraftCodeCallback', () => {
    it('accepts case 1', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                class code { }
                class boolexpr { }
                boolexpr Filter(code func);
                void HandleListEnumUnitsInRange(int list, float x, float y, float radius, boolexpr filter);
            `
            },
            {
                uri: 'file:///path/to/file.as',
                content: `
                bool BurstDamageInRangeFilter() {
                    return true;
                }

                void main() {
                    HandleListEnumUnitsInRange(0, 0.f, 0.f, 100.f, Filter(@BurstDamageInRangeFilter));
                }
            `
            }
        ]);
    });
});

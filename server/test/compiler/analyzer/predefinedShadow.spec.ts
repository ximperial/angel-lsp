import {expectSuccess} from './utils';

describe('analyzer/predefinedShadow', () => {
    it('accepts case 1', () => {
        expectSuccess([
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
                        UnitData data;
                        data.mana = 1;
                    }
                `
            }
        ]);
    });
});

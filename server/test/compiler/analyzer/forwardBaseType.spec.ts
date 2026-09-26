import {expectSuccess} from './utils';

describe('analyzer/forwardBaseType', () => {
    it('accepts case 1', () => {
        expectSuccess(`
            class Derived : Base {
                int value;
            }

            class Base {
                int health;
            }
        `);
    });

    it('accepts case 2', () => {
        expectSuccess(`
            class DerivedBuff : Buff {
                int stacks;
            }

            class Buff {
                int duration;
            }
        `);
    });
});

import {expectSuccess} from "./utils";

describe('analyzer/forwardBaseType', () => {
    expectSuccess(`
        class Derived : Base {
            int value;
        }

        class Base {
            int health;
        }
    `);

    expectSuccess(`
        class DerivedBuff : Buff {
            int stacks;
        }

        class Buff {
            int duration;
        }
    `);
});

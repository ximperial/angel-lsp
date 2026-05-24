import {testDefinition} from "./utils";

describe('definition/predefinedShadow', () => {
    testDefinition([
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
                class UnitData$C0$ {
                    int mana;
                }

                void main() {
                    UnitData$C1$ data;
                }
            `
        }
    ]);
});

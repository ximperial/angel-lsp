import {expectSuccess} from "./utils";

describe('analyzer/freeDeclareIncludeMix', () => {
    expectSuccess([
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
});

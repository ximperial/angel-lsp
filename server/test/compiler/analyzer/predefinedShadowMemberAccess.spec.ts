import {expectSuccess} from "./utils";

describe('analyzer/predefinedShadowMemberAccess', () => {
    expectSuccess([
        {
            uri: 'file:///path/to/as.predefined',
            content: `
                class Payload {
                    int oldField;
                }
            `
        },
        {
            uri: 'file:///path/to/file_1.as',
            content: `
                class Payload {
                    int newField;
                }

                void main() {
                    Payload payload;
                    payload.newField = 3;
                }
            `
        }
    ]);
});

import {expectSuccess} from "./utils";

describe('analyzer/predefinedInclude', () => {
    expectSuccess([
        {
            uri: 'file:///path/to/as.predefined',
            content: `
                #include "my.as.predefined"
            `
        },
        {
            uri: 'file:///path/to/my.as.predefined',
            content: `
                namespace MoonJava {
                    void ScheduleMapInitialization();
                    void ConfigureMapSetup();
                }
            `
        },
        {
            uri: 'file:///path/to/war3map.as',
            content: `
                void main() {
                    MoonJava::ScheduleMapInitialization();
                }

                void config() {
                    MoonJava::ConfigureMapSetup();
                }
            `
        }
    ]);
});

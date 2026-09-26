import {expectSuccess} from './utils';

describe('analyzer/predefinedTransitiveInclude', () => {
    it('accepts case 1', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                    #include "Game.as"
                `
            },
            {
                uri: 'file:///path/to/Game.as',
                content: `
                    #include "InitHelpers.as"

                    namespace MoonJava {
                        void ConfigureMapSetup() {
                            ScheduleMapInitialization();
                        }
                    }
                `
            },
            {
                uri: 'file:///path/to/InitHelpers.as',
                content: `
                    namespace MoonJava {
                        void ScheduleMapInitialization() {
                        }
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
});

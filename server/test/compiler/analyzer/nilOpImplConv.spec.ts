import {expectSuccess} from "./utils";

describe('analyzer/nilOpImplConv', () => {
    // Types like `buff` in Warcraft JASS don't extend `handle` directly.
    // Instead, `niltype` declares `buff opImplConv() const`, meaning nil is
    // assignable to buff via opImplConv on niltype.
    expectSuccess([{
        uri: 'file:///path/to/as.predefined',
        content: `
            class buff {
                buff(int);
                int opImplConv() const;
                niltype opImplConv() const;
                bool opEquals(const niltype&in) const;
            }
            class niltype {
                niltype(int);
                int opImplConv() const;
                buff opImplConv() const;
                bool opEquals(const buff&in) const;
            }
        `
    }, {
        uri: 'file:///path/to/file.as',
        content: `
            void main() {
                buff buffs = nil;
                buffs = nil;
            }
        `
    }]);
});

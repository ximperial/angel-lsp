import {formatFile} from '../src/formatter/formatter';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {Inspector} from '../src/inspector/inspector';

function makeVisible(content: string) {
    const lines = content.split(/\r?\n/);
    return lines
        .map((line, index) => {
            return `${index}: '${line}'`;
        })
        .join('\n');
}

function getDiffLineNumber(expected: string, actual: string) {
    const expectedLines = expected.split('\n');
    const actualLines = actual.split('\n');
    const diffLines = [];
    for (let i = 0; i < expectedLines.length; i++) {
        if (expectedLines[i] !== actualLines[i]) {
            diffLines.push(i);
        }
    }

    return diffLines;
}

function testFormatter(content: string, expectedContent: string) {
    it(`format ${content}`, () => {
        const inspector = new Inspector();

        const uri = '/foo/bar.as';
        inspector.inspectFile(uri, content);

        inspector.flushRecord();

        const record = inspector.getRecord(uri);

        const textEdits = formatFile(record.content, record.rawTokens, record.ast);
        const document = TextDocument.create(uri, 'angelscript', 0, content);
        const actualContent = TextDocument.applyEdits(document, textEdits);

        if (expectedContent.includes('\t')) {
            expectedContent.replace('\n', '    ');
        }

        const actual = actualContent.trim();
        const expected = expectedContent.trim();

        if (actual !== expected) {
            const difference = `difference: ${getDiffLineNumber(expected, actual)}`;
            const hr = '-----------------------------------------------';
            throw new Error(
                `${hr} expected\n${makeVisible(expected)}\n${hr} actual\n${makeVisible(actual)}\n${hr}\n${difference}`
            );
        }
    });
}

describe('Formatter', () => {
    testFormatter(
        /* before */ `
class    Position {
    int x ;    // comment    is    here
    int   y ;
        }

void main ( )  {
        Position pos;
pos.x=1; }
`,
        /* after */ `
class Position {
    int x;    // comment    is    here
    int y;
}

void main() {
    Position pos;
    pos.x = 1;
}
`
    );

    testFormatter(
        /* before */ `
void foo(){
if( not  value or not( ~ bar>1 and ++ bar<10) ){
return;}}
`,
        /* after */ `
void foo() {
    if (not value or not (~bar > 1 and ++bar < 10)) {
        return;
    }
}
`
    );

    testFormatter(
        /* before */ `
void foo(){
if( not not  value or not( ~ bar>1 and ++ bar<10) ){
return;}}
`,
        /* after */ `
void foo() {
    if (not not value or not (~bar > 1 and ++bar < 10)) {
        return;
    }
}
`
    );

    // Fork: empty blocks keep what the author wrote, so `{}` stays `{}` (upstream prints `{ }`).
    testFormatter(
        /* before */ `
class script:callback_base,something_else{}
`,
        /* after */ `
class script : callback_base, something_else {}
`
    );

    testFormatter(
        /* before */ `
interface IChild:IBase{}
`,
        /* after */ `
interface IChild : IBase {}
`
    );

    testFormatter(
        /* before */ `
class Child:NS::Base{}
`,
        /* after */ `
class Child : NS::Base {}
`
    );

    testFormatter(
        /* before */ `
class Child : ::Base {}
`,
        /* after */ `
class Child : ::Base {}
`
    );

    testFormatter(
        /* before */ `
class Child{}
`,
        /* after */ `
class Child {}
`
    );
});

describe('formatter if/else', () => {
    // else setelah statement non-block jangan ditempel ke baris sebelumnya; `} else` tetap satu baris.
    testFormatter(
        /* before */ `
void main() {
    int a = 0;
    if (a == 1) a = 2;
    else if (a == 3) a = 4;
    else continue;
    if (a == 5) {
        a = 6;
    } else {
        a = 7;
    }
}
`,
        /* after */ `
void main() {
    int a = 0;
    if (a == 1) a = 2;
    else if (a == 3) a = 4;
    else continue;
    if (a == 5) {
        a = 6;
    } else {
        a = 7;
    }
}
`
    );
});

describe('formatter repo style', () => {
    // switch: spasi sebelum '(' dan case menjorok; komentar ujung baris, param lanjutan, dan `&in` dibiarkan.
    testFormatter(
        /* before */ `
void f(int a,
    const string &in s) {
    int x = 1;   // satu
    int yy = 2;  // dua
    switch (a) {
        case 0: x = 1; break;
        default: break;
    }
}
`,
        /* after */ `
void f(int a,
    const string &in s) {
    int x = 1;   // satu
    int yy = 2;  // dua
    switch (a) {
        case 0: x = 1; break;
        default: break;
    }
}
`
    );
});

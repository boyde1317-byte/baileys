export type RichTest = {
    id: string;
    label: string;
    group: string;
    fn: (sock: any, jid: string, quoted?: any) => Promise<string>;
};

export const RICH_TESTS: RichTest[];

export function runRichTest(sock: any, jid: string, testId: string, quoted?: any): Promise<string>;
export function runAllRichTests(
    sock: any,
    jid: string,
    quoted?: any
): Promise<{ id: string; label: string; ok: boolean; result: string }[]>;

export function testSecretFlow(sock: any, jid: string, quoted?: any): Promise<string>;
export function testHtmlGame(game: 'counter' | 'calc' | 'monitor' | string): RichTest['fn'];
export function testVipRichCard(sock: any, jid: string, quoted?: any): Promise<string>;
export function testBloksSurface(sock: any, jid: string, quoted?: any): Promise<string>;

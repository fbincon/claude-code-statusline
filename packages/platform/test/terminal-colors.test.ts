import test from 'node:test';
import assert from 'node:assert/strict';
import { colorCapability } from '../src/terminal/capabilities.js';

test('Windows capability follows the actual VT handle, not inherited terminal markers', () => {
    for (const environment of [{}, {WT_SESSION:'parent',WT_PROFILE_ID:'parent'}, {TERM_PROGRAM:'Windows_Terminal'}]) {
        assert.deepEqual(colorCapability({environment,platform:'win32',tty:true,windowsVT:true}), {colors:256,reason:'windows_vt'});
        assert.deepEqual(colorCapability({environment,platform:'win32',tty:true,windowsVT:false}), {colors:16,reason:'conservative'});
    }
});
test('explicit no-color and capability choices win over Windows VT', () => {
    const inputs: [NodeJS.ProcessEnv, number][] = [[{NO_COLOR:'',COLORTERM:'truecolor'},0], [{TERM:'dumb',COLORTERM:'truecolor'},0],
        [{TERM:'vt100'},0], [{TERM:'xterm-mono'},0], [{TERM:'linux'},8], [{TERM:'xterm'},16], [{TERM:'xterm-256color'},256], [{COLORTERM:'truecolor'},256]];
    for (const [environment, expected] of inputs) {
        assert.equal(colorCapability({environment,platform:'win32',tty:true,windowsVT:true}).colors, expected);
        assert.equal(colorCapability({environment,platform:'win32',tty:false,windowsVT:true}).colors, 0);
    }
    assert.equal(colorCapability({environment:{},platform:'linux',tty:true,windowsVT:false}).colors,16);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {accentForeground,applyUITheme,luminance} from '../src/ui/theme.ts';
import {initialState,presets} from '../src/shared/model.ts';
import {migrate} from '../src/shared/validation.ts';
test('accent foreground chooses accessible contrast for light, dark and middle accents',()=>{
 for(const color of ['#000000','#ffffff','#777777','#32d9f5','#004488','#ee0044']){const a=luminance(color),b=luminance(accentForeground(color));assert.ok((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5);}
});
test('theme inheritance and legacy migration preserve customization with optional pixel rendering',()=>{
 const state=initialState();state.settings.theme={...presets.Papel};const dom=new JSDOM('<main></main>');
 applyUITheme(dom.window.document.documentElement,state.settings);assert.equal(dom.window.document.documentElement.style.getPropertyValue('--nagi-ui-bg'),presets.Papel.background);assert.equal(dom.window.document.documentElement.style.colorScheme,'light');
 const legacy=structuredClone(state) as any;delete legacy.settings.layout.avatarRendering;delete legacy.settings.layout.brand;delete legacy.settings.layout.density;
 const migrated=migrate(legacy);assert.equal(migrated.settings.layout.avatarRendering,'auto');assert.deepEqual(migrated.settings.theme,presets.Papel);dom.window.close();
});

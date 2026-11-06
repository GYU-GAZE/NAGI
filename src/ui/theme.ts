import type { Settings } from '../shared/model';
export function luminance(hex:string) {
 const rgb=hex.slice(1).match(/../g)!.map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
 return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
export function accentForeground(accent:string) {return luminance(accent)>0.179?'#000000':'#ffffff';}
export function applyUITheme(root:HTMLElement,s:Settings) {
 const tokens={
  '--nagi-ui-bg':s.theme.background,'--nagi-ui-panel':s.theme.composer,'--nagi-ui-text':s.theme.text,
  '--nagi-ui-muted':`color-mix(in srgb, ${s.theme.text} 78%, ${s.theme.background})`,
  '--nagi-ui-font':s.theme.font,'--nagi-accent':s.layout.accent,'--nagi-accent-foreground':accentForeground(s.layout.accent),
  '--nagi-avatar-rendering':s.layout.avatarRendering==='pixel'?'pixelated':s.layout.avatarRendering==='smooth'?'smooth':'auto',
 };
 for(const [key,value] of Object.entries(tokens))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
 root.style.colorScheme=luminance(s.theme.background)>0.4?'light':'dark';
}

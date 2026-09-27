export const BELTRIX_THEMES=Object.freeze(['light','dark']);
export const THEME_STORAGE_KEY='beltrix-ui-theme-v1';

export function normalizeTheme(value){
 const v=String(value||'').toLowerCase();
 return BELTRIX_THEMES.includes(v)?v:'light';
}

export function nextTheme(value){
 return normalizeTheme(value)==='light'?'dark':'light';
}

export function themeMetaColor(value){
 return normalizeTheme(value)==='light'?'#f5f8ff':'#07111f';
}

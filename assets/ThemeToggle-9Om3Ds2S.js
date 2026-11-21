import{c as h,r as s,o as n,p as c,j as t,d as i,q as u,t as f,v}from"./index-BdQAJ2Cr.js";import{r as l}from"./vendor-react-Fwto6RMk.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=h("Moon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=h("Sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);function x({className:m}){const[r,a]=l.useState(()=>s(c(),n()));l.useEffect(()=>{a(s(c(),n()))},[]);function d(e){e!==r&&(u(v(r)),f(e),a(e))}return t.jsx("div",{className:i("inline-flex items-center rounded-full p-1","bg-[var(--home-field)] border border-[var(--home-surface-border)]",m),role:"group","aria-label":"מצב תצוגה",children:[{value:"light",Icon:k,label:"מצב בהיר"},{value:"dark",Icon:b,label:"מצב כהה"}].map(({value:e,Icon:p,label:o})=>t.jsx("button",{type:"button",onClick:()=>d(e),"aria-pressed":r===e,"aria-label":o,title:o,className:i("grid h-8 w-9 place-items-center rounded-full transition-colors","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]",r===e?"bg-[var(--home-nav-active)] text-foreground":"text-[var(--home-muted)] hover:text-foreground"),children:t.jsx(p,{className:"h-4 w-4"})},e))})}export{x as T};

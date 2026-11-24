import{c as t,j as a,u as h,b as m}from"./index-DOQkZriu.js";import{j as d,L as p}from"./vendor-react-Fwto6RMk.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=t("Building2",[["path",{d:"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",key:"1b4qmf"}],["path",{d:"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",key:"i71pzd"}],["path",{d:"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",key:"10jefs"}],["path",{d:"M10 6h4",key:"1itunk"}],["path",{d:"M10 10h4",key:"tcdvrf"}],["path",{d:"M10 14h4",key:"kelpxr"}],["path",{d:"M10 18h4",key:"1ulq68"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=t("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=t("FileStack",[["path",{d:"M21 7h-3a2 2 0 0 1-2-2V2",key:"9rb54x"}],["path",{d:"M21 6v6.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5H17Z",key:"1059l0"}],["path",{d:"M7 8v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H15",key:"16874u"}],["path",{d:"M3 12v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H11",key:"k2ox98"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=t("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);function k(){const{pathname:s}=d(),{isAdmin:o}=h(),r=[{to:"/",label:"בית",icon:y,match:e=>e==="/"},{to:"/my-reports",label:"הדוחות שלי",icon:v,match:e=>e.startsWith("/my-reports")||e.startsWith("/report")},{to:"/hours",label:"שעות",icon:x,match:e=>e.startsWith("/hours")},...o?[{to:"/company-reports",label:"דוחות החברה",icon:u,match:e=>e.startsWith("/company-reports")}]:[]];return a.jsx("nav",{"aria-label":"ניווט ראשי",className:"fixed inset-x-0 bottom-0 z-40 border-t border-[var(--home-surface-border)] safe-bottom backdrop-blur-md",style:{background:"var(--home-nav)"},children:a.jsx("ul",{className:"mx-auto grid max-w-lg gap-2 px-3 py-2",style:{gridTemplateColumns:`repeat(${r.length}, minmax(0, 1fr))`},children:r.map(({to:e,label:n,icon:i,match:l})=>{const c=l(s);return a.jsx("li",{children:a.jsxs(p,{to:e,"aria-current":c?"page":void 0,className:m("flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition-colors","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]",c?"bg-[var(--home-nav-active)] text-foreground":"text-[var(--home-muted)] hover:text-foreground"),children:[a.jsx(i,{className:"h-5 w-5 shrink-0","aria-hidden":!0}),a.jsx("span",{className:"truncate",children:n})]})},e)})})})}function g({children:s,hideNav:o}){return a.jsxs("div",{className:"min-h-screen",style:{paddingBottom:"calc(5.5rem + env(safe-area-inset-bottom, 0px))"},children:[a.jsx("div",{className:"mx-auto max-w-lg w-full",children:s}),!o&&a.jsx(k,{})]})}export{g as A,x as C};

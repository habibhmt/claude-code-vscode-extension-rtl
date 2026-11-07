# Smart Auto-Direction Fix for Claude Code Extension
# Supports: VSCode, Cursor, Windsurf, Windsurf Next
# Works on: Windows
#
# Instead of forcing RTL on everything, this detects the first strong
# character of each message text block and sets dir="rtl" / dir="ltr"
# per block. Code, diffs, terminal output and the composer stay LTR.

param(
    [switch]$WithFont,
    [switch]$Revert,
    [switch]$Help
)

if ($Help) {
    Write-Host "Usage: .\fix-rtl-claude.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -WithFont    Include Vazirmatn font for Persian/Arabic text"
    Write-Host "  -Revert      Restore original files from backups"
    Write-Host "  -Help        Show this help message"
    exit 0
}

# --- Markers so re-running is idempotent ---------------------------------
$CSS_START = "/* === SMART-RTL START === */"
$CSS_END   = "/* === SMART-RTL END === */"
$JS_START  = "/* === SMART-RTL-JS START === */"
$JS_END    = "/* === SMART-RTL-JS END === */"

# --- Optional Vazirmatn font (text only, code keeps monospace) -----------
$FONT_CSS = @'
body,.rendered-markdown,.smart-rtl,.smart-ltr{font-family:"Vazirmatn","Segoe UI",system-ui,sans-serif !important}
pre,code,kbd,samp,.cm-editor,.monaco-editor{font-family:"SF Mono",Monaco,Consolas,"Courier New",monospace !important}
'@

# --- Smart-direction CSS (no forced direction on containers) -------------
# Message text blocks AND the composer's editable field are smart-directed.
# Code surfaces stay LTR; composer chrome stays LTR but its typed text follows
# the smart classes. The broad "form:has(...) *" descendant rule is gone so it
# no longer overrides RTL on the typed Persian text.
$SMART_CSS_CORE = @'
.smart-rtl{direction:rtl !important;text-align:right !important;unicode-bidi:isolate !important}
.smart-ltr{direction:ltr !important;text-align:left !important;unicode-bidi:isolate !important}
.smart-header-rtl{direction:rtl !important;text-align:right !important;unicode-bidi:isolate !important}
.smart-header-ltr{direction:ltr !important;text-align:left !important;unicode-bidi:isolate !important}
button,[role="button"],svg{unicode-bidi:normal}
/* Wrap smart-directed rendered text inside the visible area; never clip/overflow */
.smart-rtl,.smart-ltr,.smart-header-rtl,.smart-header-ltr{box-sizing:border-box !important;max-width:100% !important;min-width:0 !important;white-space:normal !important;overflow-wrap:anywhere !important;word-break:normal !important;flex-shrink:1 !important}
.smart-rtl{width:auto !important}
.smart-rtl:is(p,li,blockquote,h1,h2,h3,h4,h5,h6,div,span),.smart-ltr:is(p,li,blockquote,h1,h2,h3,h4,h5,h6,div,span){max-width:100% !important;min-width:0 !important;overflow-wrap:anywhere !important;white-space:normal !important}
.smart-rtl:is(h1,h2,h3,h4,h5,h6),.smart-ltr:is(h1,h2,h3,h4,h5,h6),.smart-header-rtl,.smart-header-ltr{width:auto !important;max-width:100% !important;min-width:0 !important}
/* Let the nearest message/status text container shrink and wrap in flex rows */
[class*="message"],[data-testid*="message"],[class*="thinking"],[data-testid*="thinking"],[class*="status"],[data-testid*="status"]{min-width:0 !important;max-width:100% !important}
/* Question / choice modals & dialogs */
.smart-modal-rtl{direction:rtl !important;text-align:right !important;unicode-bidi:isolate !important;min-width:0 !important;max-width:100% !important;white-space:normal !important;overflow-wrap:anywhere !important}
.smart-modal-ltr{direction:ltr !important;text-align:left !important;unicode-bidi:isolate !important;min-width:0 !important;max-width:100% !important;white-space:normal !important;overflow-wrap:anywhere !important}
button:has(svg):not(.smart-modal-rtl):not(.smart-modal-ltr){direction:ltr !important;text-align:center !important}
/* Markdown content (rendered + raw source lines) */
.smart-md-rtl{direction:rtl !important;text-align:right !important;unicode-bidi:isolate !important;min-width:0 !important;max-width:100% !important;white-space:normal !important;overflow-wrap:anywhere !important}
.smart-md-ltr{direction:ltr !important;text-align:left !important;unicode-bidi:isolate !important;min-width:0 !important;max-width:100% !important;white-space:normal !important;overflow-wrap:anywhere !important}
.markdown pre,.markdown pre *,[class*="markdown"] pre,[class*="markdown"] pre *,.smart-md-rtl pre,.smart-md-rtl pre *,.smart-md-ltr pre,.smart-md-ltr pre *{direction:ltr !important;text-align:left !important;unicode-bidi:normal !important;white-space:pre !important;overflow-wrap:normal !important}
/* Markdown shown inside a pre/code block, split into per-line spans */
.smart-md-code-block{display:block !important;direction:ltr !important;text-align:left !important;unicode-bidi:normal !important;white-space:pre-wrap !important;max-width:100% !important;min-width:0 !important;overflow-x:auto !important}
.smart-md-code-line{display:block !important;box-sizing:border-box !important;width:100% !important;max-width:100% !important;min-width:0 !important}
.smart-md-code-line-rtl{direction:rtl !important;text-align:right !important;unicode-bidi:isolate !important;white-space:pre-wrap !important;overflow-wrap:anywhere !important}
.smart-md-code-line-ltr{direction:ltr !important;text-align:left !important;unicode-bidi:normal !important;white-space:pre-wrap !important;overflow-wrap:normal !important}
.composer-smart-rtl{direction:rtl !important;text-align:start !important;unicode-bidi:plaintext !important}
.composer-smart-ltr{direction:ltr !important;text-align:start !important;unicode-bidi:plaintext !important}
.composer-smart-rtl>p,.composer-smart-rtl>div{direction:rtl !important;text-align:start !important;unicode-bidi:plaintext !important}
.composer-smart-ltr>p,.composer-smart-ltr>div{direction:ltr !important;text-align:start !important;unicode-bidi:plaintext !important}
pre,pre *,code,kbd,samp,.diff,.cm-editor,.monaco-editor{direction:ltr !important;text-align:left !important;unicode-bidi:normal !important;white-space:pre !important;overflow-wrap:normal !important;word-break:normal !important}
form:has(textarea),form:has([contenteditable]),form:has([role="textbox"]){direction:ltr !important}
'@

# --- Smart-direction JS (injected into the webview bundle) ----------------
$SMART_JS = @'
;(function(){
  var RTL_RE=/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  var LTR_RE=/[A-Za-z]/;
  // On/off control (used by the Chrome extension toggle; always on in VSCode).
  var _on=true,_started=false;
  // ---- Rendered conversation text: headings/titles, user prompts, assistant
  //      messages, list items, thinking/status lines. ----
  // RENDERED text uses explicit text-align:right/left (NOT start): headings often
  // sit in flex/shrink wrappers where `start` does not visually move them. We also
  // resolve the real block-level OWNER of each Persian run (not an inner span), and
  // a text-node fallback so nothing is missed. (Composer keeps text-align:start.)
  // detectSmartDirection()/isVisible()/isRtlChar() are defined below (hoisted).
  function containsRtl(text){return RTL_RE.test(String(text||""));}
  function shouldSkipDirectionFix(el){
    if(!el||!(el instanceof HTMLElement))return true;
    if(!isVisible(el))return true;
    return !!el.closest('nav, aside, [role="navigation"], [role="complementary"], [class~="fixed"], pre, code, kbd, samp, textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], .cm-editor, .monaco-editor, .diff, [class*="mirror"], [class*="Mirror"], svg, [role="progressbar"], [class*="spinner"], [class*="Spinner"], [class*="loading"], [class*="loadingState"], [class*="empty"], [class*="pictogram"]');
  }
  var BLOCK_TAGS={p:1,li:1,blockquote:1,h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,summary:1,figcaption:1,td:1,th:1};
  function isSafeDirectionTarget(el){
    if(!el||!(el instanceof HTMLElement))return false;
    if(shouldSkipDirectionFix(el))return false;
    var text=(el.textContent||"").trim();
    if(!text||text.length>2500)return false;
    if(el.querySelector('pre, textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], .cm-editor, .monaco-editor'))return false;
    var tag=el.tagName.toLowerCase();
    // Pure content elements never appear in sidebars/toolbars with action buttons, so
    // skip the SVG/button guard for them (fixes paragraphs with inline-code SVG icons
    // or LaTeX SVG that were incorrectly marked unsafe). li and headings CAN appear in
    // sidebar nav items that hold Edit/Delete buttons — they keep the guard.
    if(tag==="p"||tag==="blockquote"||tag==="td"||tag==="th"||tag==="figcaption")return true;
    if(el.querySelector('svg, button, [role="button"], [class*="spinner"], [class*="Spinner"]'))return false;
    return true;
  }
  function findNearestMessageRoot(el){
    return el.closest('[data-testid*="message"], [class*="message"], [class*="Message"], [data-testid*="assistant"], [class*="assistant"], [data-testid*="user"], [class*="user"], [class*="progressContent"], [class*="loadingState"]')||el.closest("main, article, section")||document.body;
  }
  // Walk up from a Persian run to the nearest safe block-level owner so direction
  // lands on the element that owns the line layout (not an inner span).
  function findBlockOwner(el){
    if(!el||!(el instanceof HTMLElement))return null;
    var messageRoot=findNearestMessageRoot(el);
    var current=el;
    for(var depth=0;current&&depth<8;depth++){
      if(!(current instanceof HTMLElement))break;
      if(current===document.body)break;
      if(messageRoot&&current.parentElement&&!messageRoot.contains(current))break;
      if(!isSafeDirectionTarget(current)){current=current.parentElement;continue;}
      var tag=current.tagName.toLowerCase();
      if(BLOCK_TAGS[tag])return current;
      if(current.getAttribute("role")==="heading"||current.matches('[class*="title"], [class*="heading"], [class*="header"], [class*="label"], [data-testid*="title"], [data-testid*="heading"], [data-testid*="label"]'))return current;
      var style=window.getComputedStyle(current);
      var text=(current.textContent||"").trim();
      var hasNested=current.querySelector("p, li, blockquote, h1, h2, h3, h4, h5, h6, pre");
      var childCount=Array.prototype.slice.call(current.children||[]).filter(isVisible).length;
      // Custom title/line divs: a small, leaf-ish block/flex/grid element.
      if((style.display==="block"||style.display==="flex"||style.display==="grid"||style.display==="list-item")&&text.length<=500&&!hasNested&&childCount<=6)return current;
      current=current.parentElement;
    }
    return el;
  }
  function applyRenderedDirectionToTarget(target){
    if(!isSafeDirectionTarget(target))return;
    var text=(target.textContent||"").trim();
    if(!text)return;
    var dir=detectSmartDirection(text);
    if(dir!=="rtl"){
      // LTR is the app default - do NOT override alignment, so centered spinners,
      // loaders and English UI are left exactly as the app draws them. Only undo a
      // prior RTL if this element had flipped before.
      if(target.classList.contains("smart-rtl")){
        target.classList.remove("smart-rtl");
        target.removeAttribute("dir");
        target.style.removeProperty("direction");
        target.style.removeProperty("text-align");
        target.style.removeProperty("width");
        target.style.removeProperty("margin-left");
        target.style.removeProperty("margin-right");
      }
      return;
    }
    target.setAttribute("dir","rtl");
    target.style.setProperty("direction","rtl","important");
    target.style.setProperty("text-align","right","important");
    target.style.setProperty("unicode-bidi","isolate","important");
    // Wrap inside the visible area; never stretch past it (fixes RTL overflow).
    target.style.setProperty("box-sizing","border-box","important");
    target.style.setProperty("max-width","100%","important");
    target.style.setProperty("min-width","0","important");
    target.style.setProperty("white-space","normal","important");
    target.style.setProperty("overflow-wrap","anywhere","important");
    target.style.setProperty("word-break","normal","important");
    target.style.setProperty("width","auto","important");
    // Push a shrink-wrapped flex/inline-block child to the right end (no effect on
    // full-width blocks). Use PHYSICAL margins so direction:rtl on the element itself
    // does not flip the logical inline-start/end mapping.
    target.style.setProperty("margin-left","auto","important");
    target.style.setProperty("margin-right","0","important");
    target.classList.add("smart-rtl");
  }
  var RENDERED_SEL=[
    ".markdown p",".markdown li",".markdown blockquote",".markdown h1",".markdown h2",".markdown h3",".markdown h4",".markdown h5",".markdown h6",
    ".rendered-markdown p",".rendered-markdown li",".rendered-markdown blockquote",".rendered-markdown h1",".rendered-markdown h2",".rendered-markdown h3",".rendered-markdown h4",".rendered-markdown h5",".rendered-markdown h6",
    "h1","h2","h3","h4","h5","h6","[role=\"heading\"]","summary",
    "[class*=\"title\"]","[class*=\"heading\"]","[data-testid*=\"title\"]","[data-testid*=\"heading\"]",
    "[data-testid*=\"message\"] p","[data-testid*=\"message\"] li","[data-testid*=\"message\"] div","[data-testid*=\"message\"] span",
    "[class*=\"message\"] p","[class*=\"message\"] li","[class*=\"message\"] div","[class*=\"message\"] span",
    "[class*=\"userMessage_\"]",
    "[class*=\"thinking\"]","[class*=\"status\"]","[data-testid*=\"thinking\"]","[data-testid*=\"status\"]"
  ].join(",");
  // Process-once: skip an element whose text length is unchanged since last pass,
  // so streaming re-styles only what actually grew (no full-document re-scan).
  function processRendered(el){
    var key=el.textContent?el.textContent.length:0;
    if(el.__srtl===key)return;
    el.__srtl=key;
    var t=findBlockOwner(el);
    if(t)applyRenderedDirectionToTarget(t);
  }
  // A <ul>/<ol> wrapper must itself be RTL for Persian lists, so the bullets /
  // numbers and indentation move to the right (the LI text is handled separately).
  // findBlockOwner skips lists (they have nested li), so direct them here.
  function processList(el){
    if(!el||!(el instanceof HTMLElement)||shouldSkipDirectionFix(el))return;
    // Only style lists inside rendered message/markdown content — never sidebar
    // conversation history lists (which would mass-flip all items RTL).
    if(!el.closest('[data-testid*="message"],[class*="message"],[class*="Message"],.markdown,[class*="markdown"],.rendered-markdown,article'))return;
    var len=el.textContent?el.textContent.length:0;
    if(el.__srtlL===len)return;
    el.__srtlL=len;
    var dir=detectSmartDirection(el.textContent||"");
    if(dir==="rtl"){
      el.setAttribute("dir","rtl");
      el.style.setProperty("direction","rtl","important");
      el.style.setProperty("text-align","right","important");
      el.classList.add("smart-rtl");
    }else if(el.classList.contains("smart-rtl")){
      el.classList.remove("smart-rtl");el.removeAttribute("dir");
      el.style.removeProperty("direction");el.style.removeProperty("text-align");
    }
  }
  // Scroll wrappers (overflow-x-auto) and tables: RTL when Persian, but NEVER when
  // they wrap code/an editor (a code block must stay LTR). This is exactly why a
  // code wrapper stays left while a Persian table/box now flips to the right.
  function processWrapper(el){
    if(!el||!(el instanceof HTMLElement)||shouldSkipDirectionFix(el))return;
    if(el.querySelector('pre, code, kbd, samp, .cm-editor, .monaco-editor, .diff, textarea, input, [contenteditable], [role="textbox"]'))return;
    var len=el.textContent?el.textContent.length:0;
    if(el.__srtlW===len)return;
    el.__srtlW=len;
    if(len>5000)return; // not a focused box/table - avoid over-reaching
    var txt=el.textContent||"";
    if(!containsRtl(txt)){
      if(el.classList.contains("smart-rtl")){
        el.classList.remove("smart-rtl");el.removeAttribute("dir");
        el.style.removeProperty("direction");el.style.removeProperty("text-align");el.style.removeProperty("unicode-bidi");
      }
      return;
    }
    if(detectSmartDirection(txt)==="rtl"){
      el.setAttribute("dir","rtl");
      el.style.setProperty("direction","rtl","important");
      el.style.setProperty("text-align","right","important");
      el.style.setProperty("unicode-bidi","isolate","important");
      el.classList.add("smart-rtl");
    }
  }
  function applySmartDirectionToRenderedText(root){
    if(!_on)return;
    root=root||document;
    try{
      // The root itself (e.g. the <p>/<span> whose text just streamed in) plus
      // descendants. findBlockOwner resolves the real block even from a span.
      if(root.nodeType===1)processRendered(root);
      var nodes=(root.nodeType===1||root.nodeType===9)?root.querySelectorAll(RENDERED_SEL):[];
      for(var i=0;i<nodes.length;i++)processRendered(nodes[i]);
      if(root.nodeType===1&&(root.tagName==="UL"||root.tagName==="OL"))processList(root);
      var lists=(root.nodeType===1||root.nodeType===9)?root.querySelectorAll("ul, ol"):[];
      for(var k=0;k<lists.length;k++)processList(lists[k]);
      if(root.nodeType===1&&(root.tagName==="TABLE"||/overflow-x/.test(root.className||"")))processWrapper(root);
      var wraps=(root.nodeType===1||root.nodeType===9)?root.querySelectorAll('table, [class*="overflow-x"]'):[];
      for(var w=0;w<wraps.length;w++)processWrapper(wraps[w]);
    }catch(e){}
  }
  // One coalesced pass per burst (process-once keeps document passes cheap) plus a
  // single short follow-up for late insertions.
  function runDirectionPasses(){
    applySmartDirectionToRenderedText(document);
    applySmartDirectionToHeaderTitles(document);
    applySmartDirectionToModals(document);
    applySmartDirectionToMarkdown(document);
    applySmartDirectionToMarkdownCodeBlocks(document);
  }
  var _passPending=false;
  function scheduleSmartDirectionPass(){
    if(_passPending)return;
    _passPending=true;
    try{if(window.requestAnimationFrame)window.requestAnimationFrame(runDirectionPasses);}catch(e){}
    setTimeout(function(){runDirectionPasses();_passPending=false;},200);
  }
  // ---- Composer: style BOTH the editable (caret) and its mirror (text) ----
  // Real DOM (Claude Code webview): div.messageInputContainer >
  //   div.messageInput  (contenteditable="plaintext-only", role="textbox", color:transparent)  -> caret
  //   div.mentionMirror (aria-hidden, position:absolute, inset:0)                                -> visible text
  function isRtlChar(ch){return RTL_RE.test(ch);}
  function isLatinChar(ch){return LTR_RE.test(ch);}
  // Emoji / icon / bullet / punctuation / number are "neutral": ignored for
  // direction so a Persian title that starts with an icon is still detected RTL.
  // ASCII-only (\p{Extended_Pictographic} + \u escapes) to survive PS 5.1 encoding.
  var NEUTRAL_RE=/[\s\d`"'()\[\]{}<>:;,.!?\-_=+*\/\\|@#$%^&~\u060C\u061B\u061F\u066B\u066C\u00AB\u00BB\u2013\u2014\u2022\u00B7\u25CF\u25CB\u25AA\u25AB\u25A0\u25A1\u25B6\u25BA\u2713\u2714\u2705\u274C\u26A0\u2B50\uFE0E\uFE0F\u200D]/;
  function isEmojiOrNeutral(ch){
    if(NEUTRAL_RE.test(ch))return true;
    try{return /\p{Extended_Pictographic}/u.test(ch);}catch(e){return false;}
  }
  function isAllNeutral(t){
    for(var i=0;i<t.length;i++){if(!isEmojiOrNeutral(t[i]))return false;}
    return t.length>0;
  }
  function normalizeToken(raw){
    var s=String(raw||""),a=0,b=s.length;
    while(a<b&&isEmojiOrNeutral(s[a]))a++;
    while(b>a&&isEmojiOrNeutral(s[b-1]))b--;
    return s.slice(a,b).trim();
  }
  function isTechnicalToken(token){
    var t=(token||"").trim();
    if(!t)return true;
    if(isAllNeutral(t))return true;
    return (/^https?:\/\//i.test(t)||/^[.\/\\~]/.test(t)||/[.\/\\]/.test(t)||/\.[A-Za-z0-9]{1,12}$/.test(t)||/^[?$@#]/.test(t)||/[?=&]/.test(t)||/[_\/\\.-]/.test(t)||/\d/.test(t)||/^[A-Z0-9_.\/\\-]+$/.test(t)||/^(git|npm|pnpm|yarn|node|php|js|ts|css|html|json|md|feat|fix|chore|refactor|feature|bugfix|hotfix|branch|commit|tag|powershell|bash|cmd|remote|fork|push|pr|classic|fine-grained|delete|claude|vscode|rtl|blog|our|story|home|store|other|olive|oil|honey)$/i.test(t));
  }
  // Pure-Persian -> rtl, pure-Latin -> ltr. Mixed: skip leading neutrals/emoji to
  // the first strong char; else fall back to the first strong NON-technical token,
  // then to rtl when any Persian is present.
  function detectSmartDirection(text){
    var value=String(text||"").trim();
    if(!value)return "ltr";
    var rtlCount=0,latinCount=0;
    for(var i=0;i<value.length;i++){var ch=value[i];if(isRtlChar(ch))rtlCount++;else if(isLatinChar(ch))latinCount++;}
    if(rtlCount===0)return "ltr";
    if(latinCount===0)return "rtl";
    // First strong char wins if it is Persian (after skipping leading emoji/neutrals).
    for(var p=0;p<value.length;p++){var c0=value[p];if(isRtlChar(c0))return "rtl";if(isLatinChar(c0))break;}
    // English-first but mixed: decide by NON-TECHNICAL word majority, so a Persian
    // sentence that merely starts with an English identifier (e.g. a function name
    // followed by mostly Persian words) is still RTL, while mostly-English stays LTR.
    var tokens=value.split(/\s+/),rtlWords=0,ltrWords=0;
    for(var j=0;j<tokens.length;j++){
      var token=normalizeToken(tokens[j]);
      if(!token)continue;
      var hasRtl=false,hasLatin=false;
      for(var k=0;k<token.length;k++){var c=token[k];if(isRtlChar(c))hasRtl=true;else if(isLatinChar(c))hasLatin=true;}
      if(hasRtl){rtlWords++;continue;}
      if(isTechnicalToken(token))continue;
      if(hasLatin)ltrWords++;
    }
    return (rtlWords>0&&rtlWords>=ltrWords)?"rtl":"ltr";
  }
  function isVisible(el){
    if(!el||!(el instanceof HTMLElement))return false;
    var style=window.getComputedStyle(el);
    var rect=el.getBoundingClientRect();
    return !el.hidden&&style.display!=="none"&&style.visibility!=="hidden"&&rect.width>0&&rect.height>0;
  }
  // The composer editable is contenteditable="plaintext-only" (not "true").
  var EDITABLE_SEL='textarea, input[type="text"], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]';
  function isComposerEditable(el){
    if(!el||!(el instanceof HTMLElement))return false;
    if(!el.matches(EDITABLE_SEL))return false;
    if(!isVisible(el))return false;
    if(el.closest("pre, code, .cm-editor, .monaco-editor"))return false;
    if(el.matches('button, [role="button"]'))return false;
    return true;
  }
  function getEditableText(el){
    if(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement)return el.value||"";
    return el.textContent||"";
  }
  function findComposerEditable(){
    var active=document.activeElement;
    if(isComposerEditable(active))return active;
    var list=Array.prototype.slice.call(document.querySelectorAll(EDITABLE_SEL)).filter(isComposerEditable);
    if(!list.length)return null;
    for(var i=0;i<list.length;i++){if(getEditableText(list[i]).trim().length>0)return list[i];}
    list.sort(function(a,b){return b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom;});
    return list[0];
  }
  // The VISIBLE typed text is rendered on a separate overlay layer (aria-hidden,
  // position:absolute, class contains "mirror") sitting over the transparent
  // contenteditable. The editable owns the caret; the mirror owns the text. Both
  // must share one direction or the caret and text disagree (the reported bug).
  function findComposerMirror(surface){
    var p=surface&&surface.parentElement;
    if(!p)return null;
    var kids=p.children;
    for(var i=0;i<kids.length;i++){
      var el=kids[i];
      if(el===surface||!(el instanceof HTMLElement))continue;
      var cls=(el.className&&el.className.toString)?el.className.toString():"";
      if(/mirror/i.test(cls))return el;
      if(el.getAttribute("aria-hidden")==="true"){
        var st=window.getComputedStyle(el);
        if(st.position==="absolute")return el;
      }
    }
    return null;
  }
  // Use text-align:start (follows direction) so caret/text/selection stay in sync.
  function styleComposerDirection(el,dir){
    if(!el)return;
    el.setAttribute("dir",dir);
    el.style.setProperty("direction",dir,"important");
    el.style.setProperty("text-align","start","important");
    el.style.setProperty("unicode-bidi","plaintext","important");
    el.classList.toggle("composer-smart-rtl",dir==="rtl");
    el.classList.toggle("composer-smart-ltr",dir==="ltr");
  }
  function updateComposerDirection(extraText){
    if(!_on)return;
    var surface=findComposerEditable();
    if(!surface)return;
    var dir=detectSmartDirection(getEditableText(surface)+(extraText||""));
    styleComposerDirection(surface,dir);
    styleComposerDirection(findComposerMirror(surface),dir);
  }
  // Temporary inspector: window.debugComposerCandidates() in DevTools console.
  function debugComposerCandidates(){
    var sel=['textarea','input[type="text"]','[contenteditable="true"]','[contenteditable="plaintext-only"]','[role="textbox"]','[data-lexical-editor="true"]','.ProseMirror','[class*="essageInput"]','[class*="irror"]','[class*="editor"]','[class*="textarea"]','[class*="input"]'].join(",");
    var rows=Array.prototype.slice.call(document.querySelectorAll(sel)).map(function(el,index){
      var style=window.getComputedStyle(el),rect=el.getBoundingClientRect();
      return {index:index,tag:el.tagName,className:(el.className&&el.className.toString)?el.className.toString():"",role:el.getAttribute("role")||"",contenteditable:el.getAttribute("contenteditable")||"",ariaHidden:el.getAttribute("aria-hidden")||"",dirAttr:el.getAttribute("dir")||"",cssDirection:style.direction,cssTextAlign:style.textAlign,color:style.color,display:style.display,visibility:style.visibility,width:Math.round(rect.width),height:Math.round(rect.height),top:Math.round(rect.top),bottom:Math.round(rect.bottom),active:el===document.activeElement,text:(el.value||el.textContent||"").slice(0,80)};
    });
    if(console.table)console.table(rows);else console.log(rows);
    return rows;
  }
  try{window.debugComposerCandidates=debugComposerCandidates;}catch(e){}
  function composerHandler(useData){
    return function(e){updateComposerDirection(useData?(e.data||""):"");};
  }
  // ---- Top header / title-bar: move ONLY the title text, never the toolbar. ----
  // Apply to the title text element (or nearest safe text-only title container),
  // and shift it within its flex/grid row via margin-inline so buttons don't move.
  function shouldSkipHeaderTextFix(el){
    if(!el||!(el instanceof HTMLElement))return true;
    if(!isVisible(el))return true;
    return !!el.closest('nav, aside, [role="navigation"], [role="complementary"], [class~="fixed"], button, [role="button"], svg, pre, code, kbd, samp, textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], .cm-editor, .monaco-editor, .diff, [role="progressbar"], [class*="spinner"], [class*="Spinner"], [class*="loading"], [class*="empty"], [class*="pictogram"]');
  }
  function isSafeHeaderTitleTarget(el){
    if(!el||!(el instanceof HTMLElement))return false;
    if(shouldSkipHeaderTextFix(el))return false;
    var text=(el.textContent||"").trim();
    if(!text||text.length>220)return false;
    if(el.querySelector('button, [role="button"], svg, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]'))return false;
    return true;
  }
  function findHeaderTitleOwner(el){
    if(!el||!(el instanceof HTMLElement))return null;
    var current=el;
    for(var depth=0;current&&depth<6;depth++){
      if(!(current instanceof HTMLElement))break;
      if(!isSafeHeaderTitleTarget(current)){current=current.parentElement;continue;}
      var tag=current.tagName.toLowerCase();
      if(tag==="h1"||tag==="h2"||tag==="h3"||tag==="h4"||tag==="h5"||tag==="h6"||current.getAttribute("role")==="heading"||current.matches('[class*="title"], [class*="heading"], [class*="header"], [data-testid*="title"], [data-testid*="heading"], [aria-label*="title"]'))return current;
      var style=window.getComputedStyle(current);
      var text=(current.textContent||"").trim();
      if((style.display==="block"||style.display==="flex"||style.display==="grid"||style.display==="inline-block")&&text.length<=180&&!current.querySelector("p, li, blockquote, h1, h2, h3, h4, h5, h6, pre"))return current;
      current=current.parentElement;
    }
    return isSafeHeaderTitleTarget(el)?el:null;
  }
  function applyHeaderTitleDirection(target){
    if(!isSafeHeaderTitleTarget(target))return;
    var text=(target.textContent||"").trim();
    if(!text)return;
    var dir=detectSmartDirection(text);
    if(dir!=="rtl"){
      // Leave English/LTR header titles exactly as the app lays them out.
      if(target.classList.contains("smart-header-rtl")){
        target.classList.remove("smart-header-rtl");
        target.removeAttribute("dir");
        target.style.removeProperty("direction");
        target.style.removeProperty("text-align");
        target.style.removeProperty("margin-left");
        target.style.removeProperty("margin-right");
      }
      return;
    }
    target.setAttribute("dir","rtl");
    target.style.setProperty("direction","rtl","important");
    target.style.setProperty("text-align","right","important");
    target.style.setProperty("unicode-bidi","isolate","important");
    target.classList.add("smart-header-rtl");
    // Shift only the title text within its flex/grid row (toolbar buttons stay).
    // Use PHYSICAL margins so direction:rtl on the element does not flip them.
    target.style.setProperty("margin-left","auto","important");
    target.style.setProperty("margin-right","0","important");
    // Bounded width (room for toolbar buttons) + wrap so long titles never clip.
    target.style.setProperty("box-sizing","border-box","important");
    target.style.setProperty("max-width","calc(100% - 96px)","important");
    target.style.setProperty("min-width","0","important");
    target.style.setProperty("white-space","normal","important");
    target.style.setProperty("overflow-wrap","anywhere","important");
  }
  var HEADER_SEL=[
    "header h1","header h2","header h3","header [role=\"heading\"]","header [class*=\"title\"]","header [class*=\"heading\"]","header [data-testid*=\"title\"]","header [data-testid*=\"heading\"]",
    "[class*=\"header\"] h1","[class*=\"header\"] h2","[class*=\"header\"] h3","[class*=\"header\"] [role=\"heading\"]","[class*=\"header\"] [class*=\"title\"]","[class*=\"header\"] [data-testid*=\"title\"]",
    "[class*=\"top\"] [class*=\"title\"]","[class*=\"top\"] [role=\"heading\"]","[data-testid*=\"header\"] [data-testid*=\"title\"]","[data-testid*=\"top\"] [data-testid*=\"title\"]"
  ].join(",");
  // Process-once + no full-document text-node walk (the old getBoundingClientRect
  // walk per text node was a big part of the hang).
  function applySmartDirectionToHeaderTitles(root){
    if(!_on)return;
    root=root||document;
    try{
      var nodes=(root.nodeType===1||root.nodeType===9)?root.querySelectorAll(HEADER_SEL):[];
      for(var i=0;i<nodes.length;i++){
        var el=nodes[i];
        var key=el.textContent?el.textContent.length:0;
        if(el.__srtlh===key)continue;
        el.__srtlh=key;
        var t=findHeaderTitleOwner(el);
        if(t)applyHeaderTitleDirection(t);
      }
    }catch(e){}
  }
  // ---- Question / choice modals & dialogs (heuristic detection) ----
  // This UI does NOT use [role=dialog]/[aria-modal]/.modal. Detect the panel by its
  // markers ("Submit answers" / "Esc to cancel") + radio rows. Reuses the shared
  // detector and is integrated into the SAME rAF observer (no extra observer).
  var MODAL_ROOT_SEL='[role="dialog"], [aria-modal="true"], [class*="modal"], [class*="Modal"], [class*="dialog"], [class*="Dialog"], [class*="popover"], [class*="Popover"], [data-testid*="modal"], [data-testid*="dialog"]';
  function hasMeaningfulText(el){
    var t=(el.textContent||"").trim();
    return t.length>0&&/[\p{L}\p{N}]/u.test(t);
  }
  function isIconOnlyControl(el){
    if(!el||!(el instanceof HTMLElement))return false;
    var t=(el.textContent||"").trim();
    return !!el.querySelector("svg")&&t.length<=2;
  }
  function looksLikeQuestionModal(el){
    if(!el||!(el instanceof HTMLElement))return false;
    var text=(el.textContent||"").trim();
    if(text.length<20||text.length>6000)return false;
    var hasSubmit=/Submit answers/i.test(text);
    var hasEsc=/Esc\s+to\s+cancel/i.test(text);
    if(!hasSubmit&&!hasEsc)return false; // cheap early-out for the vast majority of nodes
    if(!isVisible(el))return false;
    var hasOther=/\bOther\b/i.test(text);
    var radioLikeCount=el.querySelectorAll('input[type="radio"], [role="radio"], [aria-checked], [class*="radio"], [class*="option"]').length;
    var meaningful=0,tn=el.querySelectorAll("div, span, p, label, button");
    for(var i=0;i<tn.length;i++){var n=tn[i];if(n instanceof HTMLElement&&isVisible(n)&&hasMeaningfulText(n))meaningful++;}
    return (hasSubmit&&hasEsc)||(hasSubmit&&radioLikeCount>=2)||(hasEsc&&radioLikeCount>=2)||(hasOther&&radioLikeCount>=2&&meaningful>=5);
  }
  function getQuestionModalRoots(root){
    root=root||document;
    var out=[];
    try{
      var direct=root.querySelectorAll(MODAL_ROOT_SEL);
      for(var i=0;i<direct.length;i++)if(isVisible(direct[i]))out.push(direct[i]);
      // Heuristic scan is gated on the marker text, so it is skipped entirely unless
      // a question panel is actually present (keeps streaming/typing cheap).
      var rt=root.textContent||"";
      if(/Submit answers|Esc\s+to\s+cancel/i.test(rt)){
        if(root.nodeType===1&&looksLikeQuestionModal(root))out.push(root);
        var cands=root.querySelectorAll("section, article, form, div");
        var heur=[];
        for(var j=0;j<cands.length;j++){if(looksLikeQuestionModal(cands[j]))heur.push(cands[j]);}
        // Prefer the smallest matching container.
        heur.sort(function(a,b){var ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height;});
        for(var k=0;k<heur.length;k++)out.push(heur[k]);
      }
    }catch(e){}
    var uniq=[];
    for(var m=0;m<out.length;m++)if(uniq.indexOf(out[m])===-1)uniq.push(out[m]);
    // Drop ancestors that fully contain a smaller matching root.
    return uniq.filter(function(el){return !uniq.some(function(o){return o!==el&&el.contains(o);});});
  }
  function shouldSkipModalTextFix(el){
    if(!el||!(el instanceof HTMLElement))return true;
    if(!isVisible(el))return true;
    if(!hasMeaningfulText(el))return true;
    if(isIconOnlyControl(el))return true;
    return !!el.closest('pre, code, kbd, samp, textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], .cm-editor, .monaco-editor, .diff');
  }
  function isSafeModalTextTarget(el){
    if(!el||!(el instanceof HTMLElement))return false;
    if(shouldSkipModalTextFix(el))return false;
    var text=(el.textContent||"").trim();
    if(!text||text.length>1400)return false;
    if(el.querySelector('pre, textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], .cm-editor, .monaco-editor'))return false;
    return true;
  }
  var MODAL_BLOCK_TAGS={p:1,li:1,label:1,legend:1,h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,summary:1,figcaption:1};
  // Prefer the TEXT column, never a row that holds a radio/checkbox/icon (directing
  // that row would move the control). Pure-text leaves win; control rows are skipped.
  function findModalTextOwner(el){
    if(!el||!(el instanceof HTMLElement))return null;
    var current=el;
    for(var depth=0;current&&depth<7;depth++){
      if(!(current instanceof HTMLElement))break;
      if(!isSafeModalTextTarget(current)){current=current.parentElement;continue;}
      var childCount=Array.prototype.slice.call(current.children||[]).filter(isVisible).length;
      if(childCount===0)return current; // pure-text leaf -> style it directly
      // A control row (radio/checkbox/icon inside) must not be directed as a whole.
      if(current.querySelector('input, [role="radio"], [role="checkbox"], [aria-checked], svg')){current=current.parentElement;continue;}
      var tag=current.tagName.toLowerCase();
      if(MODAL_BLOCK_TAGS[tag])return current;
      var role=current.getAttribute("role");
      if(role==="heading"||current.matches('[class*="title"], [class*="heading"], [class*="label"], [class*="description"], [class*="question"], [class*="answer"], [data-testid*="title"], [data-testid*="label"], [data-testid*="description"], [data-testid*="question"], [data-testid*="answer"]'))return current;
      var style=window.getComputedStyle(current);
      var text=(current.textContent||"").trim();
      var hasNested=current.querySelector("p, li, label, h1, h2, h3, h4, h5, h6, pre");
      if((style.display==="block"||style.display==="flex"||style.display==="grid"||style.display==="list-item")&&text.length<=800&&!hasNested&&childCount<=8)return current;
      current=current.parentElement;
    }
    return null;
  }
  function applyModalDirection(target){
    if(!isSafeModalTextTarget(target))return;
    var text=(target.textContent||"").trim();
    if(!text)return;
    var dir=detectSmartDirection(text);
    if(dir!=="rtl"){
      if(target.classList.contains("smart-modal-rtl")){
        target.classList.remove("smart-modal-rtl");
        target.removeAttribute("dir");
        target.style.removeProperty("direction");
        target.style.removeProperty("text-align");
      }
      return;
    }
    target.setAttribute("dir","rtl");
    target.style.setProperty("direction","rtl","important");
    target.style.setProperty("text-align","right","important");
    target.style.setProperty("unicode-bidi","isolate","important");
    target.style.setProperty("min-width","0","important");
    target.style.setProperty("max-width","100%","important");
    target.style.setProperty("white-space","normal","important");
    target.style.setProperty("overflow-wrap","anywhere","important");
    target.classList.add("smart-modal-rtl");
  }
  var MODAL_SEL=[
    "h1","h2","h3","h4","h5","h6","p","li","label","legend",
    "[role=\"heading\"]","[role=\"option\"]","[role=\"radio\"]","[role=\"menuitemradio\"]","button",
    "[class*=\"title\"]","[class*=\"heading\"]","[class*=\"label\"]","[class*=\"description\"]","[class*=\"question\"]","[class*=\"answer\"]","[class*=\"option\"]",
    "[data-testid*=\"title\"]","[data-testid*=\"label\"]","[data-testid*=\"description\"]","[data-testid*=\"question\"]","[data-testid*=\"option\"]",
    "div","span"
  ].join(",");
  var MODAL_FOOTER_RE=/^(Submit answers|Esc to cancel)$/i;
  function processModal(modal){
    if(!isVisible(modal))return;
    var all=modal.textContent?modal.textContent.length:0;
    if(all>6000)return; // not a focused choice dialog - avoid scanning huge trees
    var els=modal.querySelectorAll(MODAL_SEL);
    for(var i=0;i<els.length;i++){
      var el=els[i];
      var key=el.textContent?el.textContent.length:0;
      if(el.__srtlm===key)continue;
      el.__srtlm=key;
      // Leave footer controls (Submit answers / Esc to cancel) untouched.
      if(MODAL_FOOTER_RE.test((el.textContent||"").trim()))continue;
      var t=findModalTextOwner(el);
      if(t)applyModalDirection(t);
    }
  }
  function applySmartDirectionToModals(root){
    if(!_on)return;
    root=root||document;
    try{
      if(root.nodeType!==1&&root.nodeType!==9)return;
      var modals=getQuestionModalRoots(root);
      // Also handle the case where the changed node is INSIDE a standard dialog.
      if(root.nodeType===1){
        var anc=root.closest?root.closest(MODAL_ROOT_SEL):null;
        if(anc&&modals.indexOf(anc)===-1)modals.push(anc);
      }
      for(var j=0;j<modals.length;j++)processModal(modals[j]);
    }catch(e){}
  }
  // ---- Markdown content (rendered blocks + raw source lines) ----
  // Reuses detectSmartDirection. Persian prose/headings/lists/quotes -> RTL; fenced
  // code stays LTR. Only affects markdown rendered INSIDE the Claude webview (not the
  // VSCode editor / built-in preview, which are separate webviews). Same rAF observer.
  function shouldSkipMarkdownBlock(el){
    return !!el.closest('pre, code, kbd, samp, .diff, .cm-editor:not([data-language="markdown"]), .monaco-editor:not([data-language="markdown"])');
  }
  function applyDirectionToMarkdownBlock(el){
    if(!el||!(el instanceof HTMLElement))return;
    if(shouldSkipMarkdownBlock(el))return;
    if(!isVisible(el))return;
    var text=(el.textContent||"").trim();
    if(!text||text.length>2000)return;
    var dir=detectSmartDirection(text);
    if(dir!=="rtl"){
      if(el.classList.contains("smart-md-rtl")){el.classList.remove("smart-md-rtl");el.removeAttribute("dir");el.style.removeProperty("direction");el.style.removeProperty("text-align");}
      return;
    }
    el.setAttribute("dir","rtl");
    el.style.setProperty("direction","rtl","important");
    el.style.setProperty("text-align","right","important");
    el.style.setProperty("unicode-bidi","isolate","important");
    el.style.setProperty("min-width","0","important");
    el.style.setProperty("max-width","100%","important");
    el.style.setProperty("white-space","normal","important");
    el.style.setProperty("overflow-wrap","anywhere","important");
    el.classList.add("smart-md-rtl");
  }
  var MD_SEL=[
    ".markdown h1",".markdown h2",".markdown h3",".markdown h4",".markdown h5",".markdown h6",".markdown p",".markdown li",".markdown blockquote",
    "[class*=\"markdown\"] h1","[class*=\"markdown\"] h2","[class*=\"markdown\"] h3","[class*=\"markdown\"] h4","[class*=\"markdown\"] h5","[class*=\"markdown\"] h6","[class*=\"markdown\"] p","[class*=\"markdown\"] li","[class*=\"markdown\"] blockquote",
    "[data-testid*=\"markdown\"] h1","[data-testid*=\"markdown\"] h2","[data-testid*=\"markdown\"] h3","[data-testid*=\"markdown\"] p","[data-testid*=\"markdown\"] li","[data-testid*=\"markdown\"] blockquote"
  ].join(",");
  function looksLikeMarkdownContainer(el){
    if(!el||!(el instanceof HTMLElement))return false;
    var text=(el.textContent||"").trim();
    if(text.length<20)return false;
    if(!RTL_RE.test(text))return false; // must contain Persian/Arabic
    return /```/.test(text)||/^#{1,6}\s+/m.test(text)||/^(\s*[-*+]\s+|\s*\d+[.)]\s+)/m.test(text);
  }
  function applySmartDirectionToRawMarkdownLines(root){
    var conts=root.querySelectorAll('[class*="markdown"], [data-testid*="markdown"]');
    for(var c=0;c<conts.length;c++){
      var container=conts[c];
      if(!looksLikeMarkdownContainer(container))continue;
      var clen=container.textContent?container.textContent.length:0;
      if(container.__srtlmdc===clen)continue; // process-once per container (gated)
      container.__srtlmdc=clen;
      var lines=container.querySelectorAll('[class*="line"], [data-line], .view-line');
      var inFence=false;
      for(var i=0;i<lines.length;i++){
        var line=lines[i];if(!(line instanceof HTMLElement))continue;
        var text=(line.textContent||"").trim();
        if(!text||text.length>=1000)continue;
        if(/^```/.test(text)){line.setAttribute("dir","ltr");line.style.setProperty("direction","ltr","important");line.style.setProperty("text-align","left","important");inFence=!inFence;continue;}
        if(inFence){line.setAttribute("dir","ltr");line.style.setProperty("direction","ltr","important");line.style.setProperty("text-align","left","important");line.style.setProperty("unicode-bidi","normal","important");continue;}
        var dir=detectSmartDirection(text);
        line.setAttribute("dir",dir);
        line.style.setProperty("direction",dir,"important");
        line.style.setProperty("text-align",dir==="rtl"?"right":"left","important");
        line.style.setProperty("unicode-bidi","isolate","important");
        line.style.setProperty("white-space","pre-wrap","important");
        line.style.setProperty("overflow-wrap","anywhere","important");
        line.classList.toggle("smart-md-rtl",dir==="rtl");
        line.classList.toggle("smart-md-ltr",dir==="ltr");
      }
    }
  }
  function applySmartDirectionToMarkdown(root){
    if(!_on)return;
    root=root||document;
    try{
      if(root.nodeType!==1&&root.nodeType!==9)return;
      var blocks=root.querySelectorAll(MD_SEL);
      for(var i=0;i<blocks.length;i++){
        var el=blocks[i];
        var key=el.textContent?el.textContent.length:0;
        if(el.__srtlmd===key)continue;
        el.__srtlmd=key;
        applyDirectionToMarkdownBlock(el);
      }
      applySmartDirectionToRawMarkdownLines(root);
    }catch(e){}
  }
  // ---- Markdown shown INSIDE a pre/code block (split into per-line spans) ----
  // VERY narrow: only blocks that are clearly Markdown AND contain Persian get
  // rewritten line-by-line; internal ``` fences keep their lines LTR. Normal code
  // (PowerShell/JS/JSON/diff) is never touched. Per-line direction is set INLINE
  // with !important so it beats the existing `pre *{direction:ltr}` rule.
  function looksLikeMarkdownCodeBlock(el){
    if(!el||!(el instanceof HTMLElement))return false;
    var text=el.textContent||"";
    if(!text.trim()||!containsRtl(text))return false; // must contain Persian/Arabic
    var cn=String(el.className||"").toLowerCase();
    var dl=String(el.getAttribute("data-language")||"").toLowerCase();
    var lg=String(el.getAttribute("lang")||"").toLowerCase();
    if(cn.indexOf("language-md")>=0||cn.indexOf("language-markdown")>=0||cn.indexOf("markdown")>=0||dl==="md"||dl==="markdown"||lg==="md"||lg==="markdown")return true;
    var sigs=[/^#{1,6}\s+/m,/^```/m,/^\s*[-*+]\s+/m,/^\s*\d+[.)]\s+/m,/\[[^\]]+\]\([^)]+\)/,/`[^`]+`/,/\*\*[^*]+\*\*/];
    var n=0;for(var i=0;i<sigs.length;i++)if(sigs[i].test(text))n++;
    return n>=2;
  }
  function isFenceLine(text){return /^\s*```/.test(String(text||"").trim());}
  function createSmartMarkdownLine(lineText,inFence){
    var line=document.createElement("span");
    line.className="smart-md-code-line";
    line.textContent=lineText||" ";
    if(inFence||isFenceLine(lineText)){
      line.setAttribute("dir","ltr");
      line.classList.add("smart-md-code-line-ltr");
      line.style.setProperty("direction","ltr","important");
      line.style.setProperty("text-align","left","important");
      line.style.setProperty("unicode-bidi","normal","important");
      line.style.setProperty("white-space","pre-wrap","important");
      line.style.setProperty("overflow-wrap","normal","important");
      return line;
    }
    var dir=detectSmartDirection(lineText);
    line.setAttribute("dir",dir);
    line.classList.add(dir==="rtl"?"smart-md-code-line-rtl":"smart-md-code-line-ltr");
    line.style.setProperty("direction",dir,"important");
    line.style.setProperty("text-align",dir==="rtl"?"right":"left","important");
    line.style.setProperty("unicode-bidi","isolate","important");
    line.style.setProperty("white-space","pre-wrap","important");
    line.style.setProperty("overflow-wrap","anywhere","important");
    return line;
  }
  function smartifyMarkdownCodeBlock(codeEl){
    if(!codeEl||!(codeEl instanceof HTMLElement))return;
    // Already transformed and still intact -> skip (prevents a rewrite loop).
    if(codeEl.getAttribute("data-smart-md-code")==="1"&&codeEl.querySelector(".smart-md-code-line"))return;
    if(!looksLikeMarkdownCodeBlock(codeEl))return;
    var originalText=codeEl.textContent||"";
    if(!originalText.trim())return;
    codeEl.setAttribute("data-smart-md-code","1");
    codeEl.classList.add("smart-md-code-block");
    codeEl.setAttribute("dir","ltr");
    codeEl.style.setProperty("direction","ltr","important");
    codeEl.style.setProperty("text-align","left","important");
    codeEl.style.setProperty("unicode-bidi","normal","important");
    codeEl.style.setProperty("white-space","pre-wrap","important");
    var lines=originalText.split("\n"),frag=document.createDocumentFragment(),inFence=false;
    for(var i=0;i<lines.length;i++){
      var rawLine=lines[i];
      if(isFenceLine(rawLine.trim())){
        frag.appendChild(createSmartMarkdownLine(rawLine,true));
        frag.appendChild(document.createTextNode("\n"));
        inFence=!inFence;continue;
      }
      frag.appendChild(createSmartMarkdownLine(rawLine,inFence));
      frag.appendChild(document.createTextNode("\n"));
    }
    try{codeEl.replaceChildren(frag);}catch(e){}
  }
  function applySmartDirectionToMarkdownCodeBlocks(root){
    if(!_on)return;
    root=root||document;
    try{
      if(root.nodeType!==1&&root.nodeType!==9)return;
      if(root.nodeType===1&&root.matches&&root.matches("pre > code, pre code"))smartifyMarkdownCodeBlock(root);
      var blocks=root.querySelectorAll("pre > code, pre code");
      for(var i=0;i<blocks.length;i++)smartifyMarkdownCodeBlock(blocks[i]);
    }catch(e){}
  }
  function start(){
    if(_started)return;_started=true;
    applySmartDirectionToRenderedText(document);
    applySmartDirectionToHeaderTitles(document);
    applySmartDirectionToModals(document);
    applySmartDirectionToMarkdown(document);
    applySmartDirectionToMarkdownCodeBlocks(document);
    updateComposerDirection("");
    // input + composition cover typing; keyup/beforeinput were redundant (two calls
    // per keystroke) and contributed to the typing lag.
    document.addEventListener("input",composerHandler(false),true);
    document.addEventListener("compositionupdate",composerHandler(true),true);
    document.addEventListener("compositionend",composerHandler(false),true);
    document.addEventListener("focusin",composerHandler(false),true);
    // Belt-and-suspenders for prompt submit (the new bubble also arrives via the
    // observer below). Light, because the passes are process-once.
    document.addEventListener("submit",scheduleSmartDirectionPass,true);
    document.addEventListener("keydown",function(e){if(e.key==="Enter")scheduleSmartDirectionPass();},true);
    // Mutations inside the composer/editor are handled by the composer listeners
    // above; the rendered/header passes must NOT scan that subtree on every
    // keystroke (the composer class contains "message"), or typing lags.
    var COMPOSER_SKIP='[contenteditable], [role="textbox"], textarea, input, .cm-editor, .monaco-editor, [class*="messageInput"], [class*="mentionMirror"], [class*="mirror"], [class*="Mirror"]';
    // rAF-coalesced: process ONLY the changed (non-composer) subtrees once/frame.
    var queued=[],flushScheduled=false,sawNonComposer=false;
    function flush(){
      flushScheduled=false;
      var roots=queued;queued=[];var seen=[],didWork=sawNonComposer;sawNonComposer=false;
      for(var i=0;i<roots.length;i++){
        var r=roots[i];
        if(!r||r.nodeType!==1||seen.indexOf(r)!==-1)continue;
        seen.push(r);
        applySmartDirectionToRenderedText(r);
        applySmartDirectionToHeaderTitles(r);
        applySmartDirectionToModals(r);
        applySmartDirectionToMarkdown(r);
        applySmartDirectionToMarkdownCodeBlocks(r);
      }
      if(didWork)updateComposerDirection("");
    }
    function enqueue(node){
      if(!node||node.nodeType!==1)return;
      if(node.closest&&node.closest(COMPOSER_SKIP))return; // composer handles itself
      sawNonComposer=true;
      queued.push(node);
      if(flushScheduled)return;
      flushScheduled=true;
      try{if(window.requestAnimationFrame)window.requestAnimationFrame(flush);else setTimeout(flush,16);}catch(e){setTimeout(flush,16);}
    }
    try{
      new MutationObserver(function(mutations){
        for(var m=0;m<mutations.length;m++){
          var mu=mutations[m];
          if(mu.type==="childList"){
            for(var n=0;n<mu.addedNodes.length;n++){if(mu.addedNodes[n].nodeType===1)enqueue(mu.addedNodes[n]);}
          }else if(mu.type==="characterData"){
            var tp=mu.target&&mu.target.parentElement;
            if(tp)enqueue(tp);
          }
        }
      }).observe(document.body,{childList:true,subtree:true,characterData:true});
    }catch(e){}
  }
  // Live revert: strip everything this engine added (classes, inline styles, dir,
  // process-once flags) so turning the extension OFF restores the page instantly.
  function revertAll(){
    try{
      var sel=".smart-rtl,.smart-ltr,.smart-header-rtl,.smart-header-ltr,.smart-modal-rtl,.smart-modal-ltr,.smart-md-rtl,.smart-md-ltr,.smart-md-code-block,.smart-md-code-line,.composer-smart-rtl,.composer-smart-ltr";
      var props=["direction","text-align","unicode-bidi","min-width","max-width","white-space","overflow-wrap","word-break","width","margin-left","margin-right","margin-inline-start","margin-inline-end","box-sizing","align-self","justify-self","overflow-x"];
      var cls=["smart-rtl","smart-ltr","smart-header-rtl","smart-header-ltr","smart-modal-rtl","smart-modal-ltr","smart-md-rtl","smart-md-ltr","smart-md-code-block","smart-md-code-line","smart-md-code-line-rtl","smart-md-code-line-ltr","composer-smart-rtl","composer-smart-ltr"];
      var els=document.querySelectorAll(sel);
      for(var i=0;i<els.length;i++){
        var el=els[i];
        if(el.removeAttribute)el.removeAttribute("dir");
        if(el.style)for(var p=0;p<props.length;p++)el.style.removeProperty(props[p]);
        if(el.classList)for(var c=0;c<cls.length;c++)el.classList.remove(cls[c]);
        if(el.removeAttribute)el.removeAttribute("data-smart-md-code");
        try{el.__srtl=el.__srtlh=el.__srtlm=el.__srtlmd=el.__srtlL=el.__srtlmdc=el.__srtlW=undefined;}catch(e){}
      }
    }catch(e){}
  }
  // Public control, shared across this extension's content scripts (same isolated
  // world). The popup toggle writes chrome.storage; the controller calls these.
  window.__SMART_RTL__={
    enable:function(){ _on=true; if(!_started)start(); else { runDirectionPasses(); updateComposerDirection(""); } },
    disable:function(){ _on=false; revertAll(); },
    isOn:function(){ return !!_on; }
  };
  // In a browser extension a controller manages on/off via chrome.storage, so do
  // NOT auto-run there. Everywhere else (VSCode webview) run automatically.
  var _hasExtStorage=false; try{_hasExtStorage=!!(typeof chrome!=="undefined"&&chrome.storage&&chrome.storage.local);}catch(e){}
  if(!_hasExtStorage){
    if(document.body)window.__SMART_RTL__.enable();
    else document.addEventListener("DOMContentLoaded",function(){window.__SMART_RTL__.enable();});
  }
})();
'@

$patched = 0

function Strip-Block {
    param([string]$Content, [string]$StartMarker, [string]$EndMarker)
    $pattern = [regex]::Escape($StartMarker) + '.*?' + [regex]::Escape($EndMarker)
    return [regex]::Replace($Content, $pattern, '', [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd("`r","`n")
}

function Patch-IDE {
    param([string]$IdeName, [string]$ExtensionsPath)

    if (-not (Test-Path $ExtensionsPath)) { return }

    $extDirs = Get-ChildItem -Path $ExtensionsPath -Directory -Filter "anthropic.claude-code-*" -ErrorAction SilentlyContinue

    foreach ($extDir in $extDirs) {
        $webviewPath = Join-Path $extDir.FullName "webview"
        $cssFile     = Join-Path $webviewPath "index.css"
        $cssBackup   = Join-Path $webviewPath "index.css.backup"
        $jsFile      = Join-Path $webviewPath "index.js"
        $jsBackup    = Join-Path $webviewPath "index.js.backup"

        if (-not (Test-Path $cssFile) -or -not (Test-Path $jsFile)) { continue }

        # Ensure clean backups exist
        if (-not (Test-Path $cssBackup)) { Copy-Item $cssFile $cssBackup }
        if (-not (Test-Path $jsBackup))  { Copy-Item $jsFile  $jsBackup }

        if ($Revert) {
            Copy-Item $cssBackup $cssFile -Force
            Copy-Item $jsBackup  $jsFile  -Force
            Write-Host "[OK] " -ForegroundColor Green -NoNewline
            Write-Host "Reverted ${IdeName}: $webviewPath"
            $script:patched++
            continue
        }

        # --- CSS: rebuild from clean backup, then append smart block ---
        $cssBase = Get-Content $cssBackup -Raw -Encoding UTF8
        $cssBase = Strip-Block $cssBase $CSS_START $CSS_END
        $cssBlock = $CSS_START + "`n"
        if ($WithFont) { $cssBlock += $FONT_CSS + "`n" }
        $cssBlock += $SMART_CSS_CORE + "`n" + $CSS_END
        Set-Content -Path $cssFile -Value ($cssBase + "`n" + $cssBlock) -NoNewline -Encoding UTF8

        # --- JS: rebuild from clean backup, then append smart block ---
        $jsBase = Get-Content $jsBackup -Raw -Encoding UTF8
        $jsBase = Strip-Block $jsBase $JS_START $JS_END
        $jsBlock = $JS_START + "`n" + $SMART_JS + "`n" + $JS_END
        Set-Content -Path $jsFile -Value ($jsBase + "`n" + $jsBlock) -NoNewline -Encoding UTF8

        Write-Host "[OK] " -ForegroundColor Green -NoNewline
        Write-Host "Patched ${IdeName}: $webviewPath"
        $script:patched++
    }
}

Write-Host ""
Write-Host "=== Smart Auto-Direction Fix for Claude Code Extension ==="
Write-Host ""
if ($WithFont) { Write-Host "Using Vazirmatn font for text" -ForegroundColor Yellow }
if ($Revert)   { Write-Host "Revert mode: restoring originals" -ForegroundColor Yellow }

$userProfile = $env:USERPROFILE
Patch-IDE -IdeName "VSCode"          -ExtensionsPath "$userProfile\.vscode\extensions"
Patch-IDE -IdeName "VSCode Insiders" -ExtensionsPath "$userProfile\.vscode-insiders\extensions"
Patch-IDE -IdeName "Cursor"          -ExtensionsPath "$userProfile\.cursor\extensions"
Patch-IDE -IdeName "Windsurf"        -ExtensionsPath "$userProfile\.windsurf\extensions"
Patch-IDE -IdeName "Windsurf Next"   -ExtensionsPath "$userProfile\.windsurf-next\extensions"

Write-Host ""
if ($patched -eq 0) {
    Write-Host "No Claude Code extensions found." -ForegroundColor Red
    Write-Host "Make sure Claude Code extension is installed in your IDE."
    exit 1
} else {
    Write-Host "Done on $patched IDE(s)." -ForegroundColor Green
    Write-Host ""
    Write-Host "Restart your IDE to apply changes."
}

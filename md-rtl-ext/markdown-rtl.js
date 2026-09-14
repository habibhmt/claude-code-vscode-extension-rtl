// Direction per block: any Persian/Arabic letter -> rtl, otherwise ltr.
// CSS unicode-bidi:plaintext judges by the FIRST strong letter, so a line
// opening with "v4 —", "(" or inline code flipped whole Persian lines to LTR.
(function () {
  var RTL = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
  var SEL = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, dt, dd';
  function textOf(el) {
    // code spans don't decide the line's direction
    var c = el.cloneNode(true);
    c.querySelectorAll('code, pre, ul, ol').forEach(function (n) { n.remove(); });
    return c.textContent;
  }
  function apply() {
    document.querySelectorAll(SEL).forEach(function (el) {
      var d = RTL.test(textOf(el)) ? 'rtl' : 'ltr';
      if (el.getAttribute('dir') !== d) el.setAttribute('dir', d);
    });
  }
  window.addEventListener('vscode.markdown.updateContent', apply);
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  apply();
})();

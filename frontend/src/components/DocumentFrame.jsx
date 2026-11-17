// Renders server-generated HTML (the offer letter) in a sandboxed iframe styled as a document.
// sandbox: no "allow-scripts", so nothing in the HTML can run; "allow-same-origin" lets us size the frame and
// call print() on it; "allow-modals" is needed for the browser's print dialog.
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

const DocumentFrame = forwardRef(function DocumentFrame({ html, title }, ref) {
  const frame = useRef(null);

  const fit = useCallback(() => {
    const doc = frame.current && frame.current.contentDocument;
    if (doc && doc.documentElement) frame.current.style.height = `${doc.documentElement.scrollHeight + 4}px`;
  }, []);

  useImperativeHandle(ref, () => ({
    print() {
      const win = frame.current && frame.current.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }
    },
  }));

  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin allow-modals"
      referrerPolicy="no-referrer"
      onLoad={fit}
      style={{ width: '100%', minHeight: 600, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: '#fff' }}
    />
  );
});

export default DocumentFrame;

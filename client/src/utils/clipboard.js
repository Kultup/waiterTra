export const copyText = async (text, options = {}) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'clipboard';
    } catch (error) {
      // Ignore and try fallback strategies below.
    }
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    try {
      if (document.execCommand('copy')) {
        document.body.removeChild(textarea);
        if (selection) {
          selection.removeAllRanges();
          if (originalRange) selection.addRange(originalRange);
        }
        return 'execCommand';
      }
    } catch (error) {
      // Ignore and fall through to manual prompt.
    }

    document.body.removeChild(textarea);
    if (selection) {
      selection.removeAllRanges();
      if (originalRange) selection.addRange(originalRange);
    }
  }

  if (options.allowManualPrompt !== false && typeof window !== 'undefined' && typeof window.prompt === 'function') {
    window.prompt('Скопіюйте посилання вручну:', text);
    return 'prompt';
  }

  throw new Error('Copy is not available in this browser context.');
};

/**
 * Detects if the user is on a mobile device
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Generates a WhatsApp deep link based on device type.
 */
export const generateWhatsAppLink = (phone: string, text: string): string => {
  // Remove non-digits (keep country code if present in digits, e.g. 1555...)
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Replace leading '0' with '92' (Pakistan) country code.
  // This converts local numbers (e.g., 03001234567) to international format (e.g., 923001234567).
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '92' + cleanPhone.substring(1);
  }

  const encodedText = encodeURIComponent(text);
  
  // Mobile: use wa.me to trigger the native app intent
  // This opens the WhatsApp App on Android/iOS
  if (isMobileDevice()) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  
  // Desktop: use web.whatsapp.com to skip the "Continue to Chat" landing page
  // and go directly to the web interface
  return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
};

/**
 * Open WhatsApp in a new tab
 */
export const openWhatsAppTab = (phone: string, text: string) => {
  const url = generateWhatsAppLink(phone, text);
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Copies an image file to the system clipboard.
 * This acts as a workaround for "attaching" images in the web bridge.
 * Now enabled for Mobile as well (supported on iOS 13+ and some Androids).
 */
export const copyImageToClipboard = async (file: File): Promise<boolean> => {
  try {
    // ClipboardItem requires specific MIME types (usually image/png or image/jpeg)
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    
    await navigator.clipboard.write([
      new ClipboardItem({
        [file.type]: blob
      })
    ]);
    return true;
  } catch (error) {
    console.warn("Clipboard write failed. Context might not be secure or format unsupported.", error);
    return false;
  }
};

/**
 * Checks if the browser supports native file sharing (Web Share API Level 2)
 */
export const canNativeShare = (file?: File | null): boolean => {
  if (!file || typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  return navigator.canShare({ files: [file] });
};

/**
 * Uses the native Web Share API to send image + text.
 * This allows automatic attachment on supported mobile devices.
 * Returns true if the share sheet was opened and action completed/dismissed successfully.
 * Returns false if sharing failed or was not supported, signaling a need for fallback.
 */
export const shareContent = async (file: File, text: string): Promise<boolean> => {
  if (!canNativeShare(file)) return false;

  const shareData = {
    files: [file],
    text: text,
    // Title is often ignored by WA but required by API structure
    title: 'Message from MapLeads' 
  };

  try {
    // Robust check using the specific data object
    if (navigator.canShare && !navigator.canShare(shareData)) {
       console.warn("navigator.canShare returned false for the specific share data.");
       return false;
    }

    await navigator.share(shareData);
    return true;
  } catch (error: any) {
    // AbortError is typical if user cancels the share sheet
    if (error.name === 'AbortError') {
      console.debug("Native share cancelled by user.");
      // We return false here to allow the caller to decide if they want to try the fallback 
      // (e.g. manual copy) or just stop. 
      // In our app flow, returning false triggers the manual copy fallback in App.tsx.
      return false;
    }
    
    console.error("Native share failed with error:", error);
    return false;
  }
};
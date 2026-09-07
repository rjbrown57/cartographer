const MobileUserAgent = /Android.+Mobile|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;

// IsMobileBrowser uses the browser's mobile hint when available and a conservative user-agent fallback otherwise.
export function IsMobileBrowser(userAgent: string, mobileHint?: boolean): boolean {
    if (typeof mobileHint === 'boolean') {
        return mobileHint;
    }
    return MobileUserAgent.test(userAgent);
}

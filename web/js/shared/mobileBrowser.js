const MobileUserAgent = /Android.+Mobile|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;
export function IsMobileBrowser(userAgent, mobileHint) {
    if (typeof mobileHint === 'boolean') {
        return mobileHint;
    }
    return MobileUserAgent.test(userAgent);
}

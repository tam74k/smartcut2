/**
 * Global Double-Click & Rapid Click Preventer
 * 
 * Intercepts clicks at the DOM capture phase (before any React SyntheticEvent fires)
 * to prevent double submissions, duplicate financial records, and doubled accounts.
 */

// Track last click timestamp per button element
const lastClickMap = new WeakMap<Element, number>();

// Track form submissions
const lastFormSubmitMap = new WeakMap<HTMLFormElement, number>();

// Default throttle interval in milliseconds
const DEFAULT_DOUBLE_CLICK_THRESHOLD_MS = 800;

let isInitialized = false;

export function initDoubleClickPreventer(thresholdMs: number = DEFAULT_DOUBLE_CLICK_THRESHOLD_MS): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Intercept all button/clickable clicks at the WINDOW CAPTURE phase
  window.addEventListener(
    'click',
    (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Find closest actionable button or clickable role
      const button = target.closest<HTMLElement>(
        'button, [role="button"], input[type="submit"], input[type="button"], a.btn, a[role="button"]'
      );

      if (!button) return;

      // Allow intentional rapid clicks on steppers, quantities, or explicit opt-outs
      if (
        button.hasAttribute('data-allow-rapid') ||
        button.classList.contains('allow-rapid') ||
        button.classList.contains('btn-quantity') ||
        button.classList.contains('btn-stepper') ||
        button.getAttribute('aria-label')?.includes('زيادة') ||
        button.getAttribute('aria-label')?.includes('تقليل')
      ) {
        return;
      }

      const now = Date.now();
      const lastClickedAt = lastClickMap.get(button) || 0;

      // If clicked again within threshold, SILENTLY DROP THE EVENT AT CAPTURE PHASE
      if (now - lastClickedAt < thresholdMs) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        console.warn(
          `[DoubleClickPreventer] Blocked duplicate click (${now - lastClickedAt}ms since last click) on:`,
          button.innerText?.trim() || button.getAttribute('aria-label') || button.tagName
        );
        return;
      }

      // Record timestamp of this valid click
      lastClickMap.set(button, now);

      // Temporarily disable pointer events on the DOM element to physically prevent browser duplicate gestures
      const originalPointerEvents = button.style.pointerEvents;
      button.style.pointerEvents = 'none';

      // Re-enable after threshold
      setTimeout(() => {
        try {
          button.style.pointerEvents = originalPointerEvents;
        } catch (_) {}
      }, thresholdMs);
    },
    true // useCapture: true ensures we intercept before React handles the click
  );

  // 2. Intercept Form Submit events to prevent rapid Enter key presses
  window.addEventListener(
    'submit',
    (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;

      const now = Date.now();
      const lastSubmittedAt = lastFormSubmitMap.get(form) || 0;

      if (now - lastSubmittedAt < thresholdMs) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        console.warn('[DoubleClickPreventer] Blocked duplicate form submission.');
        return;
      }

      lastFormSubmitMap.set(form, now);
    },
    true
  );

  console.log('[DoubleClickPreventer] Global double-click protection activated.');
}

/**
 * Higher-order utility to wrap any async click handler with an automatic execution lock
 */
export function preventDoubleExecution<T extends (...args: any[]) => Promise<any> | any>(
  fn: T,
  lockDurationMs: number = DEFAULT_DOUBLE_CLICK_THRESHOLD_MS
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let isLocked = false;

  return function (this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    if (isLocked) {
      console.warn('[preventDoubleExecution] Duplicate call rejected by active execution lock.');
      return undefined;
    }

    isLocked = true;
    try {
      const result = fn.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          setTimeout(() => {
            isLocked = false;
          }, lockDurationMs);
        }) as ReturnType<T>;
      } else {
        setTimeout(() => {
          isLocked = false;
        }, lockDurationMs);
        return result;
      }
    } catch (err) {
      isLocked = false;
      throw err;
    }
  };
}

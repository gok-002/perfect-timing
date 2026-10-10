/**
 * Monetisation integration points. NOTHING here shows an ad or charges money:
 * no SDK or credentials are configured, so every provider reports "unavailable"
 * and the UI hides the related buttons. See docs/MONETIZATION.md for setup.
 *
 * A real provider (e.g. AdMob via Capacitor, or a web ad network) must implement:
 *   { isRewardedReady(): boolean, showRewarded(): Promise<{ rewarded: boolean }> }
 * A real store provider must implement:
 *   { isAvailable(): boolean, purchase(productId): Promise<{ ok: boolean }>, restore(): Promise<string[]> }
 */
export const PRODUCT_IDS = Object.freeze({
  REMOVE_ADS: 'perfect_timing.remove_ads',
  THEME_PACK_1: 'perfect_timing.theme_pack_1',
});

export class AdService {
  constructor(provider = null) {
    this.provider = provider;
  }

  /** Rewarded "continue once" is opt-in, so it stays available even with remove-ads. */
  isRewardedAvailable() {
    try {
      return !!this.provider && this.provider.isRewardedReady() === true;
    } catch {
      return false;
    }
  }

  async showRewarded() {
    if (!this.isRewardedAvailable()) return { rewarded: false };
    try {
      const result = await this.provider.showRewarded();
      return { rewarded: result?.rewarded === true };
    } catch (err) {
      console.warn('[AdService] rewarded ad failed', err);
      return { rewarded: false };
    }
  }
}

export class StoreService {
  constructor(provider = null) {
    this.provider = provider;
  }

  isAvailable() {
    try {
      return !!this.provider && this.provider.isAvailable() === true;
    } catch {
      return false;
    }
  }

  async purchase(productId) {
    if (!this.isAvailable()) return { ok: false, reason: 'store-unavailable' };
    try {
      const result = await this.provider.purchase(productId);
      return { ok: result?.ok === true };
    } catch (err) {
      console.warn('[StoreService] purchase failed', err);
      return { ok: false, reason: 'error' };
    }
  }
}

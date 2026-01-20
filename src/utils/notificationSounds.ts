// Notification sound utilities using Web Audio API
// No external files needed - generates sounds programmatically

class NotificationSounds {
  private audioContext: AudioContext | null = null;
  
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Play a pleasant chime for new orders (kitchen notification)
  playNewOrderChime() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      // Create oscillator for the chime
      const oscillator1 = ctx.createOscillator();
      const oscillator2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Two-tone chime (C5 and E5)
      oscillator1.frequency.setValueAtTime(523.25, now); // C5
      oscillator2.frequency.setValueAtTime(659.25, now); // E5
      
      oscillator1.type = 'sine';
      oscillator2.type = 'sine';
      
      // Envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      
      oscillator1.start(now);
      oscillator2.start(now);
      oscillator1.stop(now + 0.5);
      oscillator2.stop(now + 0.5);
      
      // Second chime (higher pitch)
      setTimeout(() => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        const t = ctx.currentTime;
        osc1.frequency.setValueAtTime(659.25, t); // E5
        osc2.frequency.setValueAtTime(783.99, t); // G5
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.15);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.5);
        osc2.stop(t + 0.5);
      }, 200);
      
      console.log('🔔 Playing new order chime');
    } catch (error) {
      console.error('Error playing new order chime:', error);
    }
  }

  // Play a success sound for served orders (restaurant notification)
  playOrderServedSound() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      // Create oscillator
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      
      // Rising arpeggio sound
      oscillator.frequency.setValueAtTime(440, now); // A4
      oscillator.frequency.setValueAtTime(523.25, now + 0.1); // C5
      oscillator.frequency.setValueAtTime(659.25, now + 0.2); // E5
      oscillator.frequency.setValueAtTime(880, now + 0.3); // A5
      
      // Envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.35, now + 0.05);
      gainNode.gain.setValueAtTime(0.35, now + 0.35);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
      
      oscillator.start(now);
      oscillator.stop(now + 0.6);
      
      console.log('✅ Playing order served sound');
    } catch (error) {
      console.error('Error playing order served sound:', error);
    }
  }

  // Play a bell sound for general notifications
  playBellSound() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now); // A5
      
      // Bell-like envelope with quick attack and longer decay
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.5, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1);
      
      oscillator.start(now);
      oscillator.stop(now + 1);
      
      console.log('🔔 Playing bell sound');
    } catch (error) {
      console.error('Error playing bell sound:', error);
    }
  }
}

// Export singleton instance
export const notificationSounds = new NotificationSounds();
